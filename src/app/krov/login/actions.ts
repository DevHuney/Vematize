'use server'

import clientPromise from '@/lib/mongodb';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const LoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

type LoginResult = {
  success: boolean;
  message: string;
  temporary?: boolean;
}

export async function login(values: z.infer<typeof LoginSchema>): Promise<LoginResult> {
  try {
    const client = await clientPromise;
    const db = client.db('vematize');
    const adminCollection = db.collection('admins');

    // Check if it's the initial setup
    const adminCount = await adminCollection.countDocuments();
    if (adminCount === 0 && values.username === 'admin' && values.password === 'admin') {
      return { success: true, message: 'Login temporário bem-sucedido! Configure seu usuário.', temporary: true };
    }

    const admin = await adminCollection.findOne({ username: values.username });

    if (!admin) {
      return { success: false, message: 'Usuário ou senha inválidos.' };
    }

    const isPasswordValid = await bcrypt.compare(values.password, admin.password);

    if (!isPasswordValid) {
      return { success: false, message: 'Usuário ou senha inválidos.' };
    }

    return { success: true, message: 'Login bem-sucedido!' };

  } catch (error) {
    console.error("Login error:", error);
    // This will catch DB connection errors too and show a user-friendly message
    return { success: false, message: 'Erro ao conectar com o banco de dados. Verifique as credenciais e a conexão.' };
  }
}
