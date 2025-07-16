'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { SaasSettingsSchema } from '@/lib/schemas';
import { getMercadoPagoSettings, updateMercadoPagoSettings } from './actions';

type MercadoPagoFormValues = z.infer<typeof SaasSettingsSchema>;

export function MercadoPagoForm({ subdomain }: { subdomain: string }) {
    const { toast } = useToast();

    const form = useForm<MercadoPagoFormValues>({
        resolver: zodResolver(SaasSettingsSchema),
        defaultValues: {
            mercadopagoPublicKey: '',
            mercadopagoAccessToken: '',
        },
    });

    useEffect(() => {
        async function fetchSettings() {
            const settings = await getMercadoPagoSettings(subdomain);
            if (settings) {
                form.reset(settings);
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
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="mercadopagoPublicKey"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Mercado Pago - Public Key</FormLabel>
                                    <FormControl>
                                        <Input placeholder="APP_USR-..." {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="mercadopagoAccessToken"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Mercado Pago - Access Token</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="••••••••••••••••" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
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