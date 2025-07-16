'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { SaasPlanSchema } from '@/lib/schemas';
import type { SaasPlan } from '@/lib/types';
import { saveSaasPlan } from '../actions';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

interface PlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: SaasPlan | null;
  onPlanSaved: () => void;
}

const availableFeatures = [
  'Acesso ao WhatsApp',
  'Acesso ao Instagram',
  'Acesso ao Telegram',
  'Gestão de usuários completa',
  'Dashboard de estatísticas',
  'Suporte prioritário',
  'Relatórios de vendas',
];

export function PlanFormDialog({ open, onOpenChange, plan, onPlanSaved }: PlanFormDialogProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<z.infer<typeof SaasPlanSchema>>({
    resolver: zodResolver(SaasPlanSchema),
    defaultValues: {
      name: '',
      price: undefined,
      durationDays: undefined,
      features: [],
      isActive: true,
    },
  });

  useEffect(() => {
    if (open) {
      if (plan) {
        form.reset({
          id: plan.id,
          name: plan.name,
          price: plan.price,
          durationDays: plan.durationDays,
          features: plan.features || [],
          isActive: plan.isActive,
        });
      } else {
        form.reset({
          name: '',
          price: undefined,
          durationDays: undefined,
          features: [],
          isActive: true,
        });
      }
    }
  }, [plan, form, open]);

  async function onSubmit(values: z.infer<typeof SaasPlanSchema>) {
    setIsSaving(true);
    try {
      const result = await saveSaasPlan(values);
      if (result.success) {
        toast({ title: 'Sucesso!', description: result.message });
        onPlanSaved();
        onOpenChange(false);
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.message });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro inesperado', description: 'Ocorreu um erro. Por favor, tente novamente.' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{plan ? 'Editar Plano' : 'Adicionar Novo Plano'}</DialogTitle>
          <DialogDescription>
            {plan ? 'Atualize os detalhes deste plano.' : 'Crie um novo plano para seus clientes.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Plano</FormLabel>
                  <FormControl><Input placeholder="Ex: Plano Mensal" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
               <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Preço (R$)</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="29.90" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="durationDays"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Duração (dias)</FormLabel>
                    <FormControl><Input type="number" placeholder="30" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
             <FormField
                control={form.control}
                name="features"
                render={() => (
                    <FormItem>
                    <div className="mb-4">
                        <FormLabel>Funcionalidades</FormLabel>
                        <FormDescription>
                        Selecione as funcionalidades incluídas neste plano.
                        </FormDescription>
                    </div>
                    <div className="space-y-2">
                        {availableFeatures.map((feature) => (
                            <FormField
                            key={feature}
                            control={form.control}
                            name="features"
                            render={({ field }) => {
                                return (
                                <FormItem
                                    key={feature}
                                    className="flex flex-row items-center space-x-3 space-y-0"
                                >
                                    <FormControl>
                                    <Checkbox
                                        checked={field.value?.includes(feature)}
                                        onCheckedChange={(checked) => {
                                        return checked
                                            ? field.onChange([...(field.value || []), feature])
                                            : field.onChange(
                                                (field.value || []).filter(
                                                (value) => value !== feature
                                                )
                                            )
                                        }}
                                    />
                                    </FormControl>
                                    <FormLabel className="font-normal text-sm">
                                    {feature}
                                    </FormLabel>
                                </FormItem>
                                )
                            }}
                            />
                        ))}
                    </div>
                    <FormMessage />
                    </FormItem>
                )}
                />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                        <FormLabel>Plano Ativo</FormLabel>
                        <FormDescription>
                            Se inativo, o plano não aparecerá para novos clientes.
                        </FormDescription>
                    </div>
                    <FormControl>
                        <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        />
                    </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                ) : (
                  'Salvar Plano'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
