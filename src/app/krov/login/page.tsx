'use client'

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
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
import { login } from "./actions"
import { ForcePasswordChangeDialog } from "@/components/admin/force-password-change-dialog"

const formSchema = z.object({
  username: z.string().min(1, { message: "O e-mail é obrigatório." }),
  password: z.string().min(1, { message: "A senha é obrigatória." }),
})

export default function AdminLoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  useEffect(() => {
    const shouldForceChange = sessionStorage.getItem('forcePasswordChange') === 'true';
    if (shouldForceChange) {
      setShowPasswordDialog(true);
    }
  }, []);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    
    try {
      const result = await login(values)
      if (result.success) {
        if (result.temporary) {
          sessionStorage.setItem('forcePasswordChange', 'true');
          setShowPasswordDialog(true);
        } else {
          sessionStorage.removeItem('forcePasswordChange');
          router.push('/krov/dashboard');
        }
      } else {
        toast({
          variant: "destructive",
          title: "Erro de login",
          description: result.message,
        })
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

  const handlePasswordChangeSuccess = () => {
    setShowPasswordDialog(false);
    sessionStorage.removeItem('forcePasswordChange');
    // Forçar o usuário a fazer login novamente com as novas credenciais
    toast({
        title: "Sucesso",
        description: "Sua senha foi alterada. Por favor, faça o login novamente."
    });
    form.reset(); 
  }


  return (
    <>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold">Painel Krov</CardTitle>
            <CardDescription>Acesse o painel de super administrador.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="seu@email.com" {...field} />
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
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
                  )}
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
      <ForcePasswordChangeDialog 
        open={showPasswordDialog}
        onSuccess={handlePasswordChangeSuccess}
      />
    </>
  );
}
