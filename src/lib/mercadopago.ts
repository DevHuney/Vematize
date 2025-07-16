import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { Tenant, Product } from './types'; // Importar tipos para clareza

export async function createMercadoPagoPreference(
    tenant: Tenant,
    product: Product & { _id: ObjectId },
    saleId: string,
    buyerId: string,
): Promise<{ success: boolean; message:string; preferenceId?: string; init_point?: string; }> {
    try {
        const mpSettings = tenant.paymentIntegrations?.mercadopago;
        if (!mpSettings) {
             return { success: false, message: 'O vendedor não configurou o Mercado Pago.' };
        }

        const isSandbox = mpSettings.mode === 'sandbox';
        const accessToken = isSandbox ? mpSettings.sandbox_access_token : mpSettings.production_access_token;

        if (!accessToken) {
             return { success: false, message: `As credenciais para o modo ${mpSettings.mode} do Mercado Pago não foram configuradas.` };
        }

        const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
        const preference = new Preference(client);

        const payerEmail = `${buyerId}@telegram.com`;

        let finalPrice = product.price;
        if (product.discountPrice && product.offerExpiresAt && new Date(product.offerExpiresAt) > new Date()) {
            finalPrice = product.discountPrice;
        }

        if (!finalPrice || finalPrice <= 0) {
            console.error('Tentativa de criar preferência com valor zero ou inválido:', finalPrice, product);
            return { success: false, message: 'O valor do produto deve ser maior que zero para pagamento.' };
        }

        const notification_url = `${process.env.NEXT_PUBLIC_BASE_URL}/${tenant.subdomain}/api/webhook/${isSandbox ? 'sandmercadopago' : 'mercadopago'}`;

        const body = {
            items: [
                {
                    id: product._id.toString(),
                    title: product.name,
                    quantity: 1,
                    unit_price: finalPrice,
                    currency_id: 'BRL',
                },
            ],
            payer: {
                email: payerEmail,
            },
            back_urls: {
                success: mpSettings.success_url || 'https://google.com',
                failure: mpSettings.failure_url || 'https://google.com',
                pending: mpSettings.pending_url || 'https://google.com',
            },
            auto_return: 'approved',
            notification_url: notification_url,
            external_reference: saleId,
        };

        console.log('MercadoPago Body:', JSON.stringify(body, null, 2));

        try {
            const result = await preference.create({ body });
            return {
                success: true,
                message: 'Preferência criada com sucesso.',
                preferenceId: result.id,
                init_point: result.init_point,
            };
        } catch (error: any) {
            console.error('Erro Mercado Pago:', error?.message, error?.response?.data || error);
            return { success: false, message: 'Erro ao criar preferência no Mercado Pago: ' + (error?.message || 'Erro desconhecido') };
        }

    } catch (error) {
        console.error('Failed to create Mercado Pago preference:', error);
        return { success: false, message: 'Ocorreu um erro inesperado ao criar o link de pagamento.' };
    }
}

export async function createMercadoPagoPixPayment(
    tenant: Tenant,
    product: Product & { _id: ObjectId },
    saleId: string,
    buyerId: string,
): Promise<{ success: boolean; message:string; qrCode?: string; qrCodeBase64?: string; paymentId?: number; }> {
    try {
        const { MercadoPagoConfig, Payment } = await import('mercadopago');
        
        const mpSettings = tenant.paymentIntegrations?.mercadopago;
        if (!mpSettings) return { success: false, message: 'O vendedor não configurou o Mercado Pago.' };

        const isSandbox = mpSettings.mode === 'sandbox';
        const accessToken = isSandbox ? mpSettings.sandbox_access_token : mpSettings.production_access_token;

        if (!accessToken) return { success: false, message: `As credenciais para o modo ${mpSettings.mode} do Mercado Pago não foram configuradas.` };
        
        const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
        const payment = new Payment(client);

        const payerEmail = `${buyerId}@telegram.com`;

        let finalPrice = product.price;
        if (product.discountPrice && product.offerExpiresAt && new Date(product.offerExpiresAt) > new Date()) {
            finalPrice = product.discountPrice;
        }

        if (!finalPrice || finalPrice <= 0) {
            return { success: false, message: 'O valor do produto deve ser maior que zero.' };
        }

        const notification_url = `${process.env.NEXT_PUBLIC_BASE_URL}/${tenant.subdomain}/api/webhook/${isSandbox ? 'sandmercadopago' : 'mercadopago'}`;

        const expirationDate = new Date();
        expirationDate.setMinutes(expirationDate.getMinutes() + 30);

        const body = {
            transaction_amount: finalPrice,
            description: product.name,
            payment_method_id: 'pix',
            payer: {
                email: payerEmail,
                first_name: 'Comprador',
                last_name: 'Anônimo',
                identification: {
                    type: 'CPF',
                    number: '00000000000'
                },
            },
            notification_url: notification_url,
            external_reference: saleId,
            date_of_expiration: expirationDate.toISOString(),
        };

        try {
            const result = await payment.create({ body });
            
            if (!result.point_of_interaction?.transaction_data) {
                console.error('Mercado Pago PIX Error: Transaction data not found in response.', result);
                return { success: false, message: 'Não foi possível obter os dados do PIX.' };
            }

            return {
                success: true,
                message: 'Pagamento PIX criado com sucesso.',
                qrCode: result.point_of_interaction.transaction_data.qr_code,
                qrCodeBase64: result.point_of_interaction.transaction_data.qr_code_base64,
                paymentId: result.id,
            };
        } catch (error: any) {
            console.error('Erro Mercado Pago (PIX):', error?.message, error?.response?.data || error);
            return { success: false, message: 'Erro ao criar pagamento PIX: ' + (error?.message || 'Erro desconhecido') };
        }

    } catch (error) {
        console.error('Failed to create Mercado Pago PIX payment:', error);
        return { success: false, message: 'Ocorreu um erro inesperado ao criar o pagamento PIX.' };
    }
} 