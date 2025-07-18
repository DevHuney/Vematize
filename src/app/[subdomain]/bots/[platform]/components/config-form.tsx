'use client';

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plug, PlugZap, ShieldX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { connectWhatsappInstance, getWhatsappConnectionStatus, disconnectWhatsappInstance, saveBotConnection, getBotConnectionDetails } from '../../actions';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Platform, platformConfigMap } from "../../platform-config";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PlatformConnectionManagerProps {
    subdomain: string;
}

export function PlatformConnectionManager({ subdomain }: PlatformConnectionManagerProps) {
    const params = useParams();
    const platform = params.platform as Platform;
    const config = platformConfigMap[platform];

    if (platform === 'whatsapp') {
        return <WhatsappConnectionManager subdomain={subdomain} />;
    }

    return <GenericConnectionManager subdomain={subdomain} />;
}

function WhatsappConnectionManager({ subdomain }: { subdomain: string }) {
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
        }, 5000);

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

function GenericConnectionManager({ subdomain }: { subdomain: string }) {
    const params = useParams();
    const platform = params.platform as Platform;
    const config = platformConfigMap[platform];
    const { toast } = useToast();
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        async function fetchConfig() {
            const connectionDetails = await getBotConnectionDetails(subdomain, platform);
            if (connectionDetails) {
                const initialFormData = config.fields.reduce((acc, field) => {
                    acc[field.id] = connectionDetails[field.id] || '';
                    return acc;
                }, {} as Record<string, string>);
                setFormData(initialFormData);
                
                const connectionKey = config.connectionCheckKey;
                if (connectionDetails[connectionKey]) {
                    setIsConnected(true);
                }
            }
        }
        fetchConfig();
    }, [subdomain, platform, config]);

    const handleInputChange = (id: string, value: string) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        const result = await saveBotConnection(subdomain, platform, formData);

        if (result.success) {
            toast({ title: "Sucesso", description: result.message || "Configuração salva com sucesso!" });
            setIsConnected(true);
        } else {
            toast({ variant: "destructive", title: "Erro", description: result.message || "Não foi possível salvar a configuração." });
        }
        setIsSaving(false);
    };

    return (
        <Card className="max-w-2xl">
            <CardHeader>
                <CardTitle>{config.title}</CardTitle>
                <CardDescription>{config.description}</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {config.fields.map(field => (
                        <div key={field.id} className="space-y-2">
                            <Label htmlFor={field.id}>{field.label}</Label>
                            <Input
                                id={field.id}
                                type={field.type || 'text'}
                                value={formData[field.id] || ''}
                                onChange={e => handleInputChange(field.id, e.target.value)}
                                placeholder={field.placeholder}
                            />
                        </div>
                    ))}
                    <div className="flex justify-end gap-2">
                         <Button type="submit" disabled={isSaving}>
                            {isSaving ? <Loader2 className="animate-spin" /> : "Salvar e Conectar"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}