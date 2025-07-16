'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Copy, PartyPopper, Loader2 } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MercadoPagoSettingsSchema } from '@/lib/schemas';
import { updateSettings } from '../actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { KrovSettings } from '@/lib/types';

type MercadoPagoSettings = z.infer<typeof MercadoPagoSettingsSchema>;

interface MercadoPagoConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: KrovSettings | null;
}

export function MercadoPagoConfigDialog({ open, onOpenChange, settings }: MercadoPagoConfigDialogProps) {
    const { toast } = useToast();
    const [baseUrl, setBaseUrl] = useState('');
    const mpSettings = settings?.paymentIntegrations?.mercadopago;
    const [useCustomRedirects, setUseCustomRedirects] = useState(
        !!(mpSettings?.success_url || mpSettings?.failure_url || mpSettings?.pending_url)
    );

    const form = useForm<MercadoPagoSettings>({
        resolver: zodResolver(MercadoPagoSettingsSchema),
        defaultValues: settings?.paymentIntegrations?.mercadopago || {
            mode: 'sandbox',
            sandbox_public_key: '',
            sandbox_access_token: '',
            production_public_key: '',
            production_access_token: '',
        },
    });
    
    const { isSubmitting } = form.formState;
    const mode = form.watch('mode');
    const webhookUrl = `${baseUrl}/krov/api/webhook/${mode === 'sandbox' ? 'sand' : ''}mercadopago`;

    useEffect(() => {
        if (open) {
            const currentMpSettings = settings?.paymentIntegrations?.mercadopago;
            form.reset(currentMpSettings || { mode: 'sandbox' });
            setUseCustomRedirects(!!(currentMpSettings?.success_url || currentMpSettings?.failure_url || currentMpSettings?.pending_url));
        }
        setBaseUrl(window.location.origin);
    }, [open, settings, form]);
    
    async function onSubmit(data: MercadoPagoSettings) {
        let submissionData = { ...data };
        if (!useCustomRedirects) {
            submissionData = {
                ...submissionData,
                success_url: '',
                failure_url: '',
                pending_url: '',
            };
        }

        const newSettings: KrovSettings = {
            paymentIntegrations: {
                ...settings?.paymentIntegrations,
                mercadopago: submissionData,
            }
        }
        const result = await updateSettings(newSettings);
        toast({
            title: result.success ? 'Sucesso!' : 'Erro!',
            description: result.message,
            variant: result.success ? 'default' : 'destructive',
        });
        if (result.success) {
            onOpenChange(false);
        }
    }

    const copyToClipboard = () => {
        navigator.clipboard.writeText(webhookUrl);
        toast({ title: 'Copiado!', description: 'URL do Webhook copiada para a área de transferência.' });
    };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Configurar Mercado Pago (Admin)</DialogTitle>
                <DialogDescription>
                    Conecte a conta Mercado Pago principal que será usada como fallback.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-4 p-1 pr-4 max-h-[70vh] overflow-y-auto">
                        <FormField
                            control={form.control}
                            name="mode"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                    <div className="space-y-0.5">
                                        <FormLabel>Modo de Operação</FormLabel>
                                        <FormDescription>
                                            Use 'Sandbox' para testar e 'Produção' para pagamentos reais.
                                        </FormDescription>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Label>Sandbox</Label>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value === 'production'}
                                                    onCheckedChange={(checked) => field.onChange(checked ? 'production' : 'sandbox')}
                                                />
                                            </FormControl>
                                        <Label>Produção</Label>
                                    </div>
                                </FormItem>
                            )}
                        />

                        <Separator />
                        
                        <div className="space-y-2">
                            <h3 className="text-lg font-medium">Credenciais de {mode === 'sandbox' ? 'Teste (Sandbox)' : 'Produção'}</h3>
                            <FormField
                                control={form.control}
                                name={mode === 'sandbox' ? 'sandbox_public_key' : 'production_public_key'}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Public Key</FormLabel>
                                        <FormControl><Input placeholder="APP_USR-..." {...field} value={field.value ?? ''} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={mode === 'sandbox' ? 'sandbox_access_token' : 'production_access_token'}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Access Token</FormLabel>
                                        <FormControl><Input type="password" placeholder="TEST-..." {...field} value={field.value ?? ''} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={mode === 'sandbox' ? 'sandbox_webhook_secret' : 'production_webhook_secret'}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Webhook Secret</FormLabel>
                                        <FormControl><Input type="password" placeholder="Seu secret do webhook..." {...field} value={field.value ?? ''} /></FormControl>
                                        <FormDescription>
                                            Encontrado nas configurações de Webhooks da sua aplicação no Mercado Pago.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Separator className="my-4" />

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-medium">URLs de Redirecionamento</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Ative para usar URLs customizadas após o pagamento.
                                    </p>
                                </div>
                                <Switch
                                    checked={useCustomRedirects}
                                    onCheckedChange={setUseCustomRedirects}
                                />
                            </div>

                            {useCustomRedirects && (
                                <div className="space-y-4 pt-2">
                                    <FormField
                                        control={form.control}
                                        name="success_url"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>URL de Sucesso</FormLabel>
                                                <FormControl><Input placeholder="https://seusite.com/sucesso" {...field} value={field.value ?? ''} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="failure_url"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>URL de Falha</FormLabel>
                                                <FormControl><Input placeholder="https://seusite.com/falha" {...field} value={field.value ?? ''} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="pending_url"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>URL Pendente</FormLabel>
                                                <FormControl><Input placeholder="https://seusite.com/pendente" {...field} value={field.value ?? ''} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}
                        </div>

                        <Separator className="my-4" />

                        <div className="space-y-2">
                             <Label htmlFor="webhook-url">URL de Webhook</Label>
                             <div className="flex items-center space-x-2">
                                <Input id="webhook-url" readOnly value={webhookUrl} className="bg-secondary" />
                                <Button type="button" variant="outline" size="icon" onClick={copyToClipboard}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                             </div>
                             <Alert>
                                <PartyPopper className="h-4 w-4" />
                                <AlertTitle>Como configurar</AlertTitle>
                                <AlertDescription>
                                    <ol className="list-decimal list-inside space-y-1 mt-2">
                                        <li>Acesse seu <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noopener noreferrer" className="underline">Painel de Desenvolvedor</a>.</li>
                                        <li>Selecione sua aplicação e vá em "Webhooks".</li>
                                        <li>Cole a URL acima no campo correspondente ao modo ({mode}) que você está configurando.</li>
                                        <li>Selecione o evento "Pagamentos" (payments).</li>
                                    </ol>
                                </AlertDescription>
                            </Alert>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
  );
}