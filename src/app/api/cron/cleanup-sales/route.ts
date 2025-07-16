import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { Sale } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron Job] Running cleanup-sales job...');

    try {
        const client = await clientPromise;
        const db = client.db('vematize');
        const salesCollection = db.collection<Sale>('sales');

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const statusesToClean: Sale['status'][] = ['cancelled', 'pending'];

        const query = {
            status: { $in: statusesToClean },
            createdAt: { $lt: twentyFourHoursAgo },
        };

        const result = await salesCollection.deleteMany(query as any);

        const message = `Cleanup successful. Removed ${result.deletedCount} cancelled or pending sales older than 24 hours.`;
        console.log(`[Cron Job] ${message}`);

        return NextResponse.json({ success: true, message });

    } catch (error) {
        console.error('Error in cleanup-sales job:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}