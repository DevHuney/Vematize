'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import clientPromise from '@/lib/mongodb';
import { ClientRegisterSchema } from '@/lib/schemas';
import { add } from 'date-fns';

type RegisterResult = {
  success: boolean;
  message: string;
};

export async function registerClient(
  values: z.infer<typeof ClientRegisterSchema>
): Promise<RegisterResult> {
  try {
    const validatedData = ClientRegisterSchema.parse(values);

    const client = await clientPromise;
    const db = client.db('vematize');
    const tenantsCollection = db.collection('tenants');

    // Check for existing subdomain or email
    const existingTenant = await tenantsCollection.findOne({
      $or: [{ subdomain: validatedData.subdomain }, { ownerEmail: validatedData.email }],
    });

    if (existingTenant) {
      if (existingTenant.subdomain === validatedData.subdomain) {
        return { success: false, message: 'Este subdomínio já está em uso.' };
      }
      if (existingTenant.ownerEmail === validatedData.email) {
        return { success: false, message: 'Este e-mail já está cadastrado.' };
      }
    }

    const passwordHash = await bcrypt.hash(validatedData.password, 10);
    const trialEndsAt = add(new Date(), { days: 30 });

    await tenantsCollection.insertOne({
      ownerName: validatedData.name,
      subdomain: validatedData.subdomain,
      ownerEmail: validatedData.email,
      cpfCnpj: validatedData.cpfCnpj,
      passwordHash: passwordHash,
      trialEndsAt: trialEndsAt.toISOString(),
      subscriptionStatus: 'trialing',
    });

    return { success: true, message: 'Conta criada com sucesso! Você será redirecionado.' };

  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: error.errors.map(e => e.message).join(', ') };
    }
    console.error('Registration error:', error);
    return { success: false, message: 'Ocorreu um erro inesperado. Tente novamente.' };
  }
}
