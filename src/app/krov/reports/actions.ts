'use server';

import { unstable_noStore as noStore } from 'next/cache';

export type ReportData = {
  totalRevenue: number;
  revenueLast90Days: number;
  revenueLast30Days: number;
  dailySales: { date: string; vendas: number }[];
};

export async function getReportData(): Promise<ReportData> {
  noStore(); // Ensure data is not cached and is fresh on every request
  
  // TODO: Implementar a lógica para buscar dados de vendas reais do banco de dados.
  // Como ainda não há uma coleção de vendas definida, os dados retornados serão zerados.
  
  return {
    totalRevenue: 0,
    revenueLast90Days: 0,
    revenueLast30Days: 0,
    dailySales: [], // Retorna um array vazio para o gráfico
  };
}
