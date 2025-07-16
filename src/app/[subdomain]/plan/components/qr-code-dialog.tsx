'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";
import { checkSubscriptionStatus } from "../actions";

interface QrCodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  qrCodeData: {
    qrCode: string;
    qrCodeBase64: string;
    subscriptionId: string;
  } | null;
  subdomain: string;
}

export function QrCodeDialog({ isOpen, onClose, qrCodeData, subdomain }: QrCodeDialogProps) {
  const { toast } = useToast();
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  if (!qrCodeData) {
    return null;
  }

  const { qrCode, qrCodeBase64, subscriptionId } = qrCodeData;

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(qrCode);
    toast({
      title: "Copiado!",
      description: "O código PIX Copia e Cola foi copiado para a área de transferência.",
    });
  };

  const handleCheckPayment = async () => {
    setIsCheckingStatus(true);
    try {
        const result = await checkSubscriptionStatus(subscriptionId);
        if (result.success && result.status === 'active') {
            toast({
                title: "Pagamento Confirmado!",
                description: result.message,
                variant: 'default',
            });
            // Give a moment for the user to see the toast, then refresh
            setTimeout(() => window.location.reload(), 1500);
        } else {
             toast({
                title: "Pagamento não confirmado",
                description: result.message || "O pagamento ainda está pendente. Tente novamente em alguns instantes.",
                variant: 'destructive',
            });
        }
    } catch (e) {
        toast({
            title: "Erro",
            description: "Ocorreu um erro ao verificar o status do pagamento.",
            variant: 'destructive',
        });
    } finally {
        setIsCheckingStatus(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pague com PIX</DialogTitle>
          <DialogDescription>
            Escaneie o QR Code abaixo com o aplicativo do seu banco para pagar. O pagamento é confirmado em segundos.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center p-4">
          <img src={`data:image/png;base64,${qrCodeBase64}`} alt="PIX QR Code" className="w-64 h-64 rounded-lg" />
          <p className="mt-4 text-sm text-muted-foreground">Ou use o PIX Copia e Cola</p>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleCopyToClipboard} className="w-full">
                <Copy className="mr-2 h-4 w-4" />
                Copiar Código PIX
            </Button>
            <Button variant="secondary" onClick={handleCheckPayment} disabled={isCheckingStatus} className="w-full">
                {isCheckingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Já Paguei
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 