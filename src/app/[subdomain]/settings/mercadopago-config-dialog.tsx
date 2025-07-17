'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Copy, PartyPopper } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MercadoPagoSettingsSchema } from '@/lib/schemas';
import { updateMercadoPagoSettings } from './actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

type MercadoPagoSettings = z.infer<typeof MercadoPagoSettingsSchema>;

interface MercadoPagoConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: MercadoPagoSettings | null;
  subdomain: string;
}

export function MercadoPagoConfigDialog({ open, onOpenChange, settings, subdomain }: MercadoPagoConfigDialogProps) {
    const { toast } = useToast();
    const [baseUrl, setBaseUrl] = useState('');
    const [localMode, setLocalMode] = useState(settings?.mode ?? 'sandbox');

    const form = useForm<MercadoPagoSettings>({
        resolver: zodResolver(MercadoPagoSettingsSchema),
        defaultValues: settings || {
            mode: 'sandbox',
            sandbox_public_key: '',
            sandbox_access_token: '',
            production_public_key: '',
            production_access_token: '',
        },
    });

    useEffect(() => {
        if (open) {
            setLocalMode(settings?.mode ?? 'sandbox');
            form.reset(settings || { mode: 'sandbox' });
        }
        setBaseUrl(window.location.origin);
    }, [open, settings, form]);

    const webhookUrl = `${baseUrl}/${subdomain}/api/webhook/${localMode === 'sandbox' ? 'sand' : ''}mercadopago`;

    async function onSubmit(data: MercadoPagoSettings) {
        const result = await updateMercadoPagoSettings(subdomain, data);
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
                <DialogTitle>Configurar Mercado Pago</DialogTitle>
                <DialogDescription>
                    Conecte sua conta do Mercado Pago para começar a receber pagamentos.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-4 p-1">
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
                                                checked={localMode === 'production'}
                                                onCheckedChange={(checked) => {
                                                    const newMode = checked ? 'production' : 'sandbox';
                                                    setLocalMode(newMode);
                                                    field.onChange(newMode);
                                                }}
                                            />
                                        </FormControl>
                                        <Label>Produção</Label>
                                    </div>
                                </FormItem>
                            )}
                        />

                        <Separator />
                        
                        <div className="space-y-2" style={{ display: localMode === 'sandbox' ? 'block' : 'none' }}>
                            <h3 className="text-lg font-medium">Credenciais de Teste (Sandbox)</h3>
                            <FormField
                                key={`sandbox_public_key_${settings?.sandbox_public_key ?? ''}`}
                                control={form.control}
                                name='sandbox_public_key'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Public Key</FormLabel>
                                        <FormControl>
                                            <Input
                                                key={`sandbox_public_key_input_${settings?.sandbox_public_key ?? ''}`}
                                                placeholder="APP_USR-..."
                                                defaultValue={settings?.sandbox_public_key ?? ''}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                key={`sandbox_access_token_${settings?.sandbox_access_token ?? ''}`}
                                control={form.control}
                                name='sandbox_access_token'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Access Token</FormLabel>
                                        <FormControl>
                                            <Input
                                                key={`sandbox_access_token_input_${settings?.sandbox_access_token ?? ''}`}
                                                type="password"
                                                placeholder="TEST-..."
                                                defaultValue={settings?.sandbox_access_token ?? ''}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                key={`sandbox_webhook_secret_${settings?.sandbox_webhook_secret ?? ''}`}
                                control={form.control}
                                name='sandbox_webhook_secret'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Webhook Signing Secret</FormLabel>
                                        <FormControl>
                                            <Input
                                                key={`sandbox_webhook_secret_input_${settings?.sandbox_webhook_secret ?? ''}`}
                                                type="password"
                                                placeholder="••••••••••••••••"
                                                defaultValue={settings?.sandbox_webhook_secret ?? ''}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-2" style={{ display: localMode === 'production' ? 'block' : 'none' }}>
                            <h3 className="text-lg font-medium">Credenciais de Produção</h3>
                            <FormField
                                key={`production_public_key_${settings?.production_public_key ?? ''}`}
                                control={form.control}
                                name='production_public_key'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Public Key</FormLabel>
                                        <FormControl>
                                            <Input
                                                key={`production_public_key_input_${settings?.production_public_key ?? ''}`}
                                                placeholder="APP_USR-..."
                                                defaultValue={settings?.production_public_key ?? ''}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                key={`production_access_token_${settings?.production_access_token ?? ''}`}
                                control={form.control}
                                name='production_access_token'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Access Token</FormLabel>
                                        <FormControl>
                                            <Input
                                                key={`production_access_token_input_${settings?.production_access_token ?? ''}`}
                                                type="password"
                                                placeholder="PROD-..."
                                                defaultValue={settings?.production_access_token ?? ''}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                key={`production_webhook_secret_${settings?.production_webhook_secret ?? ''}`}
                                control={form.control}
                                name='production_webhook_secret'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Webhook Signing Secret</FormLabel>
                                        <FormControl>
                                            <Input
                                                key={`production_webhook_secret_input_${settings?.production_webhook_secret ?? ''}`}
                                                type="password"
                                                placeholder="••••••••••••••••"
                                                defaultValue={settings?.production_webhook_secret ?? ''}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Separator className="my-4" />

                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">URLs de Redirecionamento</h3>
                            <p className="text-sm text-muted-foreground">
                                Configure para onde o usuário será redirecionado após o pagamento. Se deixado em branco, o padrão será usado.
                            </p>
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
                                        <li>Cole a URL acima no campo correspondente ao modo ({localMode}) que você está configurando.</li>
                                        <li>Selecione o evento "Pagamentos" (payments).</li>
                                    </ol>
                                </AlertDescription>
                            </Alert>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? 'Salvando...' : 'Salvar Configurações'}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
  );
} 