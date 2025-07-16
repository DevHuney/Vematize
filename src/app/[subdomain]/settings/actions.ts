'use server';

import { z } from 'zod';
import clientPromise from '@/lib/mongodb';
import { MercadoPagoSettingsSchema } from '@/lib/schemas';
import { revalidatePath } from 'next/cache';

type MercadoPagoSettings = z.infer<typeof MercadoPagoSettingsSchema>;

export async function getMercadoPagoSettings(subdomain: string): Promise<MercadoPagoSettings | null> {
    try {
        const client = await clientPromise;
        const db = client.db('vematize');
        const tenantsCollection = db.collection('tenants');

        const tenant = await tenantsCollection.findOne({ subdomain });

        if (!tenant) {
            console.error('Tenant not found for subdomain:', subdomain);
            return null;
        }

        // Return the nested Mercado Pago settings object, or a default structure if not present
        return tenant.paymentIntegrations?.mercadopago || {
            mode: 'sandbox',
            sandbox_public_key: '',
            sandbox_access_token: '',
            production_public_key: '',
            production_access_token: '',
        };
    } catch (error) {
        console.error('Database Error fetching Mercado Pago settings:', error);
        return null;
    }
}


export async function updateMercadoPagoSettings(
    subdomain: string,
    data: MercadoPagoSettings
): Promise<{ success: boolean; message: string }> {
    try {
        const validatedData = MercadoPagoSettingsSchema.parse(data);

        const client = await clientPromise;
        const db = client.db('vematize');
        const tenantsCollection = db.collection('tenants');

        const result = await tenantsCollection.updateOne(
            { subdomain },
            {
                $set: {
                    'paymentIntegrations.mercadopago': validatedData,
                },
            }
        );

        if (result.matchedCount === 0) {
            return { success: false, message: 'Tenant não encontrado.' };
        }
        
        revalidatePath(`/${subdomain}/settings`);

        return { success: true, message: 'Configurações do Mercado Pago salvas com sucesso!' };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, message: error.errors.map((e) => e.message).join(', ') };
        }
        console.error('Erro ao salvar as configurações do Mercado Pago:', error);
        return { success: false, message: 'Ocorreu um erro no servidor.' };
    }
} 