'use client';

import Sidebar from "@/components/layout/sidebar";
import { usePathname } from 'next/navigation';

export default function KrovLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Do not show sidebar on the login page
  if (pathname === '/krov/login') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        {children}
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}
