'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    // Clear any client-side session info, like the password change flag
    sessionStorage.removeItem('forcePasswordChange');
    
    // Redirect to the appropriate login page
    router.push('/krov/login'); 
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
        <p>Saindo...</p>
    </div>
  );
}
