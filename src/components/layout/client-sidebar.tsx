'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import {
  LayoutDashboard,
  Settings,
  LogOut,
  Users,
  CreditCard,
  BotMessageSquare,
  Package,
} from 'lucide-react';
import { VematizeLogo } from '../icons/logo';

export default function ClientSidebar() {
  const pathname = usePathname();
  const subdomain = pathname.split('/')[1];

  const sidebarNavItems = [
    { title: 'Dashboard', href: `/${subdomain}/dashboard`, icon: LayoutDashboard },
    { title: 'Meus Bots', href: `/${subdomain}/bots`, icon: BotMessageSquare },
    { title: 'Produtos', href: `/${subdomain}/products`, icon: Package },
    { title: 'Usuários', href: `/${subdomain}/users`, icon: Users },
    { title: 'Meu Plano', href: `/${subdomain}/plan`, icon: CreditCard },
    { title: 'Configurações', href: `/${subdomain}/settings`, icon: Settings },
  ];
  
  return (
    <aside className="relative hidden w-64 flex-col border-r bg-background lg:flex">
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center border-b px-6">
            <Link href={`/${subdomain}/dashboard`} className="flex items-center gap-2 font-semibold">
                <VematizeLogo className="h-6 w-6 text-primary" />
                <span className="">Painel do Cliente</span>
            </Link>
        </div>
        {/* Content */}
        <nav className="flex-1 overflow-y-auto py-2">
            <div className="grid items-start gap-1 px-4 text-sm font-medium">
                {sidebarNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname.startsWith(item.href);
                  return (
                      <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                          buttonVariants({ variant: isActive ? 'default' : 'ghost' }),
                          'justify-start'
                      )}
                      >
                      <Icon className="mr-2 h-4 w-4" />
                      {item.title}
                      </Link>
                  );
                })}
            </div>
        </nav>
        {/* Footer */}
        <div className="mt-auto shrink-0 border-t p-4">
            <Link href="/logout" className={cn(buttonVariants({ variant: 'ghost' }), 'w-full justify-start')}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
            </Link>
        </div>
    </aside>
  );
}
