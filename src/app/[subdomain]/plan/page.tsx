'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { UserNav } from "@/components/layout/user-nav";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentPlanInfo, getAvailablePlans, createSubscriptionPayment, CurrentPlanInfo, getPendingSubscription, checkSubscriptionStatus } from "./actions";
import { Check, XCircle, Ban, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SaasPlan } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { PaymentMethodDialog } from './components/payment-method-dialog';
import { QrCodeDialog } from './components/qr-code-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function SubscriptionInactiveAlert() {
    return (
        <Alert variant="destructive" className="mb-4">
            <Ban className="h-4 w-4" />
            <AlertTitle>Assinatura Inativa</AlertTitle>
            <AlertDescription>
                Sua assinatura está inativa e seus bots e serviços foram pausados. Por favor, escolha um plano abaixo para reativar sua conta.
            </AlertDescription>
        </Alert>
    );
}

export default function ClientPlanPage({ params }: { params: { subdomain: string } }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [planInfo, setPlanInfo] = useState<CurrentPlanInfo | null>(null);
    const [availablePlans, setAvailablePlans] = useState<SaasPlan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);

    // Dialog states
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [isQrCodeDialogOpen, setIsQrCodeDialogOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<SaasPlan | null>(null);
    const [qrCodeData, setQrCodeData] = useState<{ code: string; base64: string; subscriptionId: string; } | null>(null);
    const [pollingSubscriptionId, setPollingSubscriptionId] = useState<string | null>(null);

    const subscriptionError = searchParams.get('error');

    useEffect(() => {
        const status = searchParams.get('status');
        if (status === 'success') {
            toast({
                title: 'Pagamento bem-sucedido!',
                description: 'Sua assinatura foi ativada. Pode levar alguns minutos para o sistema atualizar.',
                variant: 'default',
            });
            router.replace(`/${params.subdomain}/plan`);
        } else if (status === 'failure') {
            toast({
                title: 'Falha no Pagamento',
                description: 'Ocorreu um problema ao processar seu pagamento. Por favor, tente novamente.',
                variant: 'destructive',
            });
            router.replace(`/${params.subdomain}/plan`);
        }
    }, [searchParams, toast, router, params.subdomain]);

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const [plan, plans, pendingSub] = await Promise.all([
                    getCurrentPlanInfo(params.subdomain),
                    getAvailablePlans(),
                    getPendingSubscription(params.subdomain)
                ]);

                setPlanInfo(plan);
                setAvailablePlans(plans);

                if (pendingSub) {
                    toast({
                        title: "Você tem um pagamento pendente",
                        description: "Estamos verificando o status para você.",
                    });
                    const result = await checkSubscriptionStatus(pendingSub._id);
                    if (result.success && result.status === 'active') {
                        toast({
                            title: "Pagamento Confirmado!",
                            description: "Sua assinatura foi ativada.",
                            variant: 'default'
                        });
                        window.location.reload();
                    } else if (pendingSub.paymentGateway !== 'card') { // If it's PIX, we can show the QR code again
                         const paymentResult = await createSubscriptionPayment(pendingSub.planId.toString(), params.subdomain, 'pix');
                         if(paymentResult.qrCode && paymentResult.qrCodeBase64 && paymentResult.subscriptionId) {
                            setQrCodeData({ code: paymentResult.qrCode, base64: paymentResult.qrCodeBase64, subscriptionId: paymentResult.subscriptionId });
                            setIsQrCodeDialogOpen(true);
                         }
                    }
                }
            } catch (error) {
                toast({
                    title: 'Erro ao carregar dados',
                    description: 'Não foi possível carregar as informações do seu plano.',
                    variant: 'destructive'
                });
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, [params.subdomain, toast]);

    useEffect(() => {
        if (pollingSubscriptionId) {
            const intervalId = setInterval(async () => {
                const statusResult = await checkSubscriptionStatus(pollingSubscriptionId);
                if (statusResult.success && statusResult.status === 'active') {
                    clearInterval(intervalId);
                    setPollingSubscriptionId(null);
                    toast({
                        title: 'Pagamento Confirmado!',
                        description: 'Sua assinatura foi ativada com sucesso.',
                        variant: 'default',
                    });
                    window.location.reload();
                }
            }, 5000); // Poll every 5 seconds

            const timeoutId = setTimeout(() => {
                clearInterval(intervalId);
                setPollingSubscriptionId(null);
            }, 31 * 60 * 1000); // Stop polling after 31 minutes

            return () => {
                clearInterval(intervalId);
                clearTimeout(timeoutId);
            };
        }
    }, [pollingSubscriptionId, toast]);

    const handlePlanSelection = (plan: SaasPlan) => {
        setSelectedPlan(plan);
        setIsPaymentDialogOpen(true);
    };

    const handlePaymentMethodSelection = async (paymentMethod: 'pix' | 'card') => {
        if (!selectedPlan) return;
        
        setIsProcessingPayment(true);
        setIsPaymentDialogOpen(false);

        try {
            const result = await createSubscriptionPayment(selectedPlan.id, params.subdomain, paymentMethod);

            if (result.error) {
                toast({
                    title: 'Erro ao processar sua solicitação',
                    description: result.error,
                    variant: 'destructive',
                });
                setIsProcessingPayment(false);
                return;
            }

            if (result.init_point && result.subscriptionId) {
                window.open(result.init_point, '_blank', 'noopener,noreferrer');
                setSelectedPlan(null);
                setPollingSubscriptionId(result.subscriptionId);
            } else if (result.qrCode && result.qrCodeBase64 && result.subscriptionId) {
                setQrCodeData({ code: result.qrCode, base64: result.qrCodeBase64, subscriptionId: result.subscriptionId });
                setIsQrCodeDialogOpen(true);
                setIsProcessingPayment(false);
            }

        } catch (error) {
            toast({
                title: 'Erro Inesperado',
                description: 'Ocorreu um erro ao tentar processar o pagamento.',
                variant: 'destructive',
            });
            setIsProcessingPayment(false);
        }
    };

    const getStatusVariant = () => {
        if (!planInfo) return 'default';
        switch (planInfo.status) {
            case 'active':
            case 'trialing':
                return 'default';
            case 'canceled':
            case 'inactive':
                return 'secondary';
            default:
                return 'destructive';
        }
    };

    const handleManageSubscription = () => {
        // Placeholder for future subscription management (e.g., portal)
        toast({ title: 'Em breve!', description: 'O portal de gerenciamento de assinaturas estará disponível em breve.' });
    };

    if (isLoading) {
        return (
            <div className="flex flex-col space-y-8 p-8">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        )
    }

    if (!planInfo) {
        return <div className="p-8">Não foi possível carregar os dados do plano. Tente novamente mais tarde.</div>;
    }

    const isSubscriptionEnding = planInfo.expiresAt && new Date(planInfo.expiresAt).getTime() - Date.now() < 5 * 24 * 60 * 60 * 1000;

    return (
        <>
            <div className="flex-col md:flex">
                <div className="flex-1 space-y-4 p-8 pt-6">
                    <div className="flex items-center justify-between space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight">Meu Plano</h2>
                    </div>

                    {subscriptionError === 'subscription_inactive' && <SubscriptionInactiveAlert />}

                    {isSubscriptionEnding && (
                        <Alert variant="destructive">
                            <XCircle className="h-4 w-4" />
                            <AlertTitle>Atenção!</AlertTitle>
                            <AlertDescription>
                                Sua assinatura está prestes a expirar. Atualize seu pagamento para evitar a interrupção do serviço.
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                        <Card className="col-span-4">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    Visão Geral da Assinatura
                                    <Badge variant={getStatusVariant()}>{planInfo.statusLabel}</Badge>
                                </CardTitle>
                            <CardDescription>{planInfo.expiresAtLabel}</CardDescription>
                        </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="text-4xl font-bold">{planInfo.planName}</div>
                                <div>
                                    <h3 className="font-semibold mb-2">Funcionalidades do seu plano:</h3>
                                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                        {planInfo.features.map((feature, index) => (
                                            <li key={index}>{feature}</li>
                                        ))}
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="col-span-3">
                                    <CardHeader>
                                        <CardTitle>Gerenciar Plano</CardTitle>
                                        <CardDescription>Opções de gerenciamento da sua assinatura.</CardDescription>
                                    </CardHeader>
                            <CardContent className="grid gap-4">
                                <Button onClick={handleManageSubscription}>
                                    {planInfo.status === 'active' ? 'Alterar Plano' : 'Mudar de Plano'}
                                        </Button>
                                <Button variant="outline" disabled={!isSubscriptionEnding} onClick={handleManageSubscription}>
                                            Atualizar Pagamento
                                        </Button>
                                <Button variant="destructive" disabled>
                                    <Ban className="mr-2 h-4 w-4" />
                                            Cancelar Assinatura
                                        </Button>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Planos Disponíveis</CardTitle>
                            <CardDescription>Escolha o plano que melhor se adapta às suas necessidades.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {availablePlans.map((plan) => (
                                <Card key={plan.id} className="flex flex-col">
                                    <CardHeader>
                                        <CardTitle>{plan.name}</CardTitle>
                                        <CardDescription>{formatCurrency(plan.price)} / mês</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                        <ul className="space-y-2">
                                            {plan.features.map((feature, index) => (
                                                <li key={index} className="flex items-center">
                                                    <Check className="mr-2 h-4 w-4 text-green-500" />
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                    <CardFooter>
                                        {planInfo.planId === plan.id ? (
                                            <Button disabled variant="outline" className="w-full">Seu Plano Atual</Button>
                                        ) : (
                                            <Button 
                                                onClick={() => handlePlanSelection(plan)}
                                                className="w-full"
                                                disabled={isProcessingPayment || !!pollingSubscriptionId}
                                            >
                                                {(isProcessingPayment || pollingSubscriptionId) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                {pollingSubscriptionId ? 'Processando...' : (planInfo.planId ? 'Mudar Plano' : 'Assinar')}
                                            </Button>
                                        )}
                                    </CardFooter>
                                </Card>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {selectedPlan && (
                <PaymentMethodDialog
                    isOpen={isPaymentDialogOpen}
                    onClose={() => {
                        setIsPaymentDialogOpen(false);
                        setSelectedPlan(null);
                    }}
                    onConfirm={handlePaymentMethodSelection}
                    planName={selectedPlan.name}
                    price={selectedPlan.price}
                    isLoading={isProcessingPayment}
                />
            )}

            {qrCodeData && (
                <QrCodeDialog
                    isOpen={isQrCodeDialogOpen}
                    onClose={() => setIsQrCodeDialogOpen(false)}
                    qrCode={qrCodeData.code}
                    qrCodeBase64={qrCodeData.base64}
                    subscriptionId={qrCodeData.subscriptionId}
                />
            )}
        </>
    );
}
