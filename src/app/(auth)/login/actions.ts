'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import clientPromise from '@/lib/mongodb';
import { ClientLoginSchema } from '@/lib/schemas';
import type { Tenant } from '@/lib/types';
import { ObjectId } from 'mongodb';

type TenantDocument = Omit<Tenant, '_id' | 'ownerName'> & { _id: ObjectId, ownerName?: string, subdomain: string };


type LoginResultSuccess = {
  success: true;
  message: string;
  name: string;
  email: string;
  subdomain: string;
};

type LoginResultError = {
  success: false;
  message: string;
};

type LoginResult = LoginResultSuccess | LoginResultError;

export async function loginClient(
  values: z.infer<typeof ClientLoginSchema>
): Promise<LoginResult> {
  try {
    const validatedData = ClientLoginSchema.parse(values);

    const client = await clientPromise;
    const db = client.db('vematize');
    const tenantsCollection = db.collection<TenantDocument>('tenants');

    const tenant = await tenantsCollection.findOne({ ownerEmail: validatedData.email });

    if (!tenant || !tenant.passwordHash) {
      return { success: false, message: 'E-mail ou senha inválidos.' };
    }

    const isPasswordValid = await bcrypt.compare(
      validatedData.password,
      tenant.passwordHash
    );

    if (!isPasswordValid) {
      return { success: false, message: 'E-mail ou senha inválidos.' };
    }
    
    return { 
        success: true,
        message: 'Login bem-sucedido!',
        name: tenant.ownerName || 'Cliente', // Fallback for old accounts
        email: tenant.ownerEmail,
        subdomain: tenant.subdomain,
    };

  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: error.errors.map(e => e.message).join(', ') };
    }
    console.error('Client login error:', error);
    return { success: false, message: 'Ocorreu um erro inesperado. Tente novamente.' };
  }
}
