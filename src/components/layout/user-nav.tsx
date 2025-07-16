'use client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface UserNavProps {
    userType: 'admin' | 'client';
}

export function UserNav({ userType }: UserNavProps) {
  const [user, setUser] = useState({ name: '', email: '', subdomain: '' });
  const pathname = usePathname();

  useEffect(() => {
    if (userType === 'client') {
      const userInfoString = sessionStorage.getItem('userInfo');
      if (userInfoString) {
        try {
          const userInfo = JSON.parse(userInfoString);
          setUser({ name: userInfo.name || 'Cliente', email: userInfo.email || '', subdomain: userInfo.subdomain || '' });
        } catch (e) {
            setUser({ name: 'Cliente', email: '', subdomain: '' });
        }
      } else {
        const pathSubdomain = pathname.split('/')[1];
        if (pathSubdomain && userType === 'client') {
            setUser(prev => ({...prev, subdomain: pathSubdomain}));
        }
      }
    } else {
      setUser({ name: 'Krov', email: 'admin@krov.com', subdomain: '' });
    }
  }, [userType, pathname]);


  // Define paths based on user type to route correctly
  const settingsPath = userType === 'admin' ? '/krov/settings' : (user.subdomain ? `/${user.subdomain}/settings` : '#');
  const logoutPath = userType === 'admin' ? '/krov/logout' : '/logout';


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{user.name ? user.name.charAt(0).toUpperCase() : 'A'}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <Link href={settingsPath}>
            <DropdownMenuItem className="cursor-pointer" disabled={!user.subdomain}>
              Configurações
            </DropdownMenuItem>
          </Link>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <Link href={logoutPath}>
            <DropdownMenuItem className="cursor-pointer">
              Sair
            </DropdownMenuItem>
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
