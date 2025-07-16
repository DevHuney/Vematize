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
import { ClientLoginSchema } from "@/lib/schemas"
import { loginClient } from "./actions"

export default function ClientLoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<z.infer<typeof ClientLoginSchema>>({
    resolver: zodResolver(ClientLoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  async function onSubmit(values: z.infer<typeof ClientLoginSchema>) {
    setIsSubmitting(true);
    try {
      const result = await loginClient(values);
      if (result.success) {
        // Store user info in session storage to be used by other components
        sessionStorage.setItem('userInfo', JSON.stringify({ name: result.name, email: result.email, subdomain: result.subdomain }));
        router.push(`/${result.subdomain}/dashboard`);
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro de login',
          description: result.message,
        });
      }
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Erro inesperado",
        description: "Ocorreu um erro. Por favor, tente novamente.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-2xl font-bold">Painel do Cliente</CardTitle>
        <CardDescription>Use seu e-mail e senha para acessar sua conta.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                            <Input id="email" type="email" placeholder="seu@email.com" {...field} />
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
                            <Input id="password" type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin" /> : "Entrar"}
                </Button>
                <div className="mt-4 text-center text-sm">
                    Não tem uma conta?{" "}
                    <Link href="/register" className="underline">
                        Crie agora
                    </Link>
                </div>
            </form>
        </Form>
      </CardContent>
    </Card>
  );
}
