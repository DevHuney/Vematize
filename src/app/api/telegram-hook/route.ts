import { NextRequest, NextResponse } from 'next/server';
import { createBotInstance } from '@/lib/telegram/botFactory';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  console.log("[Webhook Route] Received a request at /api/telegram-hook.");
  try {
    const token = request.nextUrl.searchParams.get('token');
    
    if (!token) {
        console.error("[Webhook Route] CRITICAL: Token not found in query parameters.");
        return NextResponse.json({ ok: false, message: "Token is missing" }, { status: 400 });
    }
    
    console.log(`[Webhook Route] --- Received request for token prefix: ${token.slice(0, 8)}...`);

    const bot = createBotInstance(token);
    const body = await request.json();
    
    console.log('[Webhook Route] Handing update to Telegraf...');
    await bot.handleUpdate(body);
    
    console.log(`[Webhook Route] --- Successfully processed update for token prefix: ${token.slice(0, 8)}...`);
    return NextResponse.json({ ok: true });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Webhook Route] CRITICAL ERROR: The webhook failed: ${errorMessage}`, error);
    
    // Return 200 OK to prevent Telegram from re-sending the update.
    // The error is logged on our side for debugging.
    return NextResponse.json({ ok: true, message: "Error processed, see server logs." });
  }
}
