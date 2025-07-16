'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, CreditCard, DollarSign } from 'lucide-react';
import { getAvailablePlans, createSubscriptionPayment } from '../actions';
import { SaasPlan } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { QrCodeDialog } from './qr-code-dialog';

interface PlanPickerProps {
    subdomain: string;
    currentPlanId: string | null;
}

export function PlanPicker({ subdomain, currentPlanId }: PlanPickerProps) {
    const { toast } = useToast();
    const [plans, setPlans] = useState<SaasPlan[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
    const [isQrCodeDialogOpen, setIsQrCodeDialogOpen] = useState(false);
    const [qrCodeData, setQrCodeData] = useState<{ qrCode: string; qrCodeBase64: string, subscriptionId: string } | null>(null);

    useEffect(() => {
        async function fetchPlans() {
            const fetchedPlans = await getAvailablePlans();
            setPlans(fetchedPlans);
            if (!currentPlanId && fetchedPlans.length > 0) {
                setSelectedPlanId(fetchedPlans[0].id!);
            } else {
                setSelectedPlanId(currentPlanId);
            }
        }
        fetchPlans();
    }, [currentPlanId]);

    const handleSubscription = async () => {
        if (!selectedPlanId) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Por favor, selecione um plano.' });
            return;
        }
        setIsLoading(true);
        try {
            const result = await createSubscriptionPayment(selectedPlanId, subdomain, paymentMethod);

            if (result.error) {
                toast({ variant: 'destructive', title: 'Erro ao criar pagamento', description: result.error });
            } else if (paymentMethod === 'pix' && result.qrCodeBase64) {
                 setQrCodeData({
                    qrCode: result.qrCode!,
                    qrCodeBase64: result.qrCodeBase64!,
                    subscriptionId: result.subscriptionId!
                });
                setIsQrCodeDialogOpen(true);
            } else if (paymentMethod === 'card' && result.init_point) {
                window.location.href = result.init_point;
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro inesperado', description: 'Ocorreu um erro ao processar sua solicitação.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-4">Escolha o plano ideal para você</h2>
            <p className="text-center text-muted-foreground mb-8">
                Todos os planos incluem acesso a todos os recursos. Sem taxas escondidas.
            </p>

            <RadioGroup
                value={selectedPlanId ?? ""}
                onValueChange={setSelectedPlanId}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
                {plans.map((plan) => (
                    <Label key={plan.id} htmlFor={plan.id} className="cursor-pointer">
                        <Card className={`flex flex-col h-full ${selectedPlanId === plan.id ? 'border-primary' : ''}`}>
                             <CardHeader>
                                <div className="flex justify-between items-start">
                                    <h3 className="text-2xl font-semibold">{plan.name}</h3>
                                    <RadioGroupItem value={plan.id!} id={plan.id} />
                                </div>
                                <p className="text-4xl font-bold">
                                    R$ {plan.price.toFixed(2)}
                                    <span className="text-sm font-normal text-muted-foreground">/{plan.durationDays} dias</span>
                                </p>
                            </CardHeader>
                            <CardContent className="flex-1 space-y-4">
                                <ul className="space-y-2">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-center">
                                            <Check className="h-4 w-4 mr-2 text-green-500" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </Label>
                ))}
            </RadioGroup>

            <div className="mt-10 flex flex-col items-center gap-6">
                 <RadioGroup 
                    defaultValue="pix" 
                    onValueChange={(value: 'pix' | 'card') => setPaymentMethod(value)}
                    className="flex items-center gap-6"
                >
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="pix" id="pix" />
                        <Label htmlFor="pix" className="flex items-center gap-2 cursor-pointer">
                            <DollarSign className="h-5 w-5" />
                            <span>Pagar com PIX</span>
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="card" id="card" />
                        <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer">
                            <CreditCard className="h-5 w-5" />
                            <span>Pagar com Cartão</span>
                        </Label>
                    </div>
                </RadioGroup>

                <Button onClick={handleSubscription} disabled={isLoading || !selectedPlanId} size="lg">
                    {isLoading ? "Processando..." : "Assinar Agora"}
                </Button>
            </div>
             <QrCodeDialog 
                isOpen={isQrCodeDialogOpen}
                onClose={() => setIsQrCodeDialogOpen(false)}
                qrCodeData={qrCodeData}
                subdomain={subdomain}
            />
        </div>
    );
} 