'use server';

import clientPromise from '@/lib/mongodb';
import type { Tenant } from '@/lib/types';
import { unstable_noStore as noStore } from 'next/cache';

// Serializable client type to be used in components
export type Client = Omit<Tenant, '_id'> & {
  id: string;
};

export async function getClients(): Promise<Client[]> {
  noStore(); // Opt out of caching for this dynamic data
  try {
    const client = await clientPromise;
    const db = client.db('vematize');
    const tenantsCollection = db.collection<Tenant>('tenants');
    
    const tenants = await tenantsCollection.find({}).toArray();

    // Map MongoDB documents to a serializable format, converting ObjectId to string
    return tenants.map((tenant) => ({
      ...tenant,
      id: tenant._id.toString(),
    }));
  } catch (error) {
    console.error('Database error fetching clients:', error);
    return []; // Return empty array on error
  }
}
