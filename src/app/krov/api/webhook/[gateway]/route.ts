import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { KrovSettings, SaasPlan } from '@/lib/types';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { Telegraf } from 'telegraf';

/**
 * Handles webhook notifications from Mercado Pago for Krov (SaaS Admin),
 * reusing the same structure as the client webhook.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { subdomain: string, gateway: string } }
) {
  // Although 'subdomain' is 'krov' here, we keep it for consistency
  const { subdomain, gateway } = params; 
  
  if (!gateway || subdomain !== 'krov') {
    return NextResponse.json({ success: false, message: 'Invalid request.' }, { status: 400 });
  }

  const requestBody = await request.text();

  try {
    const body = JSON.parse(requestBody);
    console.log(`[Krov Webhook] Received notification from gateway: '${gateway}'`);
    
    switch(gateway) {
        case 'mercadopago':
        case 'sandmercadopago': {
            const { MercadoPagoConfig, Payment } = await import('mercadopago');
            const { ObjectId } = await import('mongodb');
            const db = (await clientPromise).db('vematize');
            
            const isSandbox = gateway === 'sandmercadopago';
            console.log(`Processing Krov MP webhook in ${isSandbox ? 'Sandbox' : 'Production'} mode...`);
            
            if (body.type !== 'payment' || !body.data?.id) {
                console.log("[Krov MP Webhook] Not a payment notification. Skipping.");
                return NextResponse.json({ success: true });
            }

            const settings = await db.collection<KrovSettings>('settings').findOne({ _id: 'global' as any });
            if (!settings) {
                console.error(`[Krov MP Webhook] Global Krov settings not found.`);
                return NextResponse.json({ success: false, message: 'Global settings not found.' }, { status: 404 });
            }

            const mpSettings = settings.paymentIntegrations?.mercadopago;
            const secret = isSandbox ? mpSettings?.sandbox_webhook_secret : mpSettings?.production_webhook_secret;

            // Signature validation logic can be added here if needed

            const paymentId = body.data.id;
            const accessToken = isSandbox ? mpSettings?.sandbox_access_token : mpSettings?.production_access_token;

            if (!accessToken) {
                console.error(`[Krov MP Webhook] Access Token not found for ${gateway}.`);
                return NextResponse.json({ success: false, message: 'Access token not configured.' }, { status: 500 });
            }

            const client = new MercadoPagoConfig({ accessToken });
            const payment = new Payment(client);
            const mpPayment = await payment.get({ id: paymentId });

            if (!mpPayment || !mpPayment.external_reference) {
                 console.error(`[Krov MP Webhook] Payment ${paymentId} not found on MP or has no external_reference.`);
                 return NextResponse.json({ success: false, message: 'Payment not found or invalid.' }, { status: 404 });
            }
            
            const tenantId = mpPayment.external_reference; 
            const tenantsCollection = db.collection('tenants');
            const tenant = await tenantsCollection.findOne({ _id: new ObjectId(tenantId) });

            if (!tenant) {
                console.error(`[Krov MP Webhook] Tenant with ID ${tenantId} not found in our DB.`);
                return NextResponse.json({ success: false, message: 'Tenant not found.' }, { status: 404 });
            }

            const newStatus = mpPayment.status === 'approved' ? 'active' : 'inactive';

            if (tenant.subscriptionStatus === 'active') {
                console.log(`[Krov MP Webhook] Tenant ${tenantId} subscription is already active. No action taken.`);
                return NextResponse.json({ success: true });
            }

            if (newStatus === 'active') {
                const planId = mpPayment.items?.[0]?.id;
                const plan = await db.collection<SaasPlan>('plans').findOne({ _id: new ObjectId(planId) });
                
                if (!plan) {
                    console.error(`[Krov MP Webhook] SaaS Plan with ID ${planId} not found.`);
                    return NextResponse.json({ success: false, message: 'Plan not found.' }, { status: 404 });
                }

                const trialEndsAt = new Date();
                trialEndsAt.setDate(trialEndsAt.getDate() + plan.durationDays);

                await tenantsCollection.updateOne(
                    { _id: new ObjectId(tenantId) }, 
                    { 
                        $set: { 
                            subscriptionStatus: 'active',
                            planId: planId,
                            trialEndsAt: trialEndsAt.toISOString(),
                            updatedAt: new Date() 
                        } 
                    }
                );
                console.log(`[Krov MP Webhook] Tenant ${tenantId} subscription updated to status: active`);

            } else {
                console.log(`[Krov MP Webhook] Tenant ${tenantId} subscription payment status is ${mpPayment.status}. No action taken.`);
            }

            return NextResponse.json({ success: true });
        }
        default:
            console.log(`[Krov Webhook] Gateway '${gateway}' not supported.`);
            return NextResponse.json({ success: false, message: 'Gateway not supported' }, { status: 400 });
    }

  } catch (error) {
    console.error('[Krov Webhook] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
} 