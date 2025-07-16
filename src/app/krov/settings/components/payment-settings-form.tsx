'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KrovSettings } from '@/lib/types';
import { MercadoPagoLogo } from '@/components/icons/mercadopago-logo';
import { MercadoPagoConfigDialog } from './mercadopago-config-dialog';

interface PaymentSettingsFormProps {
  settings: KrovSettings;
}

export function PaymentSettingsForm({ settings }: PaymentSettingsFormProps) {
  const [isMercadoPagoDialogOpen, setMercadoPagoDialogOpen] = useState(false);

  const mpSettings = settings.paymentIntegrations?.mercadopago;

  let statusText: 'Produção' | 'Sandbox' | 'Inativo' = 'Inativo';
  let badgeVariant: 'default' | 'secondary' | 'outline' = 'secondary';

  if (mpSettings?.production_access_token && mpSettings?.production_public_key) {
    statusText = 'Produção';
    badgeVariant = 'default';
  } else if (mpSettings?.sandbox_access_token && mpSettings?.sandbox_public_key) {
    statusText = 'Sandbox';
    badgeVariant = 'outline';
  }

  return (
    <>
      <MercadoPagoConfigDialog 
        open={isMercadoPagoDialogOpen} 
        onOpenChange={setMercadoPagoDialogOpen}
        settings={settings}
      />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Integrações de Pagamento</CardTitle>
          <CardDescription>
            Gerencie as integrações de gateway de pagamento para o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <Card className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                    <MercadoPagoLogo className="h-8 w-auto" />
                    <div>
                        <h3 className="font-semibold">Mercado Pago</h3>
                        <p className="text-sm text-muted-foreground">
                            O gateway de pagamento principal/fallback.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Badge variant={badgeVariant}>
                        {statusText}
                    </Badge>
                    <Button 
                        variant="outline" 
                        onClick={() => setMercadoPagoDialogOpen(true)}
                    >
                        Configurar
                    </Button>
                </div>
            </Card>
            <p className="text-xs text-center text-muted-foreground pt-4">
                Em breve, mais gateways de pagamento serão adicionados.
            </p>
        </CardContent>
      </Card>
    </>
  );
} 