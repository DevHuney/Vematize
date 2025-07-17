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
  purchases?: Purchase[]; // <--- Adicionar esta linha
  createdAt: Date;
  updatedAt?: Date;
}

// Adicionar esta nova interface
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
  /**
   * - For 'GO_TO_STEP': The ID of the target step.
   * - For 'LINK_TO_PRODUCT': The ID of the product/plan.
   * - For 'MAIN_MENU': This can be undefined.
   */
  payload?: string;
}

export interface BotButton {
  id: string; // Unique ID for the button
  text: string;
  action: BotAction;
}

export interface BotStep {
  id: string; // Unique ID for the step
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
  trialEndsAt?: string; // ISO Date
  planId?: string; // Refers to a SaasPlan ID
  subscriptionProvider?: 'mercadopago';
  subscriptionId?: string;
  subscriptionStatus?: 'active' | 'inactive' | 'trialing' | 'canceled';
  subscriptionEndsAt?: string; // ISO Date
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

// A plan for the SaaS itself, which tenants subscribe to.
export interface SaasPlan {
  id: string; // Holds the string version of MongoDB's _id
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

// A product/service sold by a tenant to their end-users via the bot.
export interface Product {
    id: string; // MongoDB _id
    tenantId: string;
    name: string;
    description?: string;
    price: number;
    paymentMethods?: ProductPaymentMethods;
    type: 'product' | 'subscription';
    
    // Subscription-specific fields
    durationDays?: number | null;
    isTelegramGroupAccess?: boolean;
    telegramGroupId?: string | null;

    // Product-specific fields
    productSubtype?: 'standard' | 'digital_file' | 'activation_codes';
    stock?: number | null;
    activationCodes?: string[];
    activationCodesUsed?: string[];
    hostedFileUrl?: string | null;
    
    // Offer fields
    discountPrice?: number | null;
    offerExpiresAt?: string | null; // ISO Date string
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
