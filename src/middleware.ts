import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: [
    '/((?!api/|_next/|_static/|[\\w-]+\\.\\w+).*)',
  ],
};

export default async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get('host');
  
  const subdomain = hostname?.split('.')[0] || '';

  if (subdomain === 'krov' || subdomain === '' || subdomain === 'www' || url.pathname.startsWith('/login') || url.pathname.startsWith('/register')) {
    return NextResponse.next();
  }

  try {
    const api_url = `${url.protocol}//${hostname}/api/tenant-status/${subdomain}`;
    const response = await fetch(api_url);

    if (response.ok) {
        const { status } = await response.json();

        if (status === 'inactive') {
            const isAllowedPath = url.pathname.includes('/plan') || url.pathname.includes('/settings');
            
            if (!isAllowedPath) {
                console.log(`[Middleware] Bloqueando acesso para o tenant inativo: ${subdomain}. Redirecionando para /plan.`);
                const redirectUrl = new URL(url.pathname.startsWith(`/${subdomain}`) ? `/${subdomain}/plan` : `/plan`, req.url);
                redirectUrl.searchParams.set('error', 'subscription_inactive');
                return NextResponse.redirect(redirectUrl);
            }
        }
    } else {
        console.warn(`[Middleware] A verificação de status do tenant falhou com status ${response.status} para o subdomínio ${subdomain}.`);
    }

  } catch (error) {
    console.error('[Middleware] Erro ao fazer fetch do status do tenant:', error);
  }

  return NextResponse.next();
}
