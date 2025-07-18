import type { Tenant, User, BotStep, BotButton } from '@/lib/types';
import clientPromise from '@/lib/mongodb';
import { z } from 'zod';

type WhatsappWebhookPayload = any;

async function sendTextMessage(tenant: Tenant, recipient: string, message: string) {
    const { evolutionApiUrl, evolutionApiKey, evolutionApiInstance } = tenant.connections?.whatsapp || {};

    if (!evolutionApiUrl || !evolutionApiKey || !evolutionApiInstance) {
        throw new Error(`WhatsApp not configured for tenant ${tenant.subdomain}`);
    }

    const apiUrl = `${evolutionApiUrl}/message/sendText/${evolutionApiInstance}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionApiKey,
            },
            body: JSON.stringify({
                number: recipient,
                text: message,
            }),
        });
        
        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Evolution API request failed with status ${response.status}: ${errorData}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error(`[Whatsapp Bot] Error sending message to ${recipient}:`, error);
        throw error;
    }
}

async function sendListMessage(tenant: Tenant, recipient: string, step: BotStep) {
    const { evolutionApiUrl, evolutionApiKey, evolutionApiInstance } = tenant.connections?.whatsapp || {};

    if (!evolutionApiUrl || !evolutionApiKey || !evolutionApiInstance) {
        throw new Error(`WhatsApp not configured for tenant ${tenant.subdomain}`);
    }

    const apiUrl = `${evolutionApiUrl}/message/sendList/${evolutionApiInstance}`;

    const listMessagePayload = {
        number: recipient,
        listMessage: {
            title: step.name, 
            description: step.message,
            buttonText: "Escolha uma opção",
            sections: [{
                title: "Opções disponíveis",
                rows: step.buttons.map(button => {
                    const callback_data = button.action.payload ? `${button.action.type}:${button.action.payload}` : button.action.type;
                    return {
                        rowId: callback_data,
                        title: button.text,
                        description: "" 
                    };
                })
            }]
        }
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionApiKey,
            },
            body: JSON.stringify(listMessagePayload),
        });
        
        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Evolution API sendList request failed with status ${response.status}: ${errorData}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error(`[Whatsapp Bot] Error sending list message to ${recipient}:`, error);
        throw error;
    }
}

async function executeStep(tenant: Tenant, recipient: string, step: BotStep) {
    if (step.buttons && step.buttons.length > 0) {
        await sendListMessage(tenant, recipient, step);
    } else {
        await sendTextMessage(tenant, recipient, step.message);
    }
}

export async function handleWhatsappMessage(tenant: Tenant, payload: WhatsappWebhookPayload) {
    const { data } = payload;
    const senderId = data.key?.remoteJid;
    const senderName = data.pushName;

    const messageText = data.message?.conversation || data.message?.extendedTextMessage?.text || '';
    const listResponse = data.message?.listResponseMessage;
    const command = listResponse ? listResponse.singleSelectReply?.selectedRowId : messageText;

    if (!senderId || !command) {
        console.error('[Whatsapp Bot] Crucial information (senderId or command) not found in payload.');
        return;
    }

    try {
        const db = (await clientPromise).db('vematize');
        await db.collection<User>('users').updateOne(
            { whatsappId: senderId, tenantId: tenant._id.toString() },
            { 
                $set: { name: senderName || 'Usuário do WhatsApp' },
                $setOnInsert: {
                    whatsappId: senderId,
                    tenantId: tenant._id.toString(),
                    createdAt: new Date(),
                    state: 'active',
                    plan: 'Nenhum',
                    purchases: []
                }
            },
            { upsert: true }
        );
    } catch (error) {
        console.error('[Whatsapp Bot] Error upserting user:', error);
    }

    console.log(`[Whatsapp Bot] Processing command "${command}" for ${senderId}`);

    const botConfig = tenant.botConfig;
    if (!botConfig || !botConfig.flows || botConfig.flows.length === 0) {
        return sendTextMessage(tenant, senderId, "Olá! Este bot ainda não foi configurado.");
    }

    const mainFlow = botConfig.flows.find(f => f.trigger === '/start') || botConfig.flows[0];
    if (!mainFlow || !mainFlow.startStepId) {
         return sendTextMessage(tenant, senderId, "Olá! O fluxo principal do bot não está configurado corretamente.");
    }

    const allSteps = mainFlow.steps;
    const currentStep = allSteps.find(s => s.id === mainFlow.startStepId);

    if (!currentStep) {
        return sendTextMessage(tenant, senderId, "O passo inicial do bot não foi encontrado.");
    }

    if (command.includes(':')) {
        const [actionType, actionPayload] = command.split(':', 2);

        if (actionType === 'GO_TO_STEP') {
            const targetStep = allSteps.find(s => s.id === actionPayload);
            if (targetStep) {
                await executeStep(tenant, senderId, targetStep);
            } else {
                console.error(`[Whatsapp Bot] Step with ID ${actionPayload} not found.`);
                await sendTextMessage(tenant, senderId, "Ops! Não encontrei o próximo passo. Por favor, tente novamente.");
            }
            return;
        }

        if (actionType === 'MAIN_MENU') {
            const startStep = allSteps.find(s => s.id === mainFlow.startStepId);
            if (startStep) await executeStep(tenant, senderId, startStep);
            return;
        }

        console.log(`[Whatsapp Bot] Unhandled action type: ${actionType}`);
        return;
    }

    if (command.trim().toLowerCase() === '/start') {
        const startStep = allSteps.find(s => s.id === mainFlow.startStepId);
        if (startStep) {
            await executeStep(tenant, senderId, startStep);
        } else {
             console.error(`[Whatsapp Bot] Start step with ID ${mainFlow.startStepId} not found.`);
             await sendTextMessage(tenant, senderId, "Este fluxo está configurado incorretamente.");
        }
    } else {
        console.log(`[Whatsapp Bot] No flow found for command "${command}".`);
        await sendTextMessage(tenant, senderId, `Comando não reconhecido. Digite /start para começar.`);
    }
} 