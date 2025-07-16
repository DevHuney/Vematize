'use server';

import clientPromise from '@/lib/mongodb';
import type { Tenant } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import type { Platform } from './platform-config';
import { z } from 'zod';
import { BotConfigSchema } from '@/lib/schemas';

export type BotConnections = Tenant['connections'];
export type ConnectionDetails = { [key: string]: string } | undefined;


export async function getBotConnections(subdomain: string): Promise<BotConnections> {
  try {
    const client = await clientPromise;
    const db = client.db('vematize');
    
    const tenantsCollection = db.collection('tenants');
    const tenant = await tenantsCollection.findOne({ subdomain });

    if (!tenant) {
      return {};
    }

    return tenant.connections || {};

  } catch (error) {
    console.error('Database Error fetching bot connections:', error);
    return {};
  }
}

export async function getBotConnectionDetails(subdomain: string, platform: Platform): Promise<ConnectionDetails> {
  try {
    const client = await clientPromise;
    const db = client.db('vematize');
    const tenantsCollection = db.collection('tenants');
    const tenant = await tenantsCollection.findOne(
      { subdomain },
      { projection: { [`connections.${platform}`]: 1 } }
    );
    if (!tenant || !tenant.connections) {
      return undefined;
    }
    return tenant.connections[platform];
  } catch (error) {
    console.error(`Database Error fetching details for ${platform}:`, error);
    return undefined;
  }
}


export async function saveBotConnection(
    subdomain: string, 
    platform: Platform, 
    data: { [key: string]: string }
): Promise<{success: boolean; message: string}> {
    try {
        if (!subdomain || !platform || !data) {
            return { success: false, message: 'Dados inválidos fornecidos.' };
        }

        const client = await clientPromise;
        const db = client.db('vematize');
        const tenantsCollection = db.collection('tenants');

        const sanitizedData: {[key: string]: string} = {};
        for (const key in data) {
            if (data[key]) {
                sanitizedData[key] = data[key];
            }
        }

        const updateResult = await tenantsCollection.updateOne(
            { subdomain },
            { $set: { [`connections.${platform}`]: sanitizedData } }
        );

        if (updateResult.matchedCount === 0) {
            return { success: false, message: 'Cliente não encontrado.' };
        }
        
        let successMessage = 'Conexão salva com sucesso!';
        const appUrl = process.env.APP_URL; 

        if (!appUrl) {
            console.error("APP_URL environment variable not set. Cannot configure webhooks.");
            successMessage += ' No entanto, o webhook não pôde ser configurado (APP_URL não definida no servidor).';
        } else {
             if (platform === 'telegram' && sanitizedData.botToken) {
                const webhookUrl = `${appUrl}/api/telegram-hook?token=${encodeURIComponent(sanitizedData.botToken)}`;
                const telegramApiUrl = `https://api.telegram.org/bot${sanitizedData.botToken}/setWebhook`;

                const response = await fetch(telegramApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message", "callback_query"] })
                });
                const result = await response.json();

                if (result.ok) {
                    successMessage = 'Conexão salva e webhook do Telegram ativado com sucesso!';
                } else {
                    console.error('Failed to set Telegram webhook:', result.description);
                    const userMessage = result.description?.includes("bot token") 
                       ? "O token do bot parece ser inválido."
                       : result.description || "Erro desconhecido";
                    return { success: false, message: `Falha ao ativar o webhook: ${userMessage}` };
                }
            }
        }


        revalidatePath(`/${subdomain}/bots`);
        revalidatePath(`/${subdomain}/bots/${platform}`);
        return { success: true, message: successMessage };

    } catch (error) {
        console.error('Database Error saving bot connection:', error);
        return { success: false, message: 'Erro ao salvar a conexão.' };
    }
}

export async function getBotConfig(subdomain: string): Promise<z.infer<typeof BotConfigSchema> | null> {
    try {
        const client = await clientPromise;
        const db = client.db('vematize');
        const tenantsCollection = db.collection<Tenant>('tenants');
        const tenant = await tenantsCollection.findOne(
            { subdomain },
            { projection: { botConfig: 1 } }
        );

        // We use safe parsing to ensure the data from DB conforms to our new schema.
        // This prevents crashes if old-structured data is still in the DB.
        const parseResult = BotConfigSchema.safeParse(tenant?.botConfig);
        
        if (parseResult.success) {
            return parseResult.data;
        }

        // If parsing fails (e.g., old data structure), return null so the frontend can load defaults.
        if(tenant?.botConfig) {
            console.warn(`Bot config for subdomain "${subdomain}" has outdated structure and will be reset.`);
        }

        return null;
        
    } catch (error) {
        console.error('Database Error fetching bot config:', error);
        return null;
    }
}

export async function saveBotConfig(
    subdomain: string,
    data: z.infer<typeof BotConfigSchema>
): Promise<{success: boolean; message: string}> {
    try {
        const validatedData = BotConfigSchema.parse(data);

        const client = await clientPromise;
        const db = client.db('vematize');
        const tenantsCollection = db.collection('tenants');

        const updateResult = await tenantsCollection.updateOne(
            { subdomain },
            { $set: { botConfig: validatedData } }
        );

        if (updateResult.matchedCount === 0) {
            return { success: false, message: 'Cliente não encontrado.' };
        }

        revalidatePath(`/${subdomain}/bots/telegram`);
        revalidatePath(`/${subdomain}/bots/whatsapp`);
        revalidatePath(`/${subdomain}/bots/instagram`);
        return { success: true, message: 'Fluxo do bot salvo com sucesso!' };

    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, message: error.errors.map(e => e.message).join(', ') };
        }
        console.error('Database Error saving bot config:', error);
        return { success: false, message: 'Erro ao salvar as configurações do fluxo.' };
    }
}


// --- Ações do WhatsApp ---

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const APP_URL = process.env.APP_URL;

function getEvolutionHeaders() {
    if (!EVOLUTION_API_KEY) {
        throw new Error("EVOLUTION_API_KEY não está configurada no ambiente.");
    }
    return {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
    };
}

async function createWhatsappInstance(subdomain: string) {
    if (!EVOLUTION_API_URL) throw new Error("EVOLUTION_API_URL não está configurada.");

    const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: 'POST',
        headers: getEvolutionHeaders(),
        body: JSON.stringify({
            instanceName: subdomain,
            qrcode: true,
        }),
    });
    
    if (response.ok || response.status === 409) return;

    const result = await response.json();
    if (result.message?.includes("already exists")) return;

    console.error("Erro ao criar a instância do WhatsApp:", result);
    throw new Error(`Erro ao criar a instância: ${result.error || 'Erro desconhecido.'}`);
}

async function setWhatsappWebhook(subdomain: string) {
    if (!EVOLUTION_API_URL) throw new Error("EVOLUTION_API_URL não está configurada.");
    if (!APP_URL) throw new Error("APP_URL não está configurada.");

    const webhookUrl = `${APP_URL}/api/webhook/whatsapp/${subdomain}`;
    const setWebhookUrl = `${EVOLUTION_API_URL}/webhook/set/${subdomain}`;

    const response = await fetch(setWebhookUrl, {
        method: 'POST',
        headers: getEvolutionHeaders(),
        body: JSON.stringify({
            url: webhookUrl,
            enabled: true,
            events: ["messages.upsert", "connection.update", "qrcode.updated"]
        })
    });

    if (!response.ok) {
        const errorResult = await response.json();
        console.error('Falha ao configurar o webhook do WhatsApp:', errorResult);
        throw new Error(`Falha ao configurar o webhook: ${errorResult.message || response.statusText}`);
    }
}

export async function connectWhatsappInstance(subdomain: string): Promise<{ success: boolean; qr?: string; message?: string }> {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !APP_URL) {
        const errorMessage = "A configuração da API Evolution (URL, Chave ou URL da App) está incompleta no servidor.";
        console.error(errorMessage);
        return { success: false, message: errorMessage };
    }

    try {
        await createWhatsappInstance(subdomain);
        await setWhatsappWebhook(subdomain);

        const connectResponse = await fetch(`${EVOLUTION_API_URL}/instance/connect/${subdomain}`, {
            headers: getEvolutionHeaders(),
        });

        const connectResult = await connectResponse.json();

        if (!connectResponse.ok) {
            console.error("Erro ao buscar QR Code:", connectResult);
            return { success: false, message: `Erro ao buscar QR code: ${connectResult.message || 'Falha na API'}` };
        }
        
        if (connectResult.base64) {
            return { success: true, qr: connectResult.base64 };
        } else {
            return { success: false, message: 'Não foi possível obter o QR code. A instância pode já estar conectada ou em processo de conexão.' };
        }

    } catch (error: any) {
        console.error('Erro ao conectar instância do WhatsApp:', error);
        return { success: false, message: `Erro inesperado: ${error.message}` };
    }
}

export async function getWhatsappConnectionStatus(subdomain: string): Promise<{ success: boolean; state?: string; message?: string }> {
     if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
        return { success: false, state: 'DISCONNECTED', message: 'A configuração da API Evolution está incompleta no servidor.' };
    }
     try {
        const response = await fetch(`${EVOLUTION_API_URL}/instance/connection-state/${subdomain}`, {
             headers: getEvolutionHeaders(),
        });

        if (response.status === 404) {
            return { success: true, state: 'DISCONNECTED' };
        }

        if (!response.ok) {
            return { success: false, state: 'DISCONNECTED' };
        }

        const result = await response.json();
        return { success: true, state: result.state };

     } catch (error: any) {
         console.error('Erro ao obter status da conexão:', error);
         return { success: false, state: 'DISCONNECTED', message: `Erro inesperado: ${error.message}` };
     }
}

export async function disconnectWhatsappInstance(subdomain: string): Promise<{ success: boolean; message: string }> {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
        return { success: false, message: 'A configuração da API Evolution está incompleta no servidor.' };
    }

    try {
        await fetch(`${EVOLUTION_API_URL}/instance/logout/${subdomain}`, {
            method: 'DELETE',
            headers: getEvolutionHeaders(),
        });
        
        const deleteResponse = await fetch(`${EVOLUTION_API_URL}/instance/delete/${subdomain}`, {
            method: 'DELETE',
            headers: getEvolutionHeaders(),
        });
        
        if (deleteResponse.ok || deleteResponse.status === 404) {
            revalidatePath(`/${subdomain}/bots/whatsapp`);
            return { success: true, message: 'Instância desconectada e removida com sucesso.' };
        } else {
            const errorResult = await deleteResponse.json();
            return { success: false, message: `Falha ao remover a instância: ${errorResult.message || 'Erro da API'}` };
        }

    } catch (error: any) {
        console.error('Erro ao desconectar instância:', error);
        return { success: false, message: `Erro inesperado: ${error.message}` };
    }
}
