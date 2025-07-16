import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { Tenant, User, Purchase, Product } from '@/lib/types';
import { Telegraf } from 'telegraf';
import { Db, ObjectId } from 'mongodb';

// Helper to escape Markdown characters
function escapeMarkdown(text: string): string {
  if (!text) return '';
  const charsToEscape = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
  return charsToEscape.reduce((acc, char) => acc.replace(new RegExp('\\' + char, 'g'), '\\' + char), text);
}

export async function GET(request: NextRequest) {
  const cronSecret = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (cronSecret !== process.env.CRON_SECRET) {
    console.warn('[CRON] Unauthorized attempt to run cron job.');
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  console.log('[CRON] Starting cron job for notifications and expirations...');

  try {
    const db = (await clientPromise).db('vematize');
    const tenants = await db.collection<Tenant>('tenants').find({}).toArray();
    
    const now = new Date();
    let notificationsSent = 0;
    let usersKicked = 0;

    for (const tenant of tenants) {
      if (!tenant.connections?.telegram?.botToken) continue;

      const bot = new Telegraf(tenant.connections.telegram.botToken);

      // --- 1. Handle Notifications for Soon-to-Expire Subscriptions ---
      const fiveDaysFromNow = new Date();
      fiveDaysFromNow.setDate(now.getDate() + 5);

      const usersToNotify = await db.collection<User>('users').aggregate([
        { $match: { tenantId: tenant._id.toString() } },
        { $unwind: '$purchases' },
        { $match: {
            'purchases.type': 'subscription',
            'purchases.status': 'approved',
            'purchases.expiresAt': { $gte: now, $lt: fiveDaysFromNow },
            $or: [
              { 'purchases.lastNotified': { $exists: false } },
              { 'purchases.lastNotified': { $lt: new Date(Date.now() - 23 * 60 * 60 * 1000) } } // ~23 hours ago
            ]
        }},
      ]).toArray();

      for (const user of usersToNotify) {
        const purchase = user.purchases as Purchase;
        const expiresInDays = Math.ceil((new Date(purchase.expiresAt as Date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const dayString = expiresInDays > 1 ? 'dias' : 'dia';

        const message = `⚠️ *Aviso de Expiração* ⚠️\n\nSua assinatura do produto *${escapeMarkdown(purchase.productName)}* expira em *${expiresInDays} ${dayString}*.\n\nPara evitar a interrupção do seu acesso, considere renovar seu plano.`;

        try {
          await bot.telegram.sendMessage(user.telegramId, message, { parse_mode: 'Markdown' });
          
          // Update the notification timestamp
          await db.collection('users').updateOne(
            { _id: new ObjectId(user._id), 'purchases.purchaseId': purchase.purchaseId },
            { $set: { 'purchases.$.lastNotified': new Date() } }
          );

          console.log(`[CRON] Notification sent to user ${user.telegramId} for product ${purchase.productName}`);
          notificationsSent++;
        } catch (error: any) {
          console.error(`[CRON] Failed to send notification to ${user.telegramId}:`, error.response?.description || error.message);
        }
      }

      // --- 2. Handle Expired Subscriptions ---
      const expiredUsers = await db.collection<User>('users').aggregate([
        { $match: { tenantId: tenant._id.toString() } },
        { $unwind: '$purchases' },
        { $match: {
            'purchases.type': 'subscription',
            'purchases.status': 'approved', // Find active subscriptions that are now expired
            'purchases.expiresAt': { $lt: now },
        }},
      ]).toArray();

      for (const user of expiredUsers) {
        const purchase = user.purchases as Purchase;
        const product = await db.collection<Product>('products').findOne({ _id: new ObjectId(purchase.productId) });

        if (product?.isTelegramGroupAccess && product.telegramGroupId) {
            try {
                // Kick member from the group
                await bot.telegram.banChatMember(product.telegramGroupId, user.telegramId);
                // Unban immediately so they can re-join if they re-purchase
                await bot.telegram.unbanChatMember(product.telegramGroupId, user.telegramId);
                
                const message = `Seu acesso ao produto *${escapeMarkdown(product.name)}* expirou e foi removido. Para voltar a ter acesso, por favor, faça uma nova compra.`;
                await bot.telegram.sendMessage(user.telegramId, message, { parse_mode: 'Markdown' });
                
                usersKicked++;
                console.log(`[CRON] Kicked user ${user.telegramId} from group ${product.telegramGroupId}.`);

            } catch (error: any) {
                console.error(`[CRON] Failed to kick ${user.telegramId} from ${product.telegramGroupId}:`, error.response?.description || error.message);
            }
        }
        
        // Update the purchase status to 'expired' regardless of kick success
        await db.collection('users').updateOne(
            { _id: new ObjectId(user._id), 'purchases.purchaseId': purchase.purchaseId },
            { $set: { 'purchases.$.status': 'expired' } }
        );
      }
    }

    console.log(`[CRON] Finished. Sent ${notificationsSent} notifications, kicked ${usersKicked} users.`);
    return NextResponse.json({ success: true, notificationsSent, usersKicked });

  } catch (error) {
    console.error('[CRON] An error occurred during the cron job:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
} 