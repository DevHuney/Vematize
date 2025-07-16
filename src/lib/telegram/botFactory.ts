import { Telegraf, Scenes, session, Markup } from 'telegraf';
import clientPromise from '@/lib/mongodb';
import { BotConfigSchema } from '@/lib/schemas';
import type { Tenant, BotStep, BotButton, Product, Purchase, User, Sale } from '@/lib/types';
import { z } from 'zod';
import { Db, ObjectId } from 'mongodb';
import { createMercadoPagoPreference, createMercadoPagoPixPayment } from '@/lib/mercadopago';

/**
 * Escapes characters for Telegram's MarkdownV2 parse mode.
 * @param text The text to escape.
 * @returns The escaped text.
 */
function escapeMarkdown(text: string): string {
  if (!text) return '';
  // List of characters to escape in MarkdownV2
  const charsToEscape = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
  return charsToEscape.reduce((acc, char) => acc.replace(new RegExp('\\' + char, 'g'), '\\' + char), text);
}

// Helper to replace placeholders like {userName}
function replacePlaceholders(text: string, from: any): string {
    if (!text) return '';
    return text.replace(/{userName}/g, from?.first_name || 'usuário');
}

// Helper to build keyboards
function buildKeyboard(buttons: BotButton[] | undefined): { inline_keyboard: { text: string; callback_data: string; }[][]; } | undefined {
    if (!buttons || buttons.length === 0) {
        return undefined;
    }
    const keyboard = buttons.map(button => {
        const action = button.action;
        // If there's a payload, format it with the type. Otherwise, just use the type.
        const callback_data = action.payload ? `${action.type}:${action.payload}` : action.type;
        return [{ text: button.text, callback_data }];
    });
    return { inline_keyboard: keyboard };
}

// Generic function to display any step
async function executeStep(ctx: any, step: BotStep) {
    const messageText = replacePlaceholders(step.message, ctx.from);
    const keyboard = buildKeyboard(step.buttons);

    // Escape message for MarkdownV2
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

// Helper function to generate the profile message and keyboard
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

    // --- MIDDLEWARE ---
    bot.use(async (ctx: any, next) => {
        // Evita buscas repetidas no banco de dados se o tenant já foi anexado
        if (ctx.tenant) {
            // Se o tenant já foi verificado e está inativo, não faz nada.
            if (ctx.tenant.subscriptionStatus === 'inactive') return;
            return next();
        }
        
        const client = await clientPromise;
        const db = client.db('vematize');
        const tenant = await db.collection<Tenant>('tenants').findOne({ "connections.telegram.botToken": token });
        
        if (!tenant) {
            console.warn(`[Telegraf] Tenant não encontrado para o token ${token.substring(0, 10)}...`);
            // Se não encontrar o tenant, configura uma resposta padrão e para.
            bot.on('message', ctx => ctx.reply('Este bot não está configurado corretamente.'));
            bot.on('callback_query', ctx => ctx.answerCbQuery('Bot não configurado.'));
            return;
        }

        ctx.tenant = tenant;
        console.log(`[Telegraf] Tenant '${tenant.subdomain}' encontrado para o token prefix ${token.substring(0, 10)}...`);

        // **VERIFICAÇÃO DA ASSINATURA**
        if (tenant.subscriptionStatus === 'inactive') {
            console.log(`[Telegraf] Tenant '${tenant.subdomain}' está INATIVO. Bloqueando bot.`);
            const inactiveMessage = tenant.botConfig?.inactiveSubscriptionMessage || 'Este serviço foi temporariamente suspenso. Por favor, contate o administrador.';
            
            // Substitui todos os handlers por uma única resposta de "inativo".
            bot.on('message', ctx => ctx.reply(inactiveMessage));
            bot.on('callback_query', ctx => ctx.answerCbQuery(inactiveMessage));
            
            // Para a execução, impedindo que outros middlewares ou handlers rodem.
            return;
        }

        return next();
    });

    // --- COMANDOS ---

    // Generic command handler
    bot.on('text', async (ctx: any) => {
        const command = ctx.message.text;
        if (!command || !command.startsWith('/')) {
            return; // Not a command, ignore
        }
        
        console.log(`[Telegraf] Received command "${command}" for chat ID: ${ctx.chat.id}`);
        const tenant = ctx.tenant;
        if (!tenant) {
            return ctx.reply("Olá! Este bot ainda não foi ativado.");
        }

        // Upsert user on any command interaction
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
             // Handle the specific /perfil command separately
            if (command === '/perfil') {
                const db = (await clientPromise).db('vematize');
                const user = await db.collection<User>('users').findOne({ telegramId: ctx.from.id, tenantId: tenant._id.toString() });

                if (!user) return ctx.reply("Não encontrei seu perfil. Interaja com o bot primeiro para se registrar.");
                
                // Find the main flow (e.g., /start) to get a potential "back" button target
                const mainFlow = botConfig.flows.find((f: z.infer<typeof import('@/lib/schemas').BotFlowSchema>) => f.trigger === '/start');
                const { profileMessage, keyboard } = await generateProfileMessage(db, user, { showBackButton: !!mainFlow, startStepId: mainFlow?.startStepId || null });
        
                await ctx.reply(profileMessage, { parse_mode: 'MarkdownV2', reply_markup: keyboard });
            } else {
                console.log(`[Telegraf] No flow found for command "${command}".`);
                return ctx.reply("Comando não reconhecido.");
            }
        }
    });

    // --- ACTIONS ---

    bot.on('callback_query', async (ctx: any) => {
        const data = ctx.callbackQuery.data;
        const tenant = ctx.tenant as Tenant;
        
        console.log(`[Telegraf] Received callback_query with data: "${data}"`);

        if (!tenant) {
            return ctx.reply("Este bot não está configurado corretamente (Tenant não encontrado).");
        }
        
        const parseResult = BotConfigSchema.safeParse(tenant.botConfig);
        if (!parseResult.success) {
            return ctx.reply("Este bot não está configurado corretamente (Configuração inválida).");
        }
        const botConfig = parseResult.data;

        const db = (await clientPromise).db('vematize');
        
        // Handle actions with and without payloads
        let actionType: string;
        let actionPayload: string | undefined;

        if (data.includes(':')) {
            [actionType, actionPayload] = data.split(/:(.+)/);
        } else {
            actionType = data;
        }

        if (actionType === 'SHOW_PROFILE') {
            const user = await db.collection<User>('users').findOne({ telegramId: ctx.from.id, tenantId: tenant._id.toString() });
            
            if (!user) return ctx.answerCbQuery('Usuário não encontrado.');

            const mainFlow = botConfig.flows.find((f: z.infer<typeof import('@/lib/schemas').BotFlowSchema>) => f.trigger === '/start');
            const { profileMessage, keyboard } = await generateProfileMessage(db, user, { 
                showBackButton: true, 
                startStepId: mainFlow?.startStepId || null
            });

            try {
                await ctx.editMessageText(profileMessage, { parse_mode: 'MarkdownV2', reply_markup: keyboard });
            } catch (e: any) {
                console.error(`[Telegraf] Failed to edit message for SHOW_PROFILE:`, e.response?.description || e);
                await ctx.answerCbQuery('Erro ao mostrar o perfil.');
            }

        } else if (actionType === 'DELETE_DATA_CONFIRM') {
            const message = '⚠️ *Atenção\\!*\\n\\nVocê tem certeza que deseja deletar todos os seus dados associados a este bot\\?\\n\\n*Esta ação é irreversível\\.*';
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: 'Sim, deletar agora', callback_data: 'DELETE_DATA_EXECUTE' },
                        { text: 'Não, voltar', callback_data: 'SHOW_PROFILE' }
                    ]
                ]
            };
            await ctx.editMessageText(message, { parse_mode: 'MarkdownV2', reply_markup: keyboard });

        } else if (actionType === 'DELETE_DATA_EXECUTE') {
            const tenant = ctx.tenant;
            const db = (await clientPromise).db('vematize');
            
            await ctx.editMessageText('Deletando seus dados... ⏳');

            const result = await db.collection('users').deleteOne({ telegramId: ctx.from.id, tenantId: tenant._id.toString() });

            if (result.deletedCount > 0) {
                await ctx.editMessageText('✅ Seus dados foram removidos com sucesso. Use /start para começar de novo.');
            } else {
                await ctx.editMessageText('❌ Não foi possível remover seus dados. Pode ser que eles já tenham sido removidos.');
            }
        
        } else if (actionType === 'GO_TO_STEP') {
            if (!actionPayload) {
                return ctx.answerCbQuery('Ação inválida.');
            }
            // Find the step across all flows
            let targetStep: BotStep | undefined;
            for (const flow of botConfig.flows) {
                const step = flow.steps.find((s: BotStep) => s.id === actionPayload);
                if (step) {
                    targetStep = step;
                    break;
                }
            }

            if (targetStep) {
                await executeStep(ctx, targetStep);
            } else {
                console.warn(`[Telegraf] Step with ID ${actionPayload} not found in any flow.`);
                await ctx.answerCbQuery("Este botão parece estar desatualizado.", { show_alert: true });
            }
        } else if (actionType === 'LINK_TO_PRODUCT') {
            if (!actionPayload || !ObjectId.isValid(actionPayload)) {
                return ctx.reply("Erro: ID de produto inválido.");
            }
            
            const product = await db.collection<Product>('products').findOne({ 
                _id: new ObjectId(actionPayload), 
                tenantId: tenant._id.toString() 
            });

            if (product) {
                console.log(`[Telegraf] Found product: ${product.name}`);
                
                let productMessage = `*${product.name}*\n\n${product.description || ''}\n\n`;
                const isOfferActive = product.discountPrice != null && product.offerExpiresAt && new Date(product.offerExpiresAt) > new Date();
                
                const availableMethods: { name: string; type: 'pix' | 'credit_card'; gateway: string; }[] = [];
                if (product.paymentMethods?.pix && product.paymentMethods.pix !== 'none') {
                    availableMethods.push({ name: 'PIX', type: 'pix', gateway: product.paymentMethods.pix });
                }
                if (product.paymentMethods?.credit_card && product.paymentMethods.credit_card !== 'none') {
                    availableMethods.push({ name: 'Cartão de Crédito', type: 'credit_card', gateway: product.paymentMethods.credit_card });
                }

                let keyboard;

                if (product.price === 0) {
                    productMessage += `*Preço: Grátis!*\n\nClique abaixo para obter.`;
                    keyboard = { inline_keyboard: [[{ text: "✅ Obter Agora", callback_data: `ACQUIRE_PRODUCT:${product._id.toString()}` }]] };
                } else if (availableMethods.length > 0) {
                    const price = isOfferActive ? product.discountPrice! : product.price;
                    const priceString = `*Preço: R$ ${price.toFixed(2).replace('.', ',')}*`;
                    const originalPriceString = isOfferActive ? ` (de ~R$ ${product.price.toFixed(2).replace('.', ',')}~)` : '';
                    productMessage += `${priceString}${originalPriceString}\n\nEscolha como deseja pagar:`;

                    const paymentButtons = availableMethods.map(method => ({
                        text: `Pagar com ${method.name}`,
                        callback_data: `BUY_WITH_METHOD:${method.type}:${method.gateway}:${product._id.toString()}`
                    }));
                    keyboard = { 
                        inline_keyboard: [
                            paymentButtons,
                            [{ text: '⬅️ Voltar ao Início', callback_data: 'START_OVER' }]
                        ] 
                    };
                } else {
                    productMessage += `*Produto indisponível para compra no momento.*`;
                }
                
                    await ctx.editMessageText(productMessage, { parse_mode: 'Markdown', reply_markup: keyboard });

            } else {
                await ctx.reply("Produto não encontrado.");
            }
        } else if (actionType === 'BUY_WITH_METHOD') {
            if (!actionPayload) {
                return ctx.answerCbQuery('Ação inválida.');
            }
            const [method, gateway, productId] = actionPayload.split(':');
            const buyerId = ctx.from.id;
            
            await ctx.editMessageText('⏳ Um momento, estamos preparando seu pagamento...');
            
            const productsCollection = db.collection<Product>('products');
            const product = await productsCollection.findOne({ _id: new ObjectId(productId), tenantId: tenant._id.toString() });

            if (!product) {
                return await ctx.editMessageText('❌ Produto não encontrado.');
            }

            const salesCollection = db.collection('sales');
            let sale = await salesCollection.findOne({
                tenantId: tenant._id.toString(),
                productId: product._id.toString(),
                userId: buyerId.toString(),
                status: 'pending'
            });

            let saleId;

            if (sale) {
                console.log(`[Telegraf] Venda pendente encontrada: ${sale._id.toString()}`);
                saleId = sale._id.toString();
                // Atualiza o messageId para que possamos editar a mensagem correta
                await salesCollection.updateOne({ _id: sale._id }, { $set: { telegramMessageId: ctx.callbackQuery.message.message_id } });
            } else {
                const newSale = {
                    tenantId: tenant._id.toString(),
                    productId: product._id.toString(),
                    userId: buyerId.toString(),
                    telegramChatId: ctx.chat.id,
                    telegramMessageId: ctx.callbackQuery.message.message_id,
                    status: 'pending',
                    paymentGateway: gateway,
                    createdAt: new Date(),
                    paymentDetails: {}, // Objeto para armazenar detalhes do pagamento
                };
                const saleResult = await salesCollection.insertOne(newSale);
                saleId = saleResult.insertedId.toString();
                sale = await salesCollection.findOne({ _id: saleResult.insertedId }) as (Sale | null); // Recarrega a venda para ter todos os dados
                console.log(`[Telegraf] Nova venda criada: ${saleId}`);
            }

            if (!sale) {
                return await ctx.editMessageText('❌ Erro ao criar ou encontrar registro de venda.');
            }

            if (gateway === 'mercadopago') {
                if (method === 'credit_card') {
                    // Reutiliza o link de pagamento se já existir
                    if (sale.paymentDetails?.init_point) {
                        console.log(`[Telegraf] Reutilizando link de pagamento para a venda ${saleId}`);
                        return await ctx.editMessageText('✅ Link de pagamento gerado! Clique no botão abaixo para pagar.', {
                             reply_markup: { 
                                 inline_keyboard: [
                                     [{ text: 'Pagar Agora', url: sale.paymentDetails.init_point }],
                                     [{ text: '❌ Cancelar Compra', callback_data: `cancel_sale:${saleId}` }]
                                 ] 
                             }
                         });
                    }

                    const result = await createMercadoPagoPreference(tenant, product, saleId, buyerId.toString());
                    if (result.success && result.init_point) {
                        await salesCollection.updateOne({ _id: new ObjectId(saleId) }, { $set: { "paymentDetails.init_point": result.init_point, "paymentDetails.preferenceId": result.preferenceId }});
                        await ctx.editMessageText('✅ Link de pagamento gerado! Clique no botão abaixo para pagar.', {
                            reply_markup: { 
                                inline_keyboard: [
                                    [{ text: 'Pagar Agora', url: result.init_point }],
                                    [{ text: '❌ Cancelar Compra', callback_data: `cancel_sale:${saleId}` }]
                                ] 
                            }
                        });
                    } else {
                        await ctx.editMessageText(`❌ Erro ao gerar link: ${result.message}`);
                    }
                } else if (method === 'pix') {
                    if (sale.paymentDetails?.qrCode && sale.paymentDetails?.qrCodeBase64) {
                        console.log(`[Telegraf] Reutilizando PIX para a venda ${saleId}`);
                        await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
                        const qrCodeBuffer = Buffer.from(sale.paymentDetails.qrCodeBase64, 'base64');
                        const pixCaption = `✅ *PIX para ${product.name}!*\n\nPague com o QR Code ou use o código abaixo. Expira em 30 minutos.\n\n\`\`\`\n${sale.paymentDetails.qrCode}\n\`\`\``;
                        const photoMessage = await ctx.replyWithPhoto({ source: qrCodeBuffer }, {
                            caption: pixCaption,
                            parse_mode: 'Markdown',
                            reply_markup: { inline_keyboard: [[{ text: '❌ Cancelar Compra', callback_data: `cancel_sale:${saleId}` }]] }
                        });
                        await salesCollection.updateOne({ _id: new ObjectId(saleId) }, { $set: { telegramMessageId: photoMessage.message_id } });
                        return;
                    }

                     const result = await createMercadoPagoPixPayment(tenant, product, saleId, buyerId.toString());
                    
                    if (result.success && result.qrCode && result.qrCodeBase64) {
                        await salesCollection.updateOne({ _id: new ObjectId(saleId) }, { 
                            $set: { 
                                "paymentDetails.qrCode": result.qrCode,
                                "paymentDetails.qrCodeBase64": result.qrCodeBase64,
                                "paymentDetails.paymentId": result.paymentId,
                            }
                        });

                        await ctx.deleteMessage(ctx.callbackQuery.message.message_id);

                        const qrCodeBuffer = Buffer.from(result.qrCodeBase64, 'base64');
                        const pixCaption = `✅ *PIX para ${product.name}!*\n\nPague com o QR Code ou use o código abaixo. Expira em 30 minutos.\n\n\`\`\`\n${result.qrCode}\n\`\`\``;
                        
                        const photoMessage = await ctx.replyWithPhoto({ source: qrCodeBuffer }, {
                            caption: pixCaption,
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '❌ Cancelar Compra', callback_data: `cancel_sale:${saleId}` }]
                                ]
                            }
                        });

                        await salesCollection.updateOne(
                            { _id: new ObjectId(saleId) },
                            { $set: { telegramMessageId: photoMessage.message_id } }
                        );

                    } else {
                        await ctx.editMessageText(`❌ Erro ao gerar PIX: ${result.message}`);
                    }
                }
            }
        } else if (actionType === 'cancel_sale') {
            const saleId = actionPayload;
            try {
                await db.collection('sales').updateOne({ _id: new ObjectId(saleId) }, { $set: { status: 'cancelled' } });
                await ctx.deleteMessage();
                await ctx.answerCbQuery('Compra cancelada!');
                
                const startFlow = botConfig.flows.find((f) => f.trigger === '/start');
                if (startFlow?.startStepId) {
                    const startStep = startFlow.steps.find(s => s.id === startFlow.startStepId);
                    if (startStep) await executeStep(ctx, startStep);
                }
            } catch (error) {
                console.error('Error in cancel_sale:', error);
                await ctx.answerCbQuery('Erro ao cancelar.', { show_alert: true });
                const startFlow = botConfig.flows.find((f) => f.trigger === '/start');
                if (startFlow?.startStepId) {
                    const startStep = startFlow.steps.find(s => s.id === startFlow.startStepId);
                    if (startStep) await executeStep(ctx, startStep);
                }
            }
        } else if (actionType === 'START_OVER') {
            try {
                await ctx.deleteMessage();
                const startFlow = botConfig.flows.find((f) => f.trigger === '/start');
                if (startFlow?.startStepId) {
                    const startStep = startFlow.steps.find(s => s.id === startFlow.startStepId);
                    if (startStep) {
                        await executeStep(ctx, startStep);
                    } else {
                        await ctx.reply('O fluxo principal de reinício não foi encontrado.');
                    }
                }
            } catch (error) {
                console.error('Error in START_OVER:', error);
                // If deleting fails, try editing as a fallback
                const startFlow = botConfig.flows.find((f) => f.trigger === '/start');
                 if (startFlow?.startStepId) {
                    const startStep = startFlow.steps.find(s => s.id === startFlow.startStepId);
                    if (startStep) await executeStep(ctx, startStep);
                }
            }
        }
    });
    
    return bot;
}
