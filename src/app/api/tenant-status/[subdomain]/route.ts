import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { Tenant } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Retorna o status da assinatura de um tenant.
 * Este endpoint é para ser usado internamente pelo middleware.
 */
export async function GET(
  request: Request,
  { params }: { params: { subdomain: string } }
) {
  const { subdomain } = params;

  if (!subdomain) {
    return NextResponse.json({ error: 'Subdomain is required' }, { status: 400 });
  }

  try {
    const db = (await clientPromise).db('vematize');
    const tenant = await db.collection<Tenant>('tenants').findOne(
      { subdomain },
      { projection: { subscriptionStatus: 1 } } // Otimiza a busca, retornando apenas o campo necessário
    );

    if (!tenant) {
      return NextResponse.json({ status: 'not_found' }, { status: 404 });
    }
    
    return NextResponse.json({ status: tenant.subscriptionStatus });

  } catch (error) {
    console.error(`[API Tenant Status] Erro ao buscar o status para o subdomínio ${subdomain}:`, error);
    // Retorna um status 'active' como fallback seguro para não bloquear usuários legítimos em caso de erro no DB.
    return NextResponse.json({ status: 'active' }, { status: 500 });
  }
} 