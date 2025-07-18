import { Telegraf, Scenes, session, Markup } from 'telegraf';
import clientPromise from '@/lib/mongodb';
import { BotConfigSchema } from '@/lib/schemas';
import type { Tenant, BotStep, BotButton, Product, Purchase, User, Sale } from '@/lib/types';
import { z } from 'zod';
import { Db, ObjectId } from 'mongodb';
import { createMercadoPagoPreference, createMercadoPagoPixPayment } from '@/lib/mercadopago';

function escapeMarkdown(text: string): string {
  if (!text) return '';
  const charsToEscape = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
  return charsToEscape.reduce((acc, char) => acc.replace(new RegExp('\\' + char, 'g'), '\\' + char), text);
}

function replacePlaceholders(text: string, from: any): string {
    if (!text) return '';
    return text.replace(/{userName}/g, from?.first_name || 'usuário');
}

function buildKeyboard(buttons: BotButton[] | undefined): { inline_keyboard: { text: string; callback_data: string; }[][]; } | undefined {
    if (!buttons || buttons.length === 0) {
        return undefined;
    }
    const keyboard = buttons.map(button => {
        const action = button.action;
        const callback_data = action.payload ? `${action.type}:${action.payload}` : action.type;
        return [{ text: button.text, callback_data }];
    });
    return { inline_keyboard: keyboard };
}

async function executeStep(ctx: any, step: BotStep) {
    const messageText = replacePlaceholders(step.message, ctx.from);
    const keyboard = buildKeyboard(step.buttons);

    const escapedMessage = escapeMarkdown(messageText);

    try {
        if (ctx.callbackQuery) {
            await ctx.editMessageText(escapedMessage, {
                parse_mode: 'MarkdownV2',
                reply_markup: keyboard
            });
        } else {
            await ctx.reply(escapedMessage, {
                parse_mode: 'MarkdownV2',
                reply_markup: keyboard
            });
        }
    } catch (e: any) {
         if (e.response?.description?.includes('message is not modified')) {
            console.log('[Telegraf] Message not modified, no need to edit.');
        } else {
            console.warn('[Telegraf] Failed to process step, sending new one. Error:', e.response?.description);
            await ctx.reply(escapedMessage, { parse_mode: 'MarkdownV2', reply_markup: keyboard });
        }
    }
}

async function generateProfileMessage(db: Db, user: User, options: { showBackButton?: boolean, startStepId?: string | null } = {}) {
    const { showBackButton = false, startStepId = null } = options;
    let profileMessage = `*Perfil de ${escapeMarkdown(user.name || 'Usuário')}*\n\n`;

    if (!user.purchases || user.purchases.length === 0) {
        profileMessage += "Você ainda não fez nenhuma compra.";
    } else {
        profileMessage += "*Suas Compras e Assinaturas:*\n\n";
        user.purchases.forEach((purchase: Purchase) => {
            const purchaseDate = new Date(purchase.purchaseDate).toLocaleDateString('pt-BR');
            profileMessage += `🛍️ *${escapeMarkdown(purchase.productName)}*\n`;
            profileMessage += `  \\- Data: ${purchaseDate}\n`;

            if (purchase.type === 'subscription' && purchase.expiresAt) {
                const expiresDate = new Date(purchase.expiresAt);
                const isExpired = new Date() > expiresDate;
                const formattedExpiresDate = expiresDate.toLocaleDateString('pt-BR');
                
                if (isExpired) {
                    profileMessage += `  \\- Status: 🔴 Expirada em ${formattedExpiresDate}\n`;
                } else {
                    profileMessage += `  \\- Status: 🟢 Ativa até ${formattedExpiresDate}\n`;
                }
            }
            profileMessage += `\n`;
        });
    }

    const keyboardButtons = [
        [{ text: '🗑️ Deletar Meus Dados', callback_data: 'DELETE_DATA_CONFIRM' }]
    ];

    if (showBackButton && startStepId) {
        keyboardButtons.push([{ text: '⬅️ Voltar ao Início', callback_data: `GO_TO_STEP:${startStepId}` }]);
    }

    const keyboard = {
        inline_keyboard: keyboardButtons
    };

    return { profileMessage, keyboard };
}

export function createBotInstance(token: string) {
    const bot = new Telegraf(token);

    bot.use(async (ctx: any, next) => {
        if (ctx.tenant) {
            if (ctx.tenant.subscriptionStatus === 'inactive') return;
            return next();
        }
        
        const client = await clientPromise;
        const db = client.db('vematize');
        const tenant = await db.collection<Tenant>('tenants').findOne({ "connections.telegram.botToken": token });
        
        if (!tenant) {
            console.warn(`[Telegraf] Tenant não encontrado para o token ${token.substring(0, 10)}...`);
            bot.on('message', ctx => ctx.reply('Este bot não está configurado corretamente.'));
            bot.on('callback_query', ctx => ctx.answerCbQuery('Bot não configurado.'));
            return;
        }

        ctx.tenant = tenant;
        console.log(`[Telegraf] Tenant '${tenant.subdomain}' encontrado para o token prefix ${token.substring(0, 10)}...`);

        const parseResult = BotConfigSchema.safeParse(tenant.botConfig);
        
        if (!parseResult.success) {
            console.warn(`[Telegraf] Tenant '${tenant.subdomain}' has invalid bot config. Allowing access but features might fail.`);
        } else {
            (tenant as any).botConfig = parseResult.data;
        }

        if (tenant.subscriptionStatus === 'inactive') {
            console.log(`[Telegraf] Tenant '${tenant.subdomain}' está INATIVO. Bloqueando bot.`);
            const inactiveMessage = tenant.botConfig?.inactiveSubscriptionMessage || 'Este serviço foi temporariamente suspenso. Por favor, contate o administrador.';
            
            bot.on('message', ctx => ctx.reply(inactiveMessage));
            bot.on('callback_query', ctx => ctx.answerCbQuery(inactiveMessage));
            
            return;
        }

        return next();
    });

    bot.on('text', async (ctx: any) => {
        const command = ctx.message.text;
        if (!command || !command.startsWith('/')) {
            return; 
        }
        
        console.log(`[Telegraf] Received command "${command}" for chat ID: ${ctx.chat.id}`);
        const tenant = ctx.tenant;
        if (!tenant) {
            return ctx.reply("Olá! Este bot ainda não foi ativado.");
        }

        try {
            const db = (await clientPromise).db('vematize');
            await db.collection('users').updateOne(
                { telegramId: ctx.from.id, tenantId: tenant._id.toString() },
                { 
                    $set: { name: ctx.from.first_name, username: ctx.from.username },
                    $setOnInsert: { 
                        telegramId: ctx.from.id,
                        tenantId: tenant._id.toString(),
                        createdAt: new Date(),
                        state: 'active',
                        plan: 'Nenhum'
                    }
                },
                { upsert: true }
            );
        } catch (error) {
            console.error('[Telegraf] Error upserting user:', error);
        }

        const botConfig = tenant.botConfig;
        if (!botConfig || !botConfig.flows || botConfig.flows.length === 0) {
            return ctx.reply("Olá! Este bot ainda não foi configurado.");
        }

        const flow = botConfig.flows.find((f: z.infer<typeof import('@/lib/schemas').BotFlowSchema>) => f.trigger === command);

        if (flow) {
            console.log(`[Telegraf] Found flow "${flow.name}" for command "${command}".`);
            const startStep = flow.steps.find((s: BotStep) => s.id === flow.startStepId);
            if (startStep) {
                await executeStep(ctx, startStep);
            } else {
                 console.error(`[Telegraf] Start step not found for flow "${flow.name}".`);
                 return ctx.reply("Este fluxo está configurado incorretamente (passo inicial não encontrado).");
            }
        } else {
            if (command === '/perfil') {
                const db = (await clientPromise).db('vematize');
                const user = await db.collection<User>('users').findOne({ telegramId: ctx.from.id, tenantId: tenant._id.toString() });

                if (!user) return ctx.reply("Não encontrei seu perfil. Interaja com o bot primeiro para se registrar.");
                
                const mainFlow = botConfig.flows.find((f: z.infer<typeof import('@/lib/schemas').BotFlowSchema>) => f.trigger === '/start');
                const { profileMessage, keyboard } = await generateProfileMessage(db, user, { showBackButton: !!mainFlow, startStepId: mainFlow?.startStepId || null });
        
                await ctx.reply(profileMessage, { parse_mode: 'MarkdownV2', reply_markup: keyboard });
            } else {
                console.log(`[Telegraf] No flow found for command "${command}".`);
                return ctx.reply("Comando não reconhecido.");
            }
        }
    });

    bot.on('callback_query', async (ctx: any) => {
        const data = ctx.callbackQuery.data;
        const tenant = ctx.tenant as Tenant;
        
        console.log(`[Telegraf] Received callback_query with data: "${data}"`);

        if (!tenant) {
            return ctx.reply("Este bot não está configurado corretamente (Tenant não encontrado).");
        }
        
        const db = (await clientPromise).db('vematize');
        const usersCollection = db.collection<User>('users');
        const user = await usersCollection.findOne({ telegramId: ctx.from.id, tenantId: tenant._id.toString() });

        if (!user) {
            return ctx.answerCbQuery('Usuário não encontrado. Tente enviar /start primeiro.');
        }

        const botConfig = tenant.botConfig;
        if (!botConfig || !botConfig.flows || botConfig.flows.length === 0) {
            return ctx.answerCbQuery("Bot não configurado.");
        }

        const allFlows = botConfig.flows;
        const allSteps = allFlows.flatMap(flow => flow.steps);
        
        if (data === 'DELETE_DATA_CONFIRM') {
            const confirmationKeyboard = {
                inline_keyboard: [
                    [{ text: '🔴 Sim, deletar TUDO', callback_data: 'DELETE_DATA_EXECUTE' }],
                    [{ text: '🟢 Não, manter meus dados', callback_data: 'MAIN_MENU' }]
                ]
            };
            const message = '⚠️ *Atenção!* Esta ação é irreversível\\. Ao confirmar, todos os seus dados, incluindo histórico de compras e assinaturas, serão permanentemente apagados\\. Deseja continuar?';
            return await ctx.editMessageText(message, { parse_mode: 'MarkdownV2', reply_markup: confirmationKeyboard });
        }

        if (data === 'DELETE_DATA_EXECUTE') {
             try {
                await usersCollection.deleteOne({ _id: user._id });
                await ctx.editMessageText('✅ Seus dados foram deletados com sucesso.');
             } catch(e) {
                console.error(`[Telegraf] Failed to delete user data for ${user._id}:`, e);
                await ctx.editMessageText('❌ Ocorreu um erro ao deletar seus dados. Por favor, tente novamente.');
             }
             return;
        }

        const [actionType, payload] = data.split(':', 2);
        
        if (!actionType) {
            console.warn(`[Telegraf] Received callback_query with invalid data: "${data}"`);
            return ctx.answerCbQuery('Ação inválida.');
        }

        const targetStep = allSteps.find(s => s.id === payload);

        switch (actionType) {
            case 'GO_TO_STEP':
                if (targetStep) {
                    await executeStep(ctx, targetStep);
                } else {
                    console.error(`[Telegraf] Step not found for payload: ${payload}`);
                    await ctx.answerCbQuery('Passo não encontrado.');
                }
                break;

            case 'MAIN_MENU':
                const mainFlow = allFlows.find(f => f.trigger === '/start');
                if (mainFlow) {
                    const startStep = allFlows.flatMap(f => f.steps).find(s => s.id === mainFlow.startStepId);
                    if (startStep) {
                        await executeStep(ctx, startStep);
                    } else {
                        await ctx.answerCbQuery('Fluxo principal não encontrado.');
                    }
                }
                break;
            
            case 'SHOW_PROFILE':
                 const mainFlowForProfile = allFlows.find(f => f.trigger === '/start');
                 const { profileMessage, keyboard } = await generateProfileMessage(db, user, { showBackButton: !!mainFlowForProfile, startStepId: mainFlowForProfile?.startStepId || null });
                 await ctx.editMessageText(profileMessage, { parse_mode: 'MarkdownV2', reply_markup: keyboard });
                 break;

            case 'LINK_TO_PRODUCT':
                const productsCollection = db.collection<Product>('products');
                const salesCollection = db.collection<Sale>('sales');

                if (!payload) {
                    console.error('[Telegraf] LINK_TO_PRODUCT action called without a payload.');
                    return ctx.answerCbQuery('Produto não especificado.');
                }

                const product = await productsCollection.findOne({ tenantId: tenant._id.toString(), _id: new ObjectId(payload) });
                
                if (!product) {
                    console.error(`[Telegraf] Product with ID ${payload} not found for tenant ${tenant._id}`);
                    return ctx.answerCbQuery('Produto não encontrado.');
                }
                
                 let productMessage = `*${escapeMarkdown(product.name)}*\n\n${escapeMarkdown(product.description || '')}\n\n`;
                 const isOfferActive = product.discountPrice != null && product.offerExpiresAt && new Date(product.offerExpiresAt) > new Date();
                 
                 const availableMethods: { name: string; type: 'pix' | 'credit_card'; gateway: string; }[] = [];
                 if (product.paymentMethods?.pix && product.paymentMethods.pix !== 'none') {
                     availableMethods.push({ name: 'PIX', type: 'pix', gateway: product.paymentMethods.pix });
                 }
                 if (product.paymentMethods?.credit_card && product.paymentMethods.credit_card !== 'none') {
                     availableMethods.push({ name: 'Cartão de Crédito', type: 'credit_card', gateway: product.paymentMethods.credit_card });
                     }
 
                 let productKeyboard;
 
                 if (product.price === 0) {
                     productMessage += `*Preço: Grátis\\!*`;
                     productKeyboard = { inline_keyboard: [[{ text: "✅ Obter Agora", callback_data: `ACQUIRE_PRODUCT:${product._id.toString()}` }]] };
                 } else if (availableMethods.length > 0) {
                     const price = isOfferActive ? product.discountPrice! : product.price;
                     const priceString = `*Preço: R$ ${price.toFixed(2).replace('.', ',')}*`;
                     const originalPriceString = isOfferActive ? ` (de ~R$ ${product.price.toFixed(2).replace('.', ',')}~)` : '';
                     productMessage += `${priceString}${originalPriceString}\n\nEscolha como deseja pagar:`;
 
                     const paymentButtons = availableMethods.map(method => ({
                         text: `Pagar com ${method.name}`,
                         callback_data: `BUY_WITH_METHOD:${method.type}:${method.gateway}:${product._id.toString()}`
                     }));
                     productKeyboard = { 
                         inline_keyboard: [
                             paymentButtons,
                             [{ text: '⬅️ Voltar ao Início', callback_data: 'MAIN_MENU' }]
                         ] 
                     };
                 } else {
                     productMessage += `*Produto indisponível para compra no momento\\.*`;
                 }
                 
                await ctx.editMessageText(productMessage, { parse_mode: 'MarkdownV2', reply_markup: productKeyboard });
                break;

            case 'BUY_WITH_METHOD':
             if (!payload) {
                 return ctx.answerCbQuery('Ação inválida.');
             }
             const [method, gateway, productId] = payload.split(':');
             const buyerId = user._id.toString();
             
             await ctx.editMessageText('⏳ Um momento, estamos preparando seu pagamento...');
             
             const productForPurchase = await db.collection<Product>('products').findOne({ _id: new ObjectId(productId), tenantId: tenant._id.toString() });
             
             if (!productForPurchase) {
                 return await ctx.editMessageText('❌ Produto não encontrado.');
             }
             
             const salesCol = db.collection<Sale>('sales');
             let saleForPurchase = await salesCol.findOne({
                 tenantId: tenant._id.toString(),
                 productId: productForPurchase._id.toString(),
                 userId: buyerId,
                 status: 'pending'
             });
 
             let saleId;
 
             if (saleForPurchase) {
                 saleId = saleForPurchase._id.toString();
                 await salesCol.updateOne({ _id: saleForPurchase._id }, { $set: { telegramMessageId: ctx.callbackQuery.message.message_id } });
             } else {
                 const newSale = {
                     _id: new ObjectId(),
                     tenantId: tenant._id.toString(),
                     productId: productForPurchase._id.toString(),
                     userId: buyerId,
                     telegramChatId: ctx.chat.id,
                     telegramMessageId: ctx.callbackQuery.message.message_id,
                     status: 'pending' as 'pending',
                     paymentGateway: gateway,
                     createdAt: new Date(),
                     paymentDetails: {},
                 };
                 const saleResult = await salesCol.insertOne(newSale);
                 saleId = saleResult.insertedId.toString();
                 saleForPurchase = await salesCol.findOne({ _id: saleResult.insertedId });
             }
             
             if (!saleId || !saleForPurchase) {
                 return await ctx.editMessageText('❌ Erro ao criar ou encontrar registro de venda.');
             }
 
             if (gateway === 'mercadopago') {
                 if (method === 'credit_card') {
                     if (saleForPurchase.paymentDetails?.init_point) {
                         return await ctx.editMessageText('✅ Link de pagamento gerado! Clique no botão abaixo para pagar.', {
                              reply_markup: { 
                                  inline_keyboard: [
                                      [{ text: 'Pagar Agora', url: saleForPurchase.paymentDetails.init_point }],
                                      [{ text: '❌ Cancelar Compra', callback_data: `CANCEL_SALE:${saleId}` }]
                                  ] 
                              }
                          });
                     }
 
                     const result = await createMercadoPagoPreference(tenant, productForPurchase, saleId, buyerId);
                     if (result.success && result.init_point && result.preferenceId) {
                         await salesCol.updateOne({ _id: new ObjectId(saleId) }, { $set: { "paymentDetails.init_point": result.init_point, "paymentDetails.preferenceId": result.preferenceId }});
                         await ctx.editMessageText('✅ Link de pagamento gerado! Clique no botão abaixo para pagar.', {
                             reply_markup: { 
                                 inline_keyboard: [
                                     [{ text: 'Pagar Agora', url: result.init_point }],
                                     [{ text: '❌ Cancelar Compra', callback_data: `CANCEL_SALE:${saleId}` }]
                                 ] 
                             }
                         });
                     } else {
                         await ctx.editMessageText(`❌ Erro ao gerar link: ${result.message}`);
                     }
                 } else if (method === 'pix') {
                     if (saleForPurchase.paymentDetails?.qrCode && saleForPurchase.paymentDetails?.qrCodeBase64) {
                         await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
                         const qrCodeBuffer = Buffer.from(saleForPurchase.paymentDetails.qrCodeBase64, 'base64');
                         const pixCaption = `✅ *PIX para ${escapeMarkdown(productForPurchase.name)}*\\!\\n\\nPague com o QR Code ou use o código abaixo\\. Expira em 30 minutos.\\n\\n\`\`\`\n${escapeMarkdown(saleForPurchase.paymentDetails.qrCode)}\n\`\`\``;
                         const photoMessage = await ctx.replyWithPhoto({ source: qrCodeBuffer }, {
                             caption: pixCaption,
                             parse_mode: 'MarkdownV2',
                             reply_markup: { inline_keyboard: [[{ text: '❌ Cancelar Compra', callback_data: `CANCEL_SALE:${saleId}` }]] }
                         });
                         await salesCol.updateOne({ _id: new ObjectId(saleId) }, { $set: { telegramMessageId: photoMessage.message_id } });
                         return;
                     }
 
                      const result = await createMercadoPagoPixPayment(tenant, productForPurchase, saleId, buyerId);
                     
                     if (result.success && result.qrCode && result.qrCodeBase64 && result.paymentId) {
                         await salesCol.updateOne({ _id: new ObjectId(saleId) }, { 
                             $set: { 
                                 "paymentDetails.qrCode": result.qrCode,
                                 "paymentDetails.qrCodeBase64": result.qrCodeBase64,
                                 "paymentDetails.paymentId": result.paymentId,
                             }
                         });
 
                         await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
 
                         const qrCodeBuffer = Buffer.from(result.qrCodeBase64, 'base64');
                         const pixCaption = `✅ *PIX para ${escapeMarkdown(productForPurchase.name)}*\\!\\n\\nPague com o QR Code ou use o código abaixo\\. Expira em 30 minutos.\\n\\n\`\`\`\n${escapeMarkdown(result.qrCode)}\n\`\`\``;
                         
                         const photoMessage = await ctx.replyWithPhoto({ source: qrCodeBuffer }, {
                             caption: pixCaption,
                             parse_mode: 'MarkdownV2',
                             reply_markup: {
                                 inline_keyboard: [
                                     [{ text: '❌ Cancelar Compra', callback_data: `CANCEL_SALE:${saleId}` }]
                                 ]
                             }
                         });
                         await salesCol.updateOne(
                             { _id: new ObjectId(saleId) },
                             { $set: { telegramMessageId: photoMessage.message_id } }
                         );
 
                     } else {
                         await ctx.editMessageText(`❌ Erro ao gerar PIX: ${result.message}`);
                     }
                 }
             }
            break;

            case 'CANCEL_SALE':
                 const saleToCancelId = payload;
                 try {
                     await db.collection('sales').updateOne({ _id: new ObjectId(saleToCancelId) }, { $set: { status: 'cancelled' } });
                     await ctx.deleteMessage();
                     await ctx.answerCbQuery('Compra cancelada!');
                     
                     const startFlow = allFlows.find((f) => f.trigger === '/start');
                     if (startFlow?.startStepId) {
                         const startStep = startFlow.steps.find(s => s.id === startFlow.startStepId);
                         if (startStep) await executeStep(ctx, startStep);
                     }
                 } catch (error) {
                     console.error('Error in cancel_sale:', error);
                     await ctx.answerCbQuery('Erro ao cancelar.', { show_alert: true });
                 }
                 break;
                
            case 'CONFIRM_PAYMENT':
                 const saleIdToConfirm = payload;
                 if (!saleIdToConfirm) {
                     return ctx.answerCbQuery('ID da venda não encontrado.');
                 }
                
                 await ctx.editMessageText('🔍 Verificando seu pagamento... por favor, aguarde um momento.');
                 
                 break;


            default:
                console.warn(`[Telegraf] Unhandled action type: ${actionType}`);
                await ctx.answerCbQuery(`Ação desconhecida: ${actionType}`);
                break;
        }
    });

    bot.use(async (ctx: any, next) => {
        try {
            await next()
        } catch (error) {
            console.error('[Telegraf] Unhandled error in middleware/handler:', error)
        }
    })

    bot.catch((err: any, ctx) => {
        console.error(`[Telegraf] Global error for ${ctx.updateType}`, err);
        
        if (err.response && err.response.description) {
            console.error(`[Telegraf] Telegram API Error: ${err.response.description}`);
        }

        if (ctx.callbackQuery) {
            try {
                ctx.answerCbQuery('Ocorreu um erro, por favor tente novamente.');
                ctx.deleteMessage().catch(e => {
                     if (e.response?.description?.includes('message to delete not found')) {
                        console.log('[Telegraf] Message to delete was already gone.');
                     } else {
                        console.warn('[Telegraf] Failed to delete message on error:', e.response?.description);
                     }
                });
            } catch (e) {
                console.warn('[Telegraf] Failed to send error feedback to user:', e);
            }
        }
    });

    return bot;
}
