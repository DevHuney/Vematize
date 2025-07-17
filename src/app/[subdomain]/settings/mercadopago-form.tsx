'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { MercadoPagoSettingsSchema } from '@/lib/schemas';
import { getMercadoPagoSettings, updateMercadoPagoSettings } from './actions';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

type MercadoPagoFormValues = z.infer<typeof MercadoPagoSettingsSchema>;

export function MercadoPagoForm({ subdomain }: { subdomain: string }) {
    const { toast } = useToast();
    const [mode, setMode] = useState<'sandbox' | 'production'>('sandbox');

    const form = useForm<MercadoPagoFormValues>({
        resolver: zodResolver(MercadoPagoSettingsSchema),
        defaultValues: {
            mode: 'sandbox',
            sandbox_public_key: '',
            sandbox_access_token: '',
            sandbox_webhook_secret: '',
            production_public_key: '',
            production_access_token: '',
            production_webhook_secret: '',
        },
    });

    useEffect(() => {
        async function fetchSettings() {
            const settings = await getMercadoPagoSettings(subdomain);
            if (settings) {
                form.reset(settings);
                setMode(settings.mode);
            }
        }
        fetchSettings();
    }, [subdomain, form]);

    async function onSubmit(data: MercadoPagoFormValues) {
        const result = await updateMercadoPagoSettings(subdomain, data);
        toast({
            title: result.success ? 'Sucesso!' : 'Erro!',
            description: result.message,
            variant: result.success ? 'default' : 'destructive',
        });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Integrações de Pagamento</CardTitle>
                <CardDescription>
                    Configure suas credenciais do Mercado Pago para receber pagamentos.
                </CardDescription>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-6">
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
                                                onCheckedChange={(checked) => {
                                                    const newMode = checked ? 'production' : 'sandbox';
                                                    field.onChange(newMode);
                                                    setMode(newMode);
                                                }}
                                            />
                                        </FormControl>
                                        <Label>Produção</Label>
                                    </div>
                                </FormItem>
                            )}
                        />

                        <Separator />

                        {mode === 'sandbox' && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium">Credenciais de Teste (Sandbox)</h3>
                                <FormField
                                    control={form.control}
                                    name='sandbox_public_key'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Public Key</FormLabel>
                                            <FormControl>
                                                <Input placeholder="APP_USR-..." {...field} value={field.value ?? ''} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name='sandbox_access_token'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Access Token</FormLabel>
                                            <FormControl>
                                                <Input type="password" placeholder="TEST-..." {...field} value={field.value ?? ''} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        {mode === 'production' && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium">Credenciais de Produção</h3>
                                <FormField
                                    control={form.control}
                                    name='production_public_key'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Public Key</FormLabel>
                                            <FormControl>
                                                <Input placeholder="APP_USR-..." {...field} value={field.value ?? ''} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name='production_access_token'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Access Token</FormLabel>
                                            <FormControl>
                                                <Input type="password" placeholder="PROD-..." {...field} value={field.value ?? ''} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
} 