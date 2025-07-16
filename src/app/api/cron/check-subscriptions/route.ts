import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { Telegraf } from 'telegraf';
import { Tenant, User, Purchase } from '@/lib/types';
import { Db, ObjectId } from 'mongodb';

async function removeUserFromGroup(bot: Telegraf, groupId: string | undefined | null, userId: number) {
    if (!groupId) return false;
    try {
        await bot.telegram.banChatMember(groupId, userId);
        await bot.telegram.unbanChatMember(groupId, userId);
        console.log(`[Cron] User ${userId} successfully removed from group ${groupId}.`);
        return true;
    } catch (error: any) {
        if (error.response?.description) {
            console.error(`[Cron] Failed to remove user ${userId} from group ${groupId}. Telegram API Error: ${error.response.description}`);
        } else {
            console.error(`[Cron] Failed to remove user ${userId} from group ${groupId}. Error: ${error.message}`);
        }
        return false;
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    if (process.env.CRON_SECRET !== secret) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] Starting subscription check job...');
    const db: Db = (await clientPromise).db('vematize');
    const usersCollection = db.collection<User>('users');
    const productsCollection = db.collection('products');
    const tenantsCollection = db.collection<Tenant>('tenants');
    
    const now = new Date();
    let endUsersProcessed = 0;
    let purchasesExpired = 0;
    let tenantsProcessed = 0;

    try {
        // Find users with at least one purchase to check.
        const usersToCheck = await usersCollection.find({
            'purchases.0': { $exists: true }
        }).toArray();

        // Filter these users in the application code to find those with genuinely expired purchases.
        // A purchase is considered expired if its expiration date is in the past and its status is not already 'expired'.
        const usersWithExpiredPurchases = usersToCheck.filter(user => 
            user.purchases?.some(p => p.expiresAt && new Date(p.expiresAt) < now && p.status !== 'expired')
        );

        if (usersWithExpiredPurchases.length === 0) {
            console.log('[Cron] No users with expired subscriptions found.');
            return NextResponse.json({ success: true, message: 'No users with expired subscriptions found.' });
        }

        console.log(`[Cron] Found ${usersWithExpiredPurchases.length} users with expired subscriptions.`);

        for (const user of usersWithExpiredPurchases) {
            const tenant = await tenantsCollection.findOne({ _id: new ObjectId(user.tenantId) });
            if (!tenant?.connections?.telegram?.botToken) {
                console.warn(`[Cron] Tenant or bot token not found for user ${user._id}. Skipping.`);
                continue;
            }

            const bot = new Telegraf(tenant.connections.telegram.botToken);
            let hasChanged = false;

            // Filter for the specific purchases that have expired
            const expiredPurchases = user.purchases?.filter(p => p.expiresAt && new Date(p.expiresAt) < now && p.status !== 'expired') || [];

            for (const purchase of expiredPurchases) {
                const product = await productsCollection.findOne({ _id: new ObjectId(purchase.productId) });
                
                if (product?.isTelegramGroupAccess && user.telegramId) {
                    await removeUserFromGroup(bot, product.telegramGroupId, user.telegramId);
                }

                // Update the specific purchase status to 'expired' using its unique _id
                await usersCollection.updateOne(
                    { "purchases._id": (purchase as any)._id },
                    { $set: { "purchases.$.status": "expired" } }
                );
                purchasesExpired++;
                hasChanged = true;
            }

            if (hasChanged) {
                 // After updates, check if the user has any remaining active subscriptions
                const updatedUser = await usersCollection.findOne({ _id: user._id });
                const hasActiveSubscription = updatedUser?.purchases?.some(p => p.status === 'approved' && p.type === 'subscription');

                if (!hasActiveSubscription) {
                    // If no active subscriptions are left, update the main user status
                    await usersCollection.updateOne(
                        { _id: user._id },
                        { $set: { status: 'expired', plan: 'Expirado' } }
                    );
                }
            }
            endUsersProcessed++;
        }
        
        // ---- Check SaaS Client (Tenant) Subscriptions ----
        console.log('[Cron] Checking for expired tenant subscriptions...');
        
        // Find all active or trialing tenants to check their expiration in the code
        const tenantsToCheck = await tenantsCollection.find({
            subscriptionStatus: { $in: ['active', 'trialing'] }
        }).toArray();

        const expiredTenants = tenantsToCheck.filter(tenant => {
            if (tenant.subscriptionStatus === 'active' && tenant.subscriptionEndsAt) {
                return new Date(tenant.subscriptionEndsAt) < now;
            }
            if (tenant.subscriptionStatus === 'trialing' && tenant.trialEndsAt) {
                return new Date(tenant.trialEndsAt) < now;
            }
            return false;
        });

        if (expiredTenants.length > 0) {
            console.log(`[Cron] Found ${expiredTenants.length} tenants with expired or trial-ended subscriptions.`);
            for (const tenant of expiredTenants) {
                const result = await tenantsCollection.updateOne(
                    { _id: tenant._id, subscriptionStatus: { $ne: 'inactive' } }, // Extra safety check
                    { $set: { subscriptionStatus: 'inactive' } }
                );
                if (result.modifiedCount > 0) {
                    tenantsProcessed++;
                }
            }
        } else {
            console.log('[Cron] No expired tenant subscriptions found.');
        }

        const summary = `Subscription check finished. Users processed: ${endUsersProcessed}, Purchases expired: ${purchasesExpired}. Tenants processed: ${tenantsProcessed}.`;
        console.log(`[Cron] ${summary}`);
        return NextResponse.json({ success: true, message: summary });

    } catch (error: any) {
        console.error('[Cron] An unexpected error occurred:', error);
        return NextResponse.json({ success: false, message: `An error occurred: ${error.message}` }, { status: 500 });
    }
} 