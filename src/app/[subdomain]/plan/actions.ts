'use server';

import clientPromise from '@/lib/mongodb';
import type { SaasPlan, Tenant, KrovSettings, MercadoPagoSettings } from '@/lib/types';
import { ObjectId } from 'mongodb';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { headers } from 'next/headers';
import { Telegraf } from 'telegraf';

export type CurrentPlanInfo = {
  status: string;
  statusLabel: string;
  planName: string;
  price: number;
  features: string[];
  expiresAt: string | null;
  expiresAtLabel: string;
  planId: string | null;
};

// Internal Document Types
type SaasPlanDocument = Omit<SaasPlan, 'id'> & { _id: ObjectId };
type TenantDocument = Omit<Tenant, 'id'> & { _id: ObjectId };
type SubscriptionDocument = {
    _id: ObjectId;
    tenantId: ObjectId;
    planId: ObjectId;
    status: 'pending' | 'active' | 'cancelled' | 'failed';
    paymentGateway: string;
    gatewayRefId?: string; // The ID from Mercado Pago (payment id, preference id)
    createdAt: Date;
    paidAt?: Date;
    expiresAt?: Date;
  }

async function processApprovedSubscription(db: any, subscription: SubscriptionDocument) {
    if (subscription.status === 'active') {
        console.log(`[Subscription] Subscription ${subscription._id} is already active.`);
        return;
    }

    const plan = await db.collection('plans').findOne({ _id: subscription.planId });
    const tenant = await db.collection('tenants').findOne({ _id: subscription.tenantId });

    if (!plan || !tenant) {
        console.error(`[Subscription] Plan or Tenant not found for subscription ${subscription._id}`);
        throw new Error('Could not find plan or tenant for the subscription.');
    }
    
    const now = new Date();
    const subscriptionEndDate = new Date(now);
    subscriptionEndDate.setDate(subscriptionEndDate.getDate() + plan.durationDays);

    await db.collection('tenants').updateOne(
        { _id: subscription.tenantId },
        { 
            $set: { 
                planId: plan._id.toString(),
                subscriptionStatus: 'active',
                subscriptionEndsAt: subscriptionEndDate,
            }
        }
    );
    
    await db.collection('subscriptions').updateOne(
        { _id: subscription._id },
        { 
            $set: { 
                status: 'active', 
                paidAt: now,
                expiresAt: subscriptionEndDate
            } 
        }
    );

    console.log(`[Subscription] Tenant ${tenant.subdomain} successfully subscribed to plan ${plan.name}. Subscription ends on ${subscriptionEndDate.toISOString()}`);
    
    const krovSettings = await db.collection('settings').findOne({ _id: 'global' as any });
    const botToken = krovSettings?.notifications?.telegram?.bot_token;
    const chatId = krovSettings?.notifications?.telegram?.chat_id;

    if (botToken && chatId) {
        const bot = new Telegraf(botToken);
        const message = `
✅ **Nova Assinatura Ativada!**
--------------------------------
**Plataforma:** ${tenant.subdomain}
**Plano:** ${plan.name}
**Valor:** R$ ${plan.price.toFixed(2)}
**Expira em:** ${subscriptionEndDate.toLocaleDateString('pt-BR')}
        `;
        try {
            await bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (e) {
            console.error('[Telegram] Failed to send subscription notification:', e);
        }
    }
}

export async function checkSubscriptionStatus(subscriptionId: string): Promise<{ success: boolean; status?: string; message?: string }> {
    try {
        const client = await clientPromise;
        const db = client.db('vematize');
        const subscriptionsCollection = db.collection<SubscriptionDocument>('subscriptions');
        
        const subscription = await subscriptionsCollection.findOne({ _id: new ObjectId(subscriptionId) });

        if (!subscription) {
            return { success: false, message: 'Assinatura não encontrada.' };
        }
        
        if (subscription.status === 'active') {
            return { success: true, status: 'active', message: 'Assinatura já está ativa!' };
        }
        
        const settings = await db.collection<KrovSettings>('settings').findOne({ _id: 'global' as any });
        const mpSettings = settings?.paymentIntegrations?.mercadopago;
        if (!mpSettings) throw new Error('Gateway de pagamento não configurado.');
        
        const accessToken = mpSettings.mode === 'sandbox' ? mpSettings.sandbox_access_token : mpSettings.production_access_token;
        if (!accessToken) throw new Error('Access token do Mercado Pago não configurado.');

        const mpClient = new MercadoPagoConfig({ accessToken });
        const paymentClient = new Payment(mpClient);

        const payment = await paymentClient.get({ id: subscription.gatewayRefId! });

        if (payment.status === 'approved') {
            await processApprovedSubscription(db, subscription);
            return { success: true, status: 'active', message: 'Pagamento confirmado e assinatura ativada!' };
        } else {
            return { success: false, status: payment.status, message: `Pagamento ainda não foi aprovado (Status: ${payment.status}).` };
        }

    } catch (error) {
        console.error("Error checking subscription status:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return { success: false, message: errorMessage };
    }
}

export async function getPendingSubscription(subdomain: string): Promise<SubscriptionDocument | null> {
    try {
        const client = await clientPromise;
        const db = client.db('vematize');
        
        const tenant = await db.collection<TenantDocument>('tenants').findOne({ subdomain });
        if (!tenant) {
            console.log(`[Pending Check] Tenant not found for subdomain: ${subdomain}`);
            return null;
        }

        // Find the most recent pending subscription created in the last 35 minutes
        const thirtyFiveMinutesAgo = new Date(new Date().getTime() - 35 * 60 * 1000);

        const pendingSubscription = await db.collection<SubscriptionDocument>('subscriptions').findOne({
            tenantId: tenant._id,
            status: 'pending',
            createdAt: { $gte: thirtyFiveMinutesAgo }
        }, { sort: { createdAt: -1 } });

        if (!pendingSubscription) {
            return null;
        }
        
        // Return a serializable object
        return JSON.parse(JSON.stringify(pendingSubscription));

    } catch (error) {
        console.error("Error fetching pending subscription:", error);
        return null;
    }
}

export async function getAvailablePlans(): Promise<SaasPlan[]> {
    try {
        const client = await clientPromise;
        const db = client.db('vematize');
        const plansCollection = db.collection<SaasPlanDocument>('plans');
        
        const plans = await plansCollection.find({ isActive: true }).sort({ price: 1 }).toArray();
        
        // Serialize MongoDB objects to plain objects
        return plans.map(plan => ({
            id: plan._id.toString(),
            name: plan.name,
            price: plan.price,
            durationDays: plan.durationDays,
            features: plan.features || [],
            isActive: plan.isActive
        }));
    } catch (error) {
        console.error('Database Error fetching available plans:', error);
        return [];
    }
}

export async function getCurrentPlanInfo(subdomain: string): Promise<CurrentPlanInfo> {
  try {
    const client = await clientPromise;
    const db = client.db('vematize');
    const tenantsCollection = db.collection<TenantDocument>('tenants');
    
    const tenant = await tenantsCollection.findOne({ subdomain });

    if (!tenant) {
      return {
        status: 'none',
        statusLabel: 'Nenhum plano encontrado',
        planName: 'Plano de Teste Gratuito',
        price: 0,
        features: [
          'Acesso ao WhatsApp',
          'Acesso ao Instagram',
          'Acesso ao Telegram',
          'Gestão de usuários completa',
          'Dashboard de estatísticas',
          'Suporte prioritário',
          'Relatórios de vendas',
        ],
        expiresAt: null,
        expiresAtLabel: 'Data de expiração: N/A',
        planId: null,
      };
    }

    let plan: SaasPlan | null = null;
    if (tenant.planId) {
      const plansCollection = db.collection<SaasPlanDocument>('plans');
      const planDoc = await plansCollection.findOne({ _id: new ObjectId(tenant.planId) });
      if (planDoc) {
        plan = {
            id: planDoc._id.toString(),
          name: planDoc.name,
          price: planDoc.price,
          durationDays: planDoc.durationDays,
          features: planDoc.features || [],
          isActive: planDoc.isActive
        };
      }
    }

    const status = tenant.subscriptionStatus || 'inactive';
    let statusLabel = 'Inativo';
    let expiresAt = null;
    let expiresAtLabel = '';
    let planId = tenant.planId || null;

    if (status === 'trialing') {
      statusLabel = 'Em Teste';
      expiresAt = tenant.trialEndsAt || null;
      expiresAtLabel = expiresAt 
        ? `Seu teste expira em: ${new Date(expiresAt).toLocaleDateString('pt-BR')}`
        : 'Data de expiração: N/A';
    } else if (status === 'active') {
      statusLabel = 'Ativo';
      expiresAt = tenant.subscriptionEndsAt || null;
      expiresAtLabel = expiresAt 
        ? `Sua assinatura expira em: ${new Date(expiresAt).toLocaleDateString('pt-BR')}`
        : 'Renovação: (Em breve)';
    } else {
      statusLabel = 'Expirado ou Inativo';
      expiresAtLabel = 'Seu plano não está ativo.';
    }

    return {
      status,
      statusLabel,
      planName: plan?.name || 'Plano de Teste Gratuito',
      price: plan?.price || 0,
      features: plan?.features || [
        'Acesso ao WhatsApp',
        'Acesso ao Instagram',
        'Acesso ao Telegram',
        'Gestão de usuários completa',
        'Dashboard de estatísticas',
        'Suporte prioritário',
        'Relatórios de vendas',
      ],
      expiresAt,
      expiresAtLabel,
      planId,
    };
  } catch (error) {
    console.error('Database Error fetching current plan:', error);
    return {
      status: 'none',
      statusLabel: 'Erro ao carregar',
      planName: 'Indisponível',
      price: 0,
      features: [],
      expiresAt: null,
      expiresAtLabel: 'Não foi possível carregar os dados do plano.',
      planId: null,
    };
  }
}

export async function createSubscriptionPayment(
    planId: string, 
    subdomain: string, 
    paymentMethod: 'pix' | 'card'
): Promise<{ init_point?: string; qrCode?: string; qrCodeBase64?: string; subscriptionId?: string; error?: string }> {
    'use server';

    try {
        const client = await clientPromise;
        const db = client.db('vematize');

        // Platform subscriptions are paid to the Krov admin, so we use global settings
        const settings = await db.collection<KrovSettings>('settings').findOne({ _id: 'global' as any });
        const mpSettings = settings?.paymentIntegrations?.mercadopago;
        
        if (!mpSettings) {
            throw new Error('O administrador do sistema não configurou um gateway de pagamento.');
        }

        const isSandbox = mpSettings.mode === 'sandbox';
        const accessToken = isSandbox ? mpSettings.sandbox_access_token : mpSettings.production_access_token;
        const gatewayName = isSandbox ? 'sandmercadopago' : 'mercadopago';

        if (!accessToken) {
            throw new Error('As credenciais do gateway de pagamento não foram configuradas.');
        }

        const newPlan = await db.collection<SaasPlanDocument>('plans').findOne({ _id: new ObjectId(planId) });
        if (!newPlan) {
            throw new Error('O plano selecionado não foi encontrado.');
        }

        const tenant = await db.collection<TenantDocument>('tenants').findOne({ subdomain });
        if (!tenant) {
            throw new Error('Sua conta de usuário (tenant) não foi encontrada.');
        }

        let price = newPlan.price;
        let title = `Plano ${newPlan.name} - Vematize`;

        // Handle upgrade logic
        if (tenant.planId && tenant.subscriptionStatus === 'active' && tenant.subscriptionEndsAt) {
            const currentPlan = await db.collection<SaasPlanDocument>('plans').findOne({ _id: new ObjectId(tenant.planId) });
            if (currentPlan && newPlan.price > currentPlan.price) {
                const now = new Date();
                const endDate = new Date(tenant.subscriptionEndsAt);
                const remainingTime = endDate.getTime() - now.getTime();
                if (remainingTime > 0) {
                    const totalDaysInCycle = newPlan.durationDays;
                    const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
                    
                    const oldPlanDailyRate = currentPlan.price / currentPlan.durationDays;
                    const newPlanDailyRate = newPlan.price / newPlan.durationDays;
                    
                    const remainingValueOnOldPlan = oldPlanDailyRate * remainingDays;
                    const costForNewPlanForRemainingDays = newPlanDailyRate * remainingDays;

                    const proratedPrice = costForNewPlanForRemainingDays - remainingValueOnOldPlan;
                    price = Math.max(0, proratedPrice);
                    title = `Upgrade para o Plano ${newPlan.name} (Proporcional)`;
                }
            }
        }
        
        if (price <= 0) {
            // This could happen on a free plan or if proration results in 0
            // Here you might want to just activate the plan directly without payment
            // For now, we'll throw an error if payment is attempted for a zero-value transaction.
             throw new Error("Não é possível processar um pagamento com valor zero.");
        }

        const subscriptionsCollection = db.collection<SubscriptionDocument>('subscriptions');
        const newSubscriptionData: Omit<SubscriptionDocument, '_id'> = {
            tenantId: tenant._id,
            planId: newPlan._id,
            status: 'pending',
            paymentGateway: gatewayName,
            createdAt: new Date(),
        };
        const newSubscription = await subscriptionsCollection.insertOne(newSubscriptionData as SubscriptionDocument);
        const subscriptionId = newSubscription.insertedId;

        const mpClient = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
        
        const h = headers();
        const host = h.get('host');
        if (!host) {
            throw new Error("Não foi possível determinar o host da aplicação.");
        }
        // Robust protocol detection for ngrok/proxies
        const protocol = h.get('x-forwarded-proto') || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
        const notification_url = `${protocol}://${host}/krov/api/webhook/${gatewayName}`;

        if (paymentMethod === 'card') {
            const preferenceClient = new Preference(mpClient);
            const back_urls = {
                success: mpSettings.success_url || `${protocol}://${host}/${subdomain}/plan/return?status=success`,
                failure: mpSettings.failure_url || `${protocol}://${host}/${subdomain}/plan/return?status=failure`,
                pending: mpSettings.pending_url || `${protocol}://${host}/${subdomain}/plan/return?status=pending`,
            };

            const expirationDate = new Date();
            expirationDate.setMinutes(expirationDate.getMinutes() + 30);

            const preferenceBody = {
                items: [{
                    id: newPlan._id.toString(),
                    title: title,
                    description: `Assinatura do plano ${newPlan.name}`,
                        quantity: 1,
                    unit_price: price,
                        currency_id: 'BRL',
                }],
                payer: {
                    email: tenant.ownerEmail,
                    name: tenant.ownerName || tenant.subdomain, // Fallback for payer name
                },
                external_reference: subscriptionId.toString(),
                back_urls: back_urls,
                auto_return: 'approved',
                notification_url: notification_url,
                expires: true,
                date_of_expiration: expirationDate.toISOString(),
            };

            console.log("[MP Pref Body]", JSON.stringify(preferenceBody, null, 2));

            const preference = await preferenceClient.create({ body: preferenceBody });

            await subscriptionsCollection.updateOne({ _id: subscriptionId }, { $set: { gatewayRefId: preference.id } });
            return { init_point: preference.init_point, subscriptionId: subscriptionId.toString() };

        } else { // PIX
            const paymentClient = new Payment(mpClient);
            const expirationDate = new Date();
            expirationDate.setMinutes(expirationDate.getMinutes() + 30); // 30 min expiration

            const pixPayment = await paymentClient.create({
                body: {
                    transaction_amount: price,
                    description: title,
                    payment_method_id: 'pix',
                    payer: { email: tenant.ownerEmail, first_name: tenant.ownerName || 'Comprador', last_name: 'Vematize' },
                    external_reference: subscriptionId.toString(),
                    notification_url: notification_url,
                    date_of_expiration: expirationDate.toISOString(),
                }
            });
            
            await subscriptionsCollection.updateOne({ _id: subscriptionId }, { $set: { gatewayRefId: pixPayment.id?.toString() } });

            return {
                qrCode: pixPayment.point_of_interaction?.transaction_data?.qr_code,
                qrCodeBase64: pixPayment.point_of_interaction?.transaction_data?.qr_code_base64,
                subscriptionId: subscriptionId.toString(),
            };
        }

    } catch (error) {
        console.error("Error creating subscription preference:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return { error: errorMessage };
    }
}
