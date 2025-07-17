'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { getSaasPlans } from '@/app/krov/settings/actions';
import type { SaasPlan } from '@/lib/types';
import { useState, useEffect } from 'react';
import { VematizeLogo } from '@/components/icons/logo';

function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const platforms = ['Telegram', 'WhatsApp', 'Instagram'];

// Trigger new deployment
export default function HomePage() {
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);

  // Animation state
  const [platformIndex, setPlatformIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch plans on mount
  useEffect(() => {
    const fetchPlans = async () => {
      setIsLoadingPlans(true);
      try {
        const allPlans = await getSaasPlans();
        setPlans(allPlans.filter(p => p.isActive));
      } catch (error) {
        console.error("Failed to fetch plans:", error);
      } finally {
        setIsLoadingPlans(false);
      }
    };
    fetchPlans();
  }, []);
  
  // Typing animation effect
  useEffect(() => {
    if (subIndex === platforms[platformIndex].length && !isDeleting) {
      const timer = setTimeout(() => {
        setIsDeleting(true);
      }, 1000); // Pause for 1 second before deleting
      return () => clearTimeout(timer);
    }

    if (subIndex === 0 && isDeleting) {
      setIsDeleting(false);
      setPlatformIndex(prev => (prev + 1) % platforms.length);
      return;
    }

    const timer = setTimeout(() => {
      setSubIndex(prev => prev + (isDeleting ? -1 : 1));
    }, isDeleting ? 75 : 100);

    return () => clearTimeout(timer);
  }, [subIndex, isDeleting, platformIndex]);
  
  const displayText = platforms[platformIndex].substring(0, subIndex);

  return (
    <div className="flex flex-col min-h-screen bg-background dark">
      <header className="px-4 lg:px-6 h-16 flex items-center border-b sticky top-0 z-20 bg-background/95 backdrop-blur">
        <Link href="/" className="flex items-center justify-center gap-2">
          <VematizeLogo className="h-6 w-6 text-primary" />
          <span className="font-bold">Vematize</span>
        </Link>
        <nav className="ml-auto flex items-center gap-4 sm:gap-6">
          <Button asChild variant="ghost">
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Comece Agora</Link>
          </Button>
        </nav>
      </header>
      <main className="flex-1 flex flex-col">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 flex items-center justify-center text-center bg-gradient-to-b from-background to-secondary/50">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 animate-fade-in">
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
                Automatize suas vendas
                 <span className="block">
                  no{' '}
                  <span className="text-primary">
                    {displayText}
                    <span className="animate-pulse">|</span>
                  </span>
                </span>
              </h1>
              <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                Crie, gerencie e escale seu bot de atendimento com nossa plataforma SaaS completa. Foco no seu negócio, não na infraestrutura.
              </p>
              <Button asChild size="lg" className="mt-4">
                <Link href="/register">Comece seus 30 Dias Grátis</Link>
              </Button>
            </div>
          </div>
        </section>

        <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-secondary flex items-center justify-center">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter text-center sm:text-5xl">
              Funcionalidades Poderosas
            </h2>
            <p className="max-w-3xl mx-auto mt-4 text-center text-muted-foreground md:text-xl">
              Tudo o que você precisa para gerenciar seu bot de forma eficiente.
            </p>
            <div className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-2 md:grid-cols-3 lg:gap-12 mt-12">
              <div className="grid gap-1 text-center">
                <h3 className="text-lg font-bold">Dashboard Intuitivo</h3>
                <p className="text-sm text-muted-foreground">
                  Visualize estatísticas de usuários, vendas e performance em um só lugar.
                </p>
              </div>
              <div className="grid gap-1 text-center">
                <h3 className="text-lg font-bold">Gestão de Usuários</h3>
                <p className="text-sm text-muted-foreground">
                  Controle total sobre os usuários do seu bot, status de assinatura e planos.
                </p>
              </div>
              <div className="grid gap-1 text-center">
                <h3 className="text-lg font-bold">Gateways de Pagamento</h3>
                <p className="text-sm text-muted-foreground">
                  Integração nativa com os principais gateways para automatizar suas vendas.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="w-full py-12 md:py-24 lg:py-32 flex items-center justify-center">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                Preços Simples e Transparentes
              </h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Escolha o plano que melhor se adapta às suas necessidades. Cancele quando quiser.
              </p>
            </div>
            <div className="mx-auto mt-12 grid max-w-5xl items-stretch justify-center gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {isLoadingPlans ? (
                 <div className="col-span-full text-center text-muted-foreground">
                    <p>Carregando planos...</p>
                 </div>
              ) : plans.length > 0 ? (
                plans.map(plan => (
                  <Card key={plan.id} className="flex flex-col shadow-lg hover:shadow-primary/20 transition-shadow">
                      <CardHeader className="items-center pb-4">
                          <CardTitle>{plan.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col flex-1 gap-4 pt-0">
                          <div className="flex items-baseline justify-center gap-2">
                              <span className="text-4xl font-bold">{formatCurrency(plan.price)}</span>
                              <span className="text-muted-foreground">/ {plan.durationDays % 30 === 0 && plan.durationDays > 0 ? (plan.durationDays / 30 === 1 ? 'mês' : `${plan.durationDays / 30} meses`) : `${plan.durationDays} dias`}</span>
                          </div>
                          <ul className="grid gap-2 text-sm flex-1">
                            {plan.features.map((feature) => (
                                <li key={feature} className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary" />
                                    {feature}
                                </li>
                            ))}
                          </ul>
                      </CardContent>
                      <CardFooter>
                           <Button asChild className="w-full">
                              <Link href="/register">Iniciar Teste Gratuito</Link>
                          </Button>
                      </CardFooter>
                  </Card>
                ))
              ) : (
                 <div className="col-span-full text-center text-muted-foreground">
                    <p>Nossos planos de assinatura serão divulgados em breve.</p>
                 </div>
              )}
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">
          &copy; 2024 Vematize. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}
