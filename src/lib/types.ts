import type { ObjectId } from 'mongodb';
import { z } from 'zod';
import { BotConfigSchema } from './schemas';

export interface User {
  _id: ObjectId;
  tenantId: string;
  telegramId?: number;
  whatsappId?: string;
  name?: string;
  username?: string;
  state?: 'active' | 'inactive' | 'expired';
  plan?: string;
  purchases?: Purchase[];
  createdAt: Date;
  updatedAt?: Date;
}

export interface Purchase {
  purchaseId: string;
  productId: string;
  productName: string;
  purchaseDate: Date;
  type: 'product' | 'subscription';
  status: 'approved' | 'pending' | 'failed' | 'refunded' | 'expired';
  expiresAt?: Date;
  lastNotified?: Date;
}

export type BotActionType = 'GO_TO_STEP' | 'LINK_TO_PRODUCT' | 'MAIN_MENU' | 'SHOW_PROFILE';

export interface BotAction {
  type: BotActionType;
  payload?: string;
}

export interface BotButton {
  id: string;
  text: string;
  action: BotAction;
}

export interface BotStep {
  id: string;
  name: string;
  message: string;
  buttons: BotButton[];
}

export type BotConfig = z.infer<typeof BotConfigSchema>;

export interface Tenant {
  _id: ObjectId;
  ownerName: string;
  subdomain: string;
  ownerEmail: string;
  passwordHash: string;
  cpfCnpj: string;
  trialEndsAt?: string;
  planId?: string;
  subscriptionProvider?: 'mercadopago';
  subscriptionId?: string;
  subscriptionStatus?: 'active' | 'inactive' | 'trialing' | 'canceled';
  subscriptionEndsAt?: string;
  connections?: {
    whatsapp?: {
      evolutionApiUrl?: string;
      evolutionApiKey?: string;
      evolutionApiInstance?: string;
    };
    instagram?: {
      pageId: string;
      accessToken: string;
    };
    telegram?: {
      botToken: string;
    };
  };
  botConfig?: BotConfig;
  paymentIntegrations?: {
    mercadopago?: {
      mode: 'sandbox' | 'production';
      sandbox_public_key?: string;
      sandbox_access_token?: string;
      sandbox_webhook_secret?: string;
      production_public_key?: string;
      production_access_token?: string;
      production_webhook_secret?: string;
      success_url?: string;
      failure_url?: string;
      pending_url?: string;
    }
  };
}

export interface SaasPlan {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  features: string[];
  isActive: boolean;
}

export interface ProductPaymentMethods {
  pix?: string;
  credit_card?: string;
}

export interface Product {
    id: string;
    tenantId: string;
    name: string;
    description?: string;
    price: number;
    paymentMethods?: ProductPaymentMethods;
    type: 'product' | 'subscription';
    
    durationDays?: number | null;
    isTelegramGroupAccess?: boolean;
    telegramGroupId?: string | null;

    productSubtype?: 'standard' | 'digital_file' | 'activation_codes';
    stock?: number | null;
    activationCodes?: string[];
    activationCodesUsed?: string[];
    hostedFileUrl?: string | null;
    
    discountPrice?: number | null;
    offerExpiresAt?: string | null;
}

export interface Sale {
    _id: ObjectId;
    tenantId: string;
    productId: string;
    userId: string;
    telegramChatId?: number;
    telegramMessageId?: number;
    status: 'pending' | 'approved' | 'failed' | 'refunded' | 'cancelled';
    paymentGateway: string;
    createdAt: Date;
    updatedAt?: Date;
    paymentDetails?: {
        init_point?: string;
        preferenceId?: string;
        qrCode?: string;
        qrCodeBase64?: string;
        paymentId?: number;
    };
}

export interface MercadoPagoSettings {
    mode: 'sandbox' | 'production';
    sandbox_public_key?: string;
    sandbox_access_token?: string;
    sandbox_webhook_secret?: string;
    production_public_key?: string;
    production_access_token?: string;
    production_webhook_secret?: string;
    success_url?: string;
    failure_url?: string;
    pending_url?: string;
}

export interface PaymentIntegrations {
    mercadopago?: MercadoPagoSettings;
}

export interface KrovSettings {
    paymentIntegrations?: PaymentIntegrations;
}
