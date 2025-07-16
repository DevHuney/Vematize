'use client'

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2 } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { ClientRegisterSchema } from "@/lib/schemas"
import { registerClient } from "./actions"

export default function RegisterPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<z.infer<typeof ClientRegisterSchema>>({
    resolver: zodResolver(ClientRegisterSchema),
    defaultValues: {
      name: "",
      subdomain: "",
      cpfCnpj: "",
      email: "",
      password: "",
    },
  })

  async function onSubmit(values: z.infer<typeof ClientRegisterSchema>) {
    setIsSubmitting(true);
    try {
      const result = await registerClient(values);
      if (result.success) {
        toast({
          title: 'Sucesso!',
          description: result.message,
        });
        // Redirect to login after a short delay to allow the user to read the toast
        setTimeout(() => router.push('/login'), 2000);
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro no cadastro',
          description: result.message,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro inesperado',
        description: 'Ocorreu um erro. Por favor, tente novamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 dark">
        <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold">Criar sua Conta</CardTitle>
            <CardDescription>Comece seus 30 dias de teste gratuito.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                     <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Nome Completo</FormLabel>
                              <FormControl>
                                  <Input placeholder="Seu nome completo" {...field} />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                    />
                    <FormField
                    control={form.control}
                    name="subdomain"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Seu Subdomínio</FormLabel>
                            <FormControl>
                                <div className="flex items-center">
                                    <Input placeholder="sua-loja" className="rounded-r-none" {...field}/>
                                    <span className="inline-flex items-center px-3 text-sm text-muted-foreground border border-l-0 rounded-r-md h-10">
                                        .meubot.com
                                    </span>
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="cpfCnpj"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>CPF ou CNPJ</FormLabel>
                            <FormControl>
                                <Input placeholder="Seu CPF ou CNPJ para o teste" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                                <Input type="email" placeholder="seu@email.com" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Senha</FormLabel>
                            <FormControl>
                                <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                    />
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : "Criar Conta"}
                    </Button>
                    <div className="mt-4 text-center text-sm">
                        Já tem uma conta?{" "}
                        <Link href="/login" className="underline">
                            Faça login
                        </Link>
                    </div>
                </form>
            </Form>
        </CardContent>
        </Card>
    </main>
  );
}
