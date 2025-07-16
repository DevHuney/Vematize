'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ClientLogoutPage() {
  const router = useRouter();

  useEffect(() => {
    // In a real app, this is where you would clear JWT tokens or other client-side session data.
    sessionStorage.removeItem('userInfo');
    // For now, we just redirect.
    router.push('/login');
  }, [router]);

  return (
     <div className="flex h-screen w-full items-center justify-center bg-background">
        <p>Saindo...</p>
    </div>
  );
}
