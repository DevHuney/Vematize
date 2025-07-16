import { WhatsAppIcon, InstagramIcon, TelegramIcon } from "@/components/icons/platform-icons";
import type { ComponentType, SVGProps } from "react";

type Field = {
    id: string;
    label: string;
    placeholder: string;
    type?: string;
};

interface PlatformConfig {
    title: string;
    description: string;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    fields: Field[];
    connectionCheckKey: string;
}

export const platformConfigMap: Record<string, PlatformConfig> = {
    whatsapp: {
        title: "Configuração do WhatsApp",
        description: "Conecte sua conta do WhatsApp para automatizar suas conversas.",
        icon: WhatsAppIcon,
        fields: [],
        connectionCheckKey: "connected"
    },
    instagram: {
        title: "Configuração do Instagram",
        description: "Responda directs, comentários e menções automaticamente.",
        icon: InstagramIcon,
        fields: [
            { id: "pageId", label: "ID da Página do Facebook", placeholder: "ID da sua página..." },
            { id: "accessToken", label: "Token de Acesso", placeholder: "Seu token de acesso...", type: "password" }
        ],
        connectionCheckKey: "accessToken"
    },
    telegram: {
        title: "Configuração do Telegram",
        description: "Crie um bot personalizado para interagir com seus usuários.",
        icon: TelegramIcon,
        fields: [
            { id: "botToken", label: "Token do Bot do Telegram", placeholder: "Seu token do BotFather...", type: "password" }
        ],
        connectionCheckKey: "botToken"
    }
};

export const supportedPlatforms: Platform[] = ['whatsapp', 'telegram', 'instagram'];

export type Platform = keyof typeof platformConfigMap;
