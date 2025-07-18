import { z } from 'zod';

export const PasswordSchema = z.string()
    .min(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
    .regex(/[a-z]/, { message: 'A senha deve conter pelo menos uma letra minúscula.' })
    .regex(/[A-Z]/, { message: 'A senha deve conter pelo menos uma letra maiúscula.' })
    .regex(/[0-9]/, { message: 'A senha deve conter pelo menos um número.' })
    .regex(/[^a-zA-Z0-9]/, { message: 'A senha deve conter pelo menos um caractere especial.' });

export const CreateAdminSchema = z.object({
  username: z.string().min(3, { message: "O nome de usuário deve ter pelo menos 3 caracteres." }),
  password: PasswordSchema, 
});

export const ClientRegisterSchema = z.object({
    name: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
    subdomain: z.string().min(3, { message: "O subdomínio deve ter pelo menos 3 caracteres." }).regex(/^[a-z0-9-]+$/, { message: "Use apenas letras minúsculas, números e hífens." }),
    cpfCnpj: z.string().min(11, { message: "CPF/CNPJ inválido."}), 
    email: z.string().email({ message: "Por favor, insira um e-mail válido." }),
    password: PasswordSchema, 
});

export const ClientLoginSchema = z.object({
  email: z.string().email({ message: "Por favor, insira um e-mail válido." }),
  password: z.string().min(1, { message: "A senha é obrigatória." }), 
});

export const MercadoPagoSettingsSchema = z.object({
    mode: z.enum(['sandbox', 'production']).default('sandbox'),
    sandbox_public_key: z.string().optional(),
    sandbox_access_token: z.string().optional(),
    sandbox_webhook_secret: z.string().optional(),
    production_public_key: z.string().optional(),
    production_access_token: z.string().optional(),
    production_webhook_secret: z.string().optional(),
    success_url: z.string().url({ message: "URL de sucesso inválida." }).optional().or(z.literal('')),
    failure_url: z.string().url({ message: "URL de falha inválida." }).optional().or(z.literal('')),
    pending_url: z.string().url({ message: "URL pendente inválida." }).optional().or(z.literal('')),
}).refine(data => {
    if (data.mode === 'production') {
        return !!data.production_public_key && !!data.production_access_token;
    }
    return true; 
}, {
    message: "As credenciais de Produção (Public Key e Access Token) são obrigatórias quando o modo de Produção está ativo.",
    path: ["production_public_key"], 
});

export const PaymentIntegrationsSchema = z.object({
  mercadopago: MercadoPagoSettingsSchema.optional(),
});

export const SaasPlanSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, { message: 'O nome do plano deve ter pelo menos 3 caracteres.' }),
  price: z.coerce.number({invalid_type_error: "O preço deve ser um número."}).positive({ message: 'O preço deve ser um número positivo.' }),
  durationDays: z.coerce.number().int({ message: "A duração deve ser um número inteiro." }).positive({ message: 'A duração deve ser um número inteiro positivo.' }),
  features: z.array(z.string()).min(1, { message: "Selecione pelo menos uma funcionalidade." }),
  isActive: z.boolean().default(true),
});

export const ProductPaymentMethodsSchema = z.object({
  pix: z.string().optional(),
  credit_card: z.string().optional(),
});

export const ProductSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, { message: 'O nome do produto deve ter pelo menos 3 caracteres.' }),
  description: z.string().max(280, { message: "A descrição não pode ter mais de 280 caracteres." }).optional(),
  price: z.coerce.number({invalid_type_error: "O preço deve ser um número."}).min(0, { message: 'O preço não pode ser negativo.' }),
  
  paymentMethods: ProductPaymentMethodsSchema.optional(),

  type: z.enum(['product', 'subscription']).default('product'),
  
  durationDays: z.coerce.number().int().positive().optional().nullable(),
  isTelegramGroupAccess: z.boolean().optional(),
  telegramGroupId: z.string().optional().nullable(),

  productSubtype: z.enum(['standard', 'digital_file', 'activation_codes']).optional(),
  stock: z.coerce.number().int({ message: 'O estoque deve ser um número inteiro.' }).min(0, { message: 'O estoque não pode ser negativo.' }).optional().nullable(),
  activationCodes: z.string().optional(), 
  hostedFileUrl: z.string().url().optional().nullable(),
  
  discountPrice: z.coerce.number().min(0, { message: 'O preço com desconto não pode ser negativo.' }).optional().nullable(),
  offerExpiresAt: z.string().optional().nullable(),

}).superRefine((data, ctx) => {
    if (data.type === 'subscription' && data.isTelegramGroupAccess && !data.telegramGroupId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "O ID do grupo do Telegram é obrigatório para esta opção.",
            path: ['telegramGroupId'],
        });
    }
    if (data.type === 'product' && data.productSubtype === 'activation_codes' && !data.activationCodes) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "É necessário adicionar ao menos um código.",
            path: ['activationCodes'],
        });
    }
    if (data.discountPrice !== null && data.discountPrice !== undefined) {
        if (data.price !== null && data.price !== undefined && data.discountPrice >= data.price) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'O preço com desconto deve ser menor que o preço original.',
                path: ['discountPrice'],
            });
        }
        if (!data.offerExpiresAt) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'A data de expiração da oferta é obrigatória se um preço com desconto for definido.',
                path: ['offerExpiresAt'],
            });
        }
    }
});


export const BotActionSchema = z.object({
  type: z.enum(['GO_TO_STEP', 'LINK_TO_PRODUCT', 'MAIN_MENU', 'SHOW_PROFILE']),
  payload: z.string().optional(),
});

export const BotButtonSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  text: z.string().min(1, { message: "O texto do botão é obrigatório." }).max(40, { message: "Texto muito longo."}),
  action: BotActionSchema,
});

export const BotStepSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  name: z.string().min(1, { message: "O nome do passo é obrigatório." }),
  message: z.string().min(1, { message: "A mensagem é obrigatória." }),
  buttons: z.array(BotButtonSchema),
});

export const BotFlowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, { message: "O nome do fluxo é obrigatório." }),
  trigger: z.string().min(1, { message: "O comando de ativação é obrigatório."}),
  startStepId: z.string().nullable(),
  steps: z.array(BotStepSchema),
});

export const BotConfigSchema = z.object({
  flows: z.array(BotFlowSchema),
  inactiveSubscriptionMessage: z.string().optional(),
  deliveryMessage: z.string().optional(),
});

export const KrovSettingsSchema = z.object({
  paymentIntegrations: PaymentIntegrationsSchema.optional(),
});
