'use server';

import { revalidatePath } from 'next/cache';

// Essas variáveis devem ser configuradas no seu ambiente (.env.local)
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const APP_URL = process.env.APP_URL;

function getHeaders() {
    if (!EVOLUTION_API_KEY) {
        throw new Error("EVOLUTION_API_KEY não está configurada no ambiente.");
    }
    return {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
    };
}

async function createInstance(subdomain: string) {
    if (!EVOLUTION_API_URL) throw new Error("EVOLUTION_API_URL não está configurada.");

    const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
            instanceName: subdomain,
            qrcode: true,
        }),
    });
    
    // Se a instância já existe (409) ou a mensagem confirma, consideramos sucesso.
    if (response.ok || response.status === 409) {
        return;
    }

    const result = await response.json();
    if (result.message?.includes("already exists")) {
        return;
    }

    console.error("Erro ao criar a instância:", result);
    throw new Error(`Erro ao criar a instância: ${result.error || 'Erro desconhecido.'}`);
}

async function setWebhook(subdomain: string) {
    if (!EVOLUTION_API_URL) throw new Error("EVOLUTION_API_URL não está configurada.");
    if (!APP_URL) throw new Error("APP_URL não está configurada.");

    const webhookUrl = `${APP_URL}/api/webhook/whatsapp/${subdomain}`;
    const setWebhookUrl = `${EVOLUTION_API_URL}/webhook/set/${subdomain}`;

    const response = await fetch(setWebhookUrl, {
        method: 'POST',
        headers: getHeaders(),
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
        await createInstance(subdomain);
        await setWebhook(subdomain);

        const connectResponse = await fetch(`${EVOLUTION_API_URL}/instance/connect/${subdomain}`, {
            headers: getHeaders(),
        });

        const connectResult = await connectResponse.json();

        if (!connectResponse.ok) {
            console.error("Erro ao buscar QR Code:", connectResult);
            return { success: false, message: `Erro ao buscar QR code: ${connectResult.message || 'Falha na API'}` };
        }
        
        if (connectResult.base64) {
            return { success: true, qr: connectResult.base64 };
        } else {
             // Se não veio QR code, pode ser que já esteja conectando ou conectado.
            return { success: false, message: 'Não foi possível obter o QR code. Verifique o status da conexão.' };
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
             headers: getHeaders(),
        });

        if (!response.ok) {
            // Se o status for 404, significa que a instância não existe, logo, está desconectada.
            if (response.status === 404) {
                return { success: true, state: 'DISCONNECTED' };
            }
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
        // Primeiro, desconecta a sessão
        await fetch(`${EVOLUTION_API_URL}/instance/logout/${subdomain}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        
        // Em seguida, deleta a instância para uma limpeza completa
        const deleteResponse = await fetch(`${EVOLUTION_API_URL}/instance/delete/${subdomain}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        
        if (deleteResponse.ok) {
            revalidatePath(`/${subdomain}/bots/whatsapp`);
            return { success: true, message: 'Instância desconectada e removida com sucesso.' };
        } else {
            const errorResult = await deleteResponse.json();
             // Se o erro for 404, a instância já foi removida, o que é um sucesso para o usuário.
            if (deleteResponse.status === 404) {
                 revalidatePath(`/${subdomain}/bots/whatsapp`);
                return { success: true, message: 'Instância já havia sido removida.' };
            }
            return { success: false, message: `Falha ao remover a instância: ${errorResult.message || 'Erro da API'}` };
        }

    } catch (error: any) {
        console.error('Erro ao desconectar instância:', error);
        return { success: false, message: `Erro inesperado: ${error.message}` };
    }
} 