import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api routes (mas não a nossa API de status)
     * 2. /_next (Next.js internals)
     * 3. /_static (inside /public)
     * 4. all root files inside /public (e.g. /favicon.ico)
     */
    '/((?!api/|_next/|_static/|[\\w-]+\\.\\w+).*)',
  ],
};

export default async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get('host');
  
  // Extrai o subdomínio
  const subdomain = hostname?.split('.')[0] || '';

  // Ignora rotas do painel krov, da landing page principal e rotas de autenticação
  if (subdomain === 'krov' || subdomain === '' || subdomain === 'www' || url.pathname.startsWith('/login') || url.pathname.startsWith('/register')) {
    return NextResponse.next();
  }

  // Se for um subdomínio de tenant, verifica o status da assinatura via API interna
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
        // Se a API de status falhar, registra o erro mas permite o acesso para evitar bloquear usuários.
        console.warn(`[Middleware] A verificação de status do tenant falhou com status ${response.status} para o subdomínio ${subdomain}.`);
    }

  } catch (error) {
    console.error('[Middleware] Erro ao fazer fetch do status do tenant:', error);
  }

  return NextResponse.next();
}
