'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FileUp, Loader2, CreditCard, QrCode } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ProductSchema } from '@/lib/schemas';
import type { Product } from '@/lib/types';
import { saveProduct, getPaymentIntegrations } from '../actions';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from "@/components/ui/checkbox";

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSuccess: () => void;
  subdomain: string;
}

const formSchema = ProductSchema;

export function ProductFormDialog({ open, onOpenChange, product, onSuccess, subdomain }: ProductFormDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usedCodes, setUsedCodes] = useState<string[]>([]);
  const [availableGateways, setAvailableGateways] = useState<{ id: string; name: string; }[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      price: undefined,
      description: '',
      type: 'product',
      productSubtype: 'standard',
      stock: null,
      isTelegramGroupAccess: false,
      telegramGroupId: '',
      durationDays: null,
      activationCodes: '',
      discountPrice: null,
      offerExpiresAt: null,
      paymentMethods: {
        pix: undefined,
        credit_card: undefined,
      },
    },
  });
  
  const productType = form.watch('type');
  const productSubtype = form.watch('productSubtype');
  const isTelegramAccess = form.watch('isTelegramGroupAccess');
  const activationCodesValue = form.watch('activationCodes');
  const codeCount = activationCodesValue?.split('\n').filter(Boolean).length ?? 0;

  useEffect(() => {
    async function fetchGateways() {
        const gateways = await getPaymentIntegrations(subdomain);
        setAvailableGateways(gateways);
    }
    fetchGateways();
  }, [subdomain]);

  useEffect(() => {
    if (open) {
      const getFormattedDateTime = (isoString: string | undefined | null) => {
        if (!isoString) return '';
        try {
          const date = new Date(isoString);
          // Format to "YYYY-MM-DDTHH:mm" which is what datetime-local input expects
          const pad = (num: number) => num.toString().padStart(2, '0');
          return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
        } catch {
          return '';
        }
      };

      if (product) {
        form.reset({
          id: product.id,
          name: product.name,
          price: product.price,
          description: product.description,
          type: product.type || 'product',
          productSubtype: product.productSubtype || 'standard',
          stock: product.stock,
          isTelegramGroupAccess: product.isTelegramGroupAccess || false,
          telegramGroupId: product.telegramGroupId || '',
          durationDays: product.durationDays,
          activationCodes: Array.isArray(product.activationCodes) ? product.activationCodes.join('\n') : '',
          discountPrice: product.discountPrice,
          offerExpiresAt: getFormattedDateTime(product.offerExpiresAt),
          paymentMethods: product.paymentMethods || { pix: undefined, credit_card: undefined },
        });
        setUsedCodes(product.activationCodesUsed || []);
      } else {
        form.reset({
          name: '',
          price: undefined,
          description: '',
          type: 'product',
          productSubtype: 'standard',
          stock: null,
          isTelegramGroupAccess: false,
          telegramGroupId: '',
          durationDays: null,
          activationCodes: '',
          discountPrice: null,
          offerExpiresAt: null,
          paymentMethods: { pix: undefined, credit_card: undefined },
        });
        setUsedCodes([]);
      }
    }
  }, [product, form, open]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      // Convert local datetime string to ISO string before saving
      const dataToSave = {
        ...values,
        offerExpiresAt: values.offerExpiresAt ? new Date(values.offerExpiresAt).toISOString() : null,
      };

      const result = await saveProduct(subdomain, dataToSave);
      if (result.success) {
        toast({ title: 'Sucesso!', description: result.message });
        onSuccess();
        onOpenChange(false);
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.message });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro inesperado', description: 'Ocorreu um erro. Por favor, tente novamente.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar Produto/Serviço' : 'Adicionar Novo Produto/Serviço'}</DialogTitle>
          <DialogDescription>
            {product ? 'Atualize os detalhes.' : 'Crie um novo item para vender através do seu bot.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Produto/Serviço</FormLabel>
                  <FormControl><Input placeholder="Ex: Acesso VIP Mensal" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Descrição (Opcional)</FormLabel>
                    <FormControl><Textarea placeholder="Descreva seu produto ou serviço..." {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                        <FormLabel>Tipo de Venda</FormLabel>
                        <FormDescription>
                           É um pagamento único ou uma assinatura recorrente?
                        </FormDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className={field.value === 'product' ? 'font-semibold' : ''}>Produto</span>
                        <FormControl>
                            <Switch
                            checked={field.value === 'subscription'}
                            onCheckedChange={(checked) => field.onChange(checked ? 'subscription' : 'product')}
                            />
                        </FormControl>
                        <span className={field.value === 'subscription' ? 'font-semibold' : ''}>Assinatura</span>
                    </div>
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
                    <FormControl><Input type="number" step="0.01" placeholder="49.90" {...field} value={field.value ?? ''} /></FormControl>
                    <FormDescription>Use 0 para gratuito.</FormDescription>
                    <FormMessage />
                    </FormItem>
                )}
                />
                {productType === 'subscription' && (
                     <FormField
                        control={form.control}
                        name="durationDays"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Duração (dias)</FormLabel>
                                <FormControl><Input type="number" placeholder="30" {...field} value={field.value ?? ''} /></FormControl>
                                <FormDescription>Deixe em branco para vitalícia.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
            </div>
            
            <div className="space-y-4 rounded-lg border p-4">
                <h3 className="text-md font-medium">Oferta (Opcional)</h3>
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="discountPrice"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Preço com Desconto (R$)</FormLabel>
                            <FormControl><Input type="number" step="0.01" placeholder="29.90" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="offerExpiresAt"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Expiração da Oferta</FormLabel>
                            <FormControl><Input type="datetime-local" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
            </div>


            {productType === 'subscription' && (
                 <FormField
                    control={form.control}
                    name="isTelegramGroupAccess"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                                <FormLabel>Acesso a grupo do Telegram</FormLabel>
                                <FormDescription>
                                    Conceder acesso a um grupo após a assinatura.
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
            )}
            
            {isTelegramAccess && productType === 'subscription' && (
                 <FormField
                    control={form.control}
                    name="telegramGroupId"
                    render={({ field }) => (
                        <FormItem className="animate-accordion-down">
                        <FormLabel>ID do Grupo do Telegram</FormLabel>
                        <FormControl><Input placeholder="-100123456789" {...field} value={field.value ?? ''}/></FormControl>
                        <FormDescription>Adicione seu bot como admin no grupo para obter o ID.</FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            )}

            {productType === 'product' && (
                <div className="space-y-4 rounded-lg border p-4">
                     <FormField
                        control={form.control}
                        name="productSubtype"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Tipo de Produto</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="standard">Produto Padrão</SelectItem>
                                <SelectItem value="digital_file">Arquivo Digital</SelectItem>
                                <SelectItem value="activation_codes">Códigos de Ativação</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    
                    {productSubtype === 'standard' && (
                        <FormField
                            control={form.control}
                            name="stock"
                            render={({ field }) => (
                                <FormItem className="animate-accordion-down">
                                    <FormLabel>Estoque</FormLabel>
                                    <FormControl><Input type="number" placeholder="100" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormDescription>Deixe em branco para ilimitado.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}

                    {productSubtype === 'digital_file' && (
                         <div className="animate-accordion-down space-y-2">
                            <FormLabel>Arquivo do Produto</FormLabel>
                             <div className="flex items-center justify-center w-full">
                                <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-not-allowed bg-secondary/50">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <FileUp className="w-8 h-8 mb-4 text-muted-foreground" />
                                        <p className="mb-2 text-sm text-muted-foreground">Funcionalidade de upload em breve!</p>
                                    </div>
                                    <Input id="dropzone-file" type="file" className="hidden" disabled />
                                </label>
                            </div> 
                         </div>
                    )}

                    {productSubtype === 'activation_codes' && (
                         <>
                            <FormField
                                control={form.control}
                                name="activationCodes"
                                render={({ field }) => (
                                    <FormItem className="animate-accordion-down">
                                        <FormLabel>Códigos de Ativação (Disponíveis)</FormLabel>
                                        <FormControl><Textarea placeholder="Um código por linha..." {...field} rows={6} /></FormControl>
                                        <FormDescription>Cada linha será um item no estoque. Atualmente: {codeCount} códigos disponíveis.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             {usedCodes.length > 0 && (
                                <FormItem className="animate-accordion-down">
                                    <FormLabel>Códigos Usados</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            readOnly
                                            disabled
                                            value={usedCodes.join('\n')}
                                            rows={4}
                                            className="bg-secondary/50 cursor-not-allowed"
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Estes códigos já foram entregues. Total: {usedCodes.length} códigos usados.
                                    </FormDescription>
                                </FormItem>
                            )}
                        </>
                    )}
                </div>
            )}

            <Separator />
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Métodos de Pagamento</h3>
              <p className="text-sm text-muted-foreground">
                Selecione como seus clientes poderão pagar por este item.
              </p>
              {availableGateways.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border p-4">
                  <FormField
                    control={form.control}
                    name="paymentMethods.pix"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2"><QrCode className="h-5 w-5" /> Aceitar PIX</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || 'none'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o gateway" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {availableGateways.map(gw => (
                              <SelectItem key={gw.id} value={gw.id}>{gw.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>Pagamento via QR Code e Copia e Cola.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paymentMethods.credit_card"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Aceitar Cartão de Crédito</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || 'none'}>
                           <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o gateway" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                             {availableGateways.map(gw => (
                              <SelectItem key={gw.id} value={gw.id}>{gw.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>Pagamento via Checkout do Provedor.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : (
                 <Alert variant="default">
                    <QrCode className="h-4 w-4" />
                    <AlertTitle>Nenhum gateway de pagamento encontrado!</AlertTitle>
                    <AlertDescription>
                      Para aceitar pagamentos, primeiro configure uma integração na tela de <span className="font-semibold">Configurações</span>.
                    </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />
            
            <DialogFooter className="pt-4 sticky bottom-0 bg-background/95 pb-1">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                ) : (
                  'Salvar Produto'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
