import { NextResponse } from "next/server";

export async function POST(request: Request, { params }: { params: { subdomain: string } }) {
    const { subdomain } = params;
    try {
        const body = await request.json();
        console.log(`[${new Date().toISOString()}] Webhook received for ${subdomain}:`, JSON.stringify(body, null, 2));

        // Here you would process the webhook event.
        // For example, save the message to a database, trigger a bot response, etc.

        // Example: a "connection.update" event
        if (body.event === 'connection.update' && body.data.state === 'CONNECTED') {
            console.log(`Instance ${body.instance} connected for subdomain ${subdomain}`);
            // You could update the connection status in your database here.
        }
        
        // Example: a "messages.upsert" event
        if (body.event === 'messages.upsert') {
            console.log(`New message received for ${subdomain}:`, body.data.message);
            // Process the incoming message...
        }

        return NextResponse.json({ success: true, message: "Webhook received" });
    } catch (error: any) {
        console.error(`Error processing webhook for ${subdomain}:`, error);
        return NextResponse.json({ success: false, message: "Error processing webhook", error: error.message }, { status: 500 });
    }
} 