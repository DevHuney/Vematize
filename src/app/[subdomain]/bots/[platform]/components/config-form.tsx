'use client';

import { useState, useEffect, useCallback } from "react";
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plug, PlugZap, ShieldX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { connectWhatsappInstance, getWhatsappConnectionStatus, disconnectWhatsappInstance } from '../../actions';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface WhatsappConnectionManagerProps {
    subdomain: string;
}

export function WhatsappConnectionManager({ subdomain }: WhatsappConnectionManagerProps) {
    const router = useRouter();
    const { toast } = useToast();
    
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const checkStatus = useCallback(async () => {
        const statusResult = await getWhatsappConnectionStatus(subdomain);
        if (statusResult.success && statusResult.state === 'CONNECTED') {
            setIsConnected(true);
            setQrCodeUrl(null);
        } else {
            setIsConnected(false);
        }
        setIsLoading(false);
    }, [subdomain]);

    useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    useEffect(() => {
        if (!qrCodeUrl) return;

        const interval = setInterval(async () => {
            await checkStatus();
        }, 5000); // Check status every 5 seconds

        return () => clearInterval(interval);
    }, [qrCodeUrl, checkStatus]);

    const handleConnect = async () => {
        setIsProcessing(true);
        setQrCodeUrl(null);
        const result = await connectWhatsappInstance(subdomain);
        if (result.success && result.qr) {
            setQrCodeUrl(result.qr);
        } else {
            toast({ variant: "destructive", title: "Erro", description: result.message || "Não foi possível obter o QR code." });
        }
        setIsProcessing(false);
    };

    const handleDisconnect = async () => {
        setIsProcessing(true);
        const result = await disconnectWhatsappInstance(subdomain);
        if (result.success) {
            toast({ title: "Sucesso", description: result.message });
            setIsConnected(false);
        } else {
            toast({ variant: "destructive", title: "Erro", description: result.message });
        }
        setIsProcessing(false);
    };

    return (
        <Card className="max-w-2xl">
            <CardHeader>
                <CardTitle>Conexão com WhatsApp</CardTitle>
                <CardDescription>
                    Conecte sua conta escaneando o QR Code. A sessão permanecerá ativa.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center space-x-4 rounded-md border p-4">
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", isLoading ? "bg-muted" : isConnected ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900")}>
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 
                            isConnected ? <PlugZap className="h-5 w-5 text-green-600 dark:text-green-400" /> : <ShieldX className="h-5 w-5 text-red-600 dark:text-red-400" />
                        }
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-medium leading-none">Status</p>
                        <Badge variant={isConnected ? 'default' : 'destructive'} className="mt-1">
                            {isLoading ? 'Verificando...' : (isConnected ? 'Conectado' : 'Desconectado')}
                        </Badge>
                    </div>
                    <div className="flex gap-2">
                        {!isConnected ? (
                             <Button onClick={handleConnect} disabled={isLoading || isProcessing}>
                                {isProcessing ? <Loader2 className="animate-spin" /> : "Conectar"}
                            </Button>
                        ) : (
                             <Button variant="destructive" onClick={handleDisconnect} disabled={isLoading || isProcessing}>
                                {isProcessing ? <Loader2 className="animate-spin" /> : "Desconectar"}
                            </Button>
                        )}
                    </div>
                </div>
                
                {qrCodeUrl && !isConnected && (
                     <div className="mt-6 flex flex-col items-center justify-center space-y-4 rounded-md border p-4 animate-accordion-down">
                        <h3 className="text-lg font-medium">Escaneie para Conectar</h3>
                        <p className="text-sm text-muted-foreground text-center">
                            Abra o WhatsApp no seu celular, vá em Aparelhos Conectados e aponte a câmera para a imagem abaixo.
                        </p>
                        <Image src={qrCodeUrl} alt="QR Code do WhatsApp" width={250} height={250} />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}