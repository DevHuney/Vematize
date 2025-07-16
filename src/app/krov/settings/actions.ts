'use server';

import clientPromise from '@/lib/mongodb';
import { KrovSettingsSchema, SaasPlanSchema } from '@/lib/schemas';
import type { KrovSettings, SaasPlan } from '@/lib/types';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

// --- General ---
type ActionResult = {
  success: boolean;
  message: string;
};


// --- Settings Actions ---
const SETTINGS_ID = 'global';

export async function getSettings(): Promise<KrovSettings> {
  try {
    const client = await clientPromise;
    const db = client.db('vematize');
    const settingsCollection = db.collection('settings');
    const settings = await settingsCollection.findOne({ _id: SETTINGS_ID as any });

    if (!settings) {
      return { paymentIntegrations: { mercadopago: { mode: 'sandbox' } } };
    }

    // Ensure the structure matches KrovSettings type
    const typedSettings: KrovSettings = {
      paymentIntegrations: settings.paymentIntegrations || { mercadopago: { mode: 'sandbox' } },
    };

    return typedSettings;

  } catch (error) {
    console.error('Failed to get settings:', error);
    return { paymentIntegrations: { mercadopago: { mode: 'sandbox' } } };
  }
}

export async function updateSettings(
  values: KrovSettings
): Promise<ActionResult> {
  try {
    const validatedData = KrovSettingsSchema.parse(values);
    
    const client = await clientPromise;
    const db = client.db('vematize');
    const settingsCollection = db.collection('settings');
    
    await settingsCollection.updateOne(
      { _id: SETTINGS_ID as any },
      { $set: validatedData },
      { upsert: true } // Create the document if it doesn't exist
    );
    
    revalidatePath('/krov/settings');
    return { success: true, message: 'Configurações salvas com sucesso!' };

  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: error.errors.map(e => e.message).join(', ') };
    }
    console.error('Failed to update settings:', error);
    return { success: false, message: 'Ocorreu um erro inesperado.' };
  }
}

// --- SaaS Plan Actions ---

type SaasPlanDocument = {
  _id: ObjectId;
  name: string;
  price: number;
  durationDays: number;
  features: string[];
  isActive: boolean;
}

export async function getSaasPlans(): Promise<SaasPlan[]> {
  try {
    const client = await clientPromise;
    const db = client.db('vematize');
    const plansCollection = db.collection<SaasPlanDocument>('plans');
    
    const plans = await plansCollection.find({}).sort({ price: 1 }).toArray();

    return plans.map((plan) => ({
      id: plan._id.toString(),
      name: plan.name,
      price: plan.price,
      durationDays: plan.durationDays,
      features: plan.features || [],
      isActive: plan.isActive,
    }));
  } catch (error) {
    console.error('Database error fetching saas plans:', error);
    return [];
  }
}

export async function getActiveSaasPlans(): Promise<SaasPlan[]> {
  try {
    const client = await clientPromise;
    const db = client.db('vematize');
    const plansCollection = db.collection<SaasPlanDocument>('plans');
    
    const plans = await plansCollection.find({ isActive: true }).sort({ price: 1 }).toArray();

    return plans.map((plan) => ({
      id: plan._id.toString(),
      name: plan.name,
      price: plan.price,
      durationDays: plan.durationDays,
      features: plan.features || [],
      isActive: plan.isActive,
    }));
  } catch (error) {
    console.error('Database error fetching active saas plans:', error);
    return [];
  }
}

export async function saveSaasPlan(formData: FormData): Promise<ActionResult> {
  try {
    const validatedData = SaasPlanSchema.parse(Object.fromEntries(formData));
    const { id, ...planData } = validatedData;

    const client = await clientPromise;
    const db = client.db('vematize');
    const plansCollection = db.collection<SaasPlanDocument>('plans');

    if (id) {
      // Update existing plan
      const result = await plansCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: {
          name: planData.name,
          price: planData.price,
          durationDays: planData.durationDays,
          features: planData.features,
          isActive: planData.isActive
        } }
      );

      if (!result.matchedCount) {
        throw new Error('Plano não encontrado.');
      }
    } else {
      // Create new plan
      await plansCollection.insertOne({
        name: planData.name,
        price: planData.price,
        durationDays: planData.durationDays,
        features: planData.features,
        isActive: planData.isActive
      } as SaasPlanDocument);
    }

    revalidatePath('/krov/settings');
    return { success: true, message: 'Plano salvo com sucesso!' };
  } catch (error) {
    console.error('Error saving saas plan:', error);
    const message = error instanceof Error ? error.message : 'Erro ao salvar o plano.';
    return { success: false, message };
  }
}

export async function deleteSaasPlan(id: string): Promise<ActionResult> {
  try {
    if (!id) {
        return { success: false, message: 'ID do plano não fornecido.' };
    }
    const client = await clientPromise;
    const db = client.db('vematize');
    const plansCollection = db.collection('plans');
    
    const result = await plansCollection.deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
        return { success: false, message: 'Plano não encontrado.' };
    }

    revalidatePath('/krov/settings');
    return { success: true, message: 'Plano excluído com sucesso!' };

  } catch (error) {
    console.error('Failed to delete saas plan:', error);
    return { success: false, message: 'Ocorreu um erro inesperado ao excluir o plano.' };
  }
}
