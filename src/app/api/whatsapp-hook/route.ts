import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import type { Tenant } from '@/lib/types';
import { handleWhatsappMessage } from '@/lib/whatsapp/botFactory';

// This is the webhook handler for Evolution API
export async function POST(request: Request) {
    console.log("[Webhook Route] Received a request at /api/whatsapp-hook.");

    try {
        const payload = await request.json();
        console.log("[Webhook Payload]", JSON.stringify(payload, null, 2));

        const { instance, event, data } = payload;

        if (!instance) {
            console.error('[Webhook Error] Instance not found in payload');
            return NextResponse.json({ success: false, message: 'Instance not found' }, { status: 400 });
        }

        // Find the tenant associated with this instance
        const client = await clientPromise;
        const db = client.db('vematize');
        const tenant = await db.collection<Tenant>('tenants').findOne({ 'connections.whatsapp.evolutionApiInstance': instance });

        if (!tenant) {
            console.error(`[Webhook Error] Tenant not found for instance: ${instance}`);
            // Return 200 OK to prevent Evolution API from retrying
            return NextResponse.json({ success: true, message: 'Tenant not found, but acknowledged.' });
        }

        // Handle different event types
        switch (event) {
            case 'messages.upsert':
                // Ignore messages sent by the bot itself
                if (data.key.fromMe) {
                    console.log(`[Webhook] Ignoring message from self for instance ${instance}`);
                    break;
                }
                
                const message = data.message?.conversation || data.message?.extendedTextMessage?.text || '';
                const senderId = data.key?.remoteJid;
                const senderName = data.pushName;
                
                console.log(`[Webhook] Processing message from ${senderName} (${senderId}) for tenant ${tenant.subdomain}: "${message}"`);

                // Asynchronously handle the bot logic without blocking the response
                handleWhatsappMessage(tenant, payload).catch(err => {
                    console.error(`[Webhook] Error in handleWhatsappMessage for tenant ${tenant.subdomain}:`, err)
                });
                
                break;

            case 'connection.update':
                // Handle connection status changes
                console.log(`[Webhook] Connection status for instance ${instance} is ${data.state}`);
                // TODO: Maybe update the UI or notify the tenant owner
                break;
            
            case 'qrcode.updated':
                // Handle QR code updates for scanning
                console.log(`[Webhook] QR code updated for instance ${instance}. QR: ${data.qrcode}`);
                // TODO: We need a way to push this QR code to the frontend, likely via WebSocket.
                break;

            default:
                console.log(`[Webhook] Received unhandled event type: ${event}`);
                break;
        }

        return NextResponse.json({ success: true, message: 'Webhook received' });

    } catch (error: any) {
        console.error('[Webhook Error] Error processing webhook:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
} 