'use server';

import clientPromise from '@/lib/mongodb';
import { unstable_noStore as noStore } from 'next/cache';
import { ObjectId } from 'mongodb';
import type { User as DbUser } from '@/lib/types';

export type BotUser = {
  id: string;
  name: string | null;
  identifier: string;
  status: 'Ativo' | 'Expirado' | 'Inativo' | 'Outro';
  plan: string | null;
  joinDate: string;
};

function mapDbStateToStatus(state: string | null | undefined): BotUser['status'] {
  switch(state) {
    case 'ativo': return 'Ativo';
    case 'expirado': return 'Expirado';
    case 'inativo':
    case 'welcome':
    case 'escolhendo_plano':
    case 'aguardando_pagamento':
    case null:
      return 'Inativo';
    default:
      return 'Outro';
  }
}

export async function getBotUsers(subdomain: string): Promise<BotUser[]> {
    noStore();
    try {
        const client = await clientPromise;
        const db = client.db('vematize');
        
        const tenantsCollection = db.collection('tenants');
        const tenant = await tenantsCollection.findOne({ subdomain });

        if (!tenant) {
            return [];
        }
        
        const usersCollection = db.collection<DbUser>('users');
        const usersFromDb = await usersCollection.find({ tenantId: tenant._id.toString() }).toArray();

        if (!usersFromDb || usersFromDb.length === 0) {
            return [];
        }

        return usersFromDb.map(user => {
            const objectId = new ObjectId(user._id);
            const joinDate = objectId.getTimestamp();

            const usernameDisplay = user.username ? `@${user.username}` : 'N/A';
            const identifier = `${usernameDisplay} (ID: ${user.telegramId})`;

            return {
                id: user._id.toString(),
                name: user.name || 'Usuário sem nome',
                identifier: identifier,
                status: mapDbStateToStatus(user.state),
                plan: user.plan || 'Nenhum',
                joinDate: joinDate.toLocaleDateString('pt-BR'),
            }
        });

    } catch (error) {
        console.error('Database error fetching bot users:', error);
        return [];
    }
}
