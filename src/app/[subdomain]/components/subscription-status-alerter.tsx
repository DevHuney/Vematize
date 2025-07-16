'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type SubscriptionStatusAlerterProps = {
    expiresAt: string | null;
    subdomain: string;
};

export function SubscriptionStatusAlerter({ expiresAt, subdomain }: SubscriptionStatusAlerterProps) {
    const { toast } = useToast();

    useEffect(() => {
        if (!expiresAt) return;

        const now = new Date();
        const expirationDate = new Date(expiresAt);
        const fiveDaysInMillis = 5 * 24 * 60 * 60 * 1000;
        const diff = expirationDate.getTime() - now.getTime();
        
        const isExpiringSoon = diff > 0 && diff <= fiveDaysInMillis;

        if (isExpiringSoon) {
            const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
            toast({
                title: 'Sua assinatura está expirando!',
                description: `Seu plano expira em ${daysLeft} dia(s). Renove para não perder o acesso.`,
                variant: 'destructive',
                action: (
                    <Button asChild>
                        <Link href={`/${subdomain}/plan`}>Renovar Agora</Link>
                    </Button>
                ),
                duration: 10000, // Show for 10 seconds
            });
        }
    }, [expiresAt, subdomain, toast]);

    return null; // This component does not render anything itself
} 