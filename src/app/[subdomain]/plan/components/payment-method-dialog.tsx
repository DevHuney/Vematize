'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CreditCard, QrCode } from "lucide-react";
import { useState } from "react";

interface PaymentMethodDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (method: 'pix' | 'card') => void;
    planName: string;
    price: number;
    isLoading?: boolean;
}

export function PaymentMethodDialog({ isOpen, onClose, onConfirm, planName, price, isLoading }: PaymentMethodDialogProps) {
    const [selectedMethod, setSelectedMethod] = useState<'pix' | 'card'>('card');

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Escolha o método de pagamento</DialogTitle>
                    <DialogDescription>
                        Selecione como deseja pagar o plano {planName} - {price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
                    </DialogDescription>
                </DialogHeader>
                <div className="py-6">
                    <RadioGroup 
                        defaultValue="card" 
                        className="grid grid-cols-2 gap-4" 
                        onValueChange={(value: 'pix' | 'card') => setSelectedMethod(value)}
                    >
                        <div>
                            <RadioGroupItem value="card" id="card" className="peer sr-only" />
                            <Label
                                htmlFor="card"
                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                            >
                                <CreditCard className="mb-3 h-6 w-6" />
                                <span className="text-sm font-medium">Cartão de Crédito</span>
                            </Label>
                        </div>
                        <div>
                            <RadioGroupItem value="pix" id="pix" className="peer sr-only" />
                            <Label
                                htmlFor="pix"
                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                            >
                                <QrCode className="mb-3 h-6 w-6" />
                                <span className="text-sm font-medium">PIX</span>
                            </Label>
                        </div>
                    </RadioGroup>
                </div>
                <div className="flex justify-end gap-4">
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button 
                        disabled={isLoading} 
                        onClick={() => onConfirm(selectedMethod)}
                    >
                        {isLoading ? 'Processando...' : 'Continuar'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
} 