'use server';

import clientPromise from '@/lib/mongodb';
import { CreateAdminSchema } from '@/lib/schemas';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

type AdminActionResult = {
  success: boolean;
  message: string;
};

// Action for the initial setup, replaces the temporary 'admin' user
export async function setupInitialAdmin(
  values: z.infer<typeof CreateAdminSchema>
): Promise<AdminActionResult> {
   try {
    const validatedData = CreateAdminSchema.parse(values);
    const client = await clientPromise;
    const db = client.db('vematize');
    const adminCollection = db.collection('admins');

    const existingAdmin = await adminCollection.findOne({ username: validatedData.username });
    if (existingAdmin) {
      return { success: false, message: 'Este nome de usuário já existe.' };
    }

    const hashedPassword = await bcrypt.hash(validatedData.password, 10);
    
    // In the initial setup, we remove the temporary user placeholder if it exists.
    await adminCollection.deleteMany({ username: 'admin' }); 
    
    await adminCollection.insertOne({
      username: validatedData.username,
      password: hashedPassword,
    });

    return { success: true, message: 'Administrador inicial configurado com sucesso!' };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: error.errors.map(e => e.message).join(', ') };
    }
    console.error('Erro ao configurar administrador inicial:', error);
    return { success: false, message: 'Ocorreu um erro inesperado.' };
  }
}


// Generic action to create new admins from the admin panel
export async function createAdmin(
  values: z.infer<typeof CreateAdminSchema>
): Promise<AdminActionResult> {
  try {
    const validatedData = CreateAdminSchema.parse(values);
    const client = await clientPromise;
    const db = client.db('vematize');
    const adminCollection = db.collection('admins');

    const existingAdmin = await adminCollection.findOne({ username: validatedData.username });
    if (existingAdmin) {
      return { success: false, message: 'Este nome de usuário já existe.' };
    }

    const hashedPassword = await bcrypt.hash(validatedData.password, 10);
    
    await adminCollection.insertOne({
      username: validatedData.username,
      password: hashedPassword,
    });

    return { success: true, message: 'Administrador criado com sucesso!' };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: error.errors.map(e => e.message).join(', ') };
    }
    console.error('Erro ao criar administrador:', error);
    return { success: false, message: 'Ocorreu um erro inesperado.' };
  }
}
