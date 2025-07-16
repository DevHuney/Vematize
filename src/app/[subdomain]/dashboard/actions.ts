'use server';

import clientPromise from '@/lib/mongodb';
import { unstable_noStore as noStore } from 'next/cache';
import { Tenant } from '@/lib/types';

type BotStats = {
  totalUsers: number;
  activeUsers: number;
  expiredUsers: number;
  totalSales: number;
};

export async function getBotStats(subdomain: string): Promise<BotStats> {
  try {
    const client = await clientPromise;
    const db = client.db('vematize');
    
    const tenantsCollection = db.collection('tenants');
    const tenant = await tenantsCollection.findOne({ subdomain });

    if (!tenant) {
      // Return zeroed stats if tenant not found, to avoid breaking dashboard
      return { totalUsers: 0, activeUsers: 0, expiredUsers: 0, totalSales: 0 };
    }

    const usersCollection = db.collection('users');
    const filter = { tenantId: tenant._id.toString() };

    const totalUsers = await usersCollection.countDocuments(filter);
    const activeUsers = await usersCollection.countDocuments({ ...filter, state: 'ativo' });
    const expiredUsers = await usersCollection.countDocuments({ ...filter, state: 'expirado' });
    
    // This is just a placeholder as we don't have sales data yet.
    const totalSales = 0; 

    return {
      totalUsers,
      activeUsers,
      expiredUsers,
      totalSales,
    };
  } catch (error) {
    console.error('Database Error fetching bot stats:', error);
    // Return zeroed stats on error to prevent breaking the dashboard.
    return {
      totalUsers: 0,
      activeUsers: 0,
      expiredUsers: 0,
      totalSales: 0,
    };
  }
}

export async function getDashboardStats(subdomain: string) {
    noStore();
    try {
        const client = await clientPromise;
        const db = client.db('vematize');
        
        const tenant = await db.collection<Tenant>('tenants').findOne({ subdomain });
        if (!tenant) {
            throw new Error('Tenant not found');
        }

        const tenantId = tenant._id.toString();

        const totalUsers = await db.collection('users').countDocuments({ tenantId });
        const totalSales = await db.collection('sales').countDocuments({ tenantId, status: 'approved' });
        
        const salesData = await db.collection('sales').find({ tenantId, status: 'approved' }).toArray();
        const totalRevenue = salesData.reduce((sum, sale) => {
            // A 'sale' document should have a 'total_value' field with the transaction amount.
            return sum + (sale.total_value || 0); 
        }, 0);

        return {
            totalUsers,
            totalSales,
            totalRevenue,
        };

    } catch (error) {
        console.error('Database Error fetching dashboard stats:', error);
        return {
            totalUsers: 0,
            totalSales: 0,
            totalRevenue: 0,
        };
    }
}
