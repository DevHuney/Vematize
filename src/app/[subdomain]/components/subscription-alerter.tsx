'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getPendingSubscription } from '../plan/actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface SubscriptionAlerterProps {
  subdomain: string;
}

export function SubscriptionAlerter({ subdomain }: SubscriptionAlerterProps) {
  const { toast } = useToast();

  useEffect(() => {
    const checkPending = async () => {
      try {
        const pendingSubscription = await getPendingSubscription(subdomain);
        if (pendingSubscription) {
          toast({
            title: 'Pagamento Pendente',
            description: 'Você tem uma assinatura aguardando pagamento. Conclua a compra para ativar seu plano.',
            duration: Infinity, // Make it persistent until dismissed
            action: (
                <Link href={`/${subdomain}/plan`}>
                    <Button>
                        Ver Plano
                    </Button>
                </Link>
            ),
          });
        }
      } catch (error) {
        console.error("Failed to check for pending subscriptions:", error);
      }
    };

    // Run check after a short delay to not block initial page load
    const timer = setTimeout(checkPending, 2000);
    
    return () => clearTimeout(timer);

  }, [subdomain, toast]);

  return null; // This component does not render anything itself
} 