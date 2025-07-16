'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SaasPlan } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Edit, Trash2, Loader2, Check } from 'lucide-react';
import { PlanFormDialog } from './plan-form-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { deleteSaasPlan, getSaasPlans } from '../actions';
import { Badge } from '@/components/ui/badge';

interface PlansManagerProps {
  initialPlans: SaasPlan[];
}

function formatCurrency(value: number) {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

export function PlansManager({ initialPlans }: PlansManagerProps) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SaasPlan | null>(null);
  const [plans, setPlans] = useState(initialPlans);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAddPlan = () => {
    setSelectedPlan(null);
    setIsFormOpen(true);
  };

  const handleEditPlan = (plan: SaasPlan) => {
    setSelectedPlan(plan);
    setIsFormOpen(true);
  };

  const handleDeletePlan = async (planId: string) => {
    setIsDeleting(planId);
    const result = await deleteSaasPlan(planId);
    if (result.success) {
      toast({ title: 'Sucesso!', description: result.message });
      setPlans(plans.filter(p => p.id !== planId));
      router.refresh();
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: result.message });
    }
    setIsDeleting(null);
  };

  return (
    <>
      <Card className="max-w-3xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Planos de Assinatura (SaaS)</CardTitle>
            <CardDescription>
              Adicione e gerencie os planos que seus clientes podem assinar para usar a plataforma.
            </CardDescription>
          </div>
          <Button onClick={handleAddPlan}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar Plano
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {plans.length > 0 ? (
              plans.map(plan => (
                <div key={plan.id} className="flex items-start justify-between rounded-md border p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h4 className="font-semibold">{plan.name}</h4>
                        <Badge variant={plan.isActive ? 'default' : 'secondary'}>{plan.isActive ? 'Ativo' : 'Inativo'}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(plan.price)} / {plan.durationDays} dias
                    </p>
                     <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {plan.features.map(feature => (
                            <li key={feature} className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-primary" />
                            <span>{feature}</span>
                            </li>
                        ))}
                    </ul>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="ghost" size="icon" onClick={() => handleEditPlan(plan)}>
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Editar</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isDeleting === plan.id}>
                          {isDeleting === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          <span className="sr-only">Excluir</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso excluirá permanentemente o plano "{plan.name}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeletePlan(plan.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Sim, excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum plano de assinatura encontrado. Adicione o primeiro!
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <PlanFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        plan={selectedPlan}
        onPlanSaved={() => {
          // refresh data
          router.refresh();
        }}
      />
    </>
  );
}
