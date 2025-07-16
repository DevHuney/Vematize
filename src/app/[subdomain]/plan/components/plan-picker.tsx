'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, CreditCard, DollarSign } from 'lucide-react';
import { getAvailablePlans, createCheckoutSession } from '../actions';
import { SaasPlan } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

type PlanPickerProps = {
    subdomain: string;
    currentPlanId?: string;
};

export function PlanPicker({ subdomain, currentPlanId }: PlanPickerProps) {
    const [plans, setPlans] = useState<SaasPlan[]>([]);
    const [selectedPlan, setSelectedPlan] = useState<SaasPlan | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('card');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        async function fetchPlans() {
            const availablePlans = await getAvailablePlans();
            setPlans(availablePlans);
        }
        fetchPlans();
    }, []);

    const handlePlanSelection = async (plan: SaasPlan) => {
        if (plan.id === currentPlanId) return;

        setSelectedPlan(plan);
        setIsLoading(true);

        try {
            const { init_point, error } = await createCheckoutSession(plan.id, subdomain, paymentMethod);

            if (error) {
                toast({
                    title: 'Erro ao processar pagamento',
                    description: error,
                    variant: 'destructive',
                });
                return;
            }

            if (init_point) {
                router.push(init_point);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
                <Card key={plan.id} className={currentPlanId === plan.id ? 'border-primary' : ''}>
                    <CardHeader>
                        <CardTitle>{plan.name}</CardTitle>
                        <CardDescription>{plan.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-baseline">
                            <span className="text-4xl font-bold">R${plan.price}</span>
                            <span className="text-muted-foreground">/mês</span>
                        </div>
                        <ul className="space-y-2">
                            {plan.features.map((feature) => (
                                <li key={feature} className="flex items-center">
                                    <Check className="h-4 w-4 mr-2 text-green-500" />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                    <CardFooter className="flex flex-col items-stretch space-y-4">
                        {currentPlanId === plan.id ? (
                            <Button disabled variant="outline">Seu Plano Atual</Button>
                        ) : (
                            <>
                                <div>
                                    <Label className="font-semibold">Forma de Pagamento:</Label>
                                    <RadioGroup
                                        defaultValue="card"
                                        className="flex space-x-4 mt-2"
                                        onValueChange={(value: 'pix' | 'card') => setPaymentMethod(value)}
                                    >
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="card" id={`card-${plan.id}`} />
                                            <Label htmlFor={`card-${plan.id}`}>Cartão</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="pix" id={`pix-${plan.id}`} />
                                            <Label htmlFor={`pix-${plan.id}`}>PIX</Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                                <Button 
                                    onClick={() => handlePlanSelection(plan)} 
                                    disabled={isLoading || (selectedPlan?.id === plan.id && isLoading)}
                                >
                                    {isLoading && selectedPlan?.id === plan.id ? 'Processando...' : (currentPlanId ? 'Mudar Plano' : 'Assinar')}
                                </Button>
                            </>
                        )}
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
} 