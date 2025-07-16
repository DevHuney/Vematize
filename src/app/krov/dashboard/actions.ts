"use server";

// As estatísticas de usuários de bot foram movidas para o painel do cliente.
// Este arquivo pode ser usado para futuras estatísticas do painel Krov.

import clientPromise from '@/lib/mongodb';
import { Sale, Tenant, Product } from '@/lib/types';
import { Collection, Db } from 'mongodb';

interface SalesChartDataPoint {
  date: string;
  vendas: number;
}

export async function getKrovDashboardData() {
  try {
  const client = await clientPromise;
  const db: Db = client.db('vematize');
  const salesCollection: Collection<Sale> = db.collection('sales');
  const tenantsCollection: Collection<Tenant> = db.collection('tenants');
    const productsCollection: Collection<Product> = db.collection('products');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

    // Alternative fetching without aggregate
    const allApprovedSales = await salesCollection.find({ status: 'approved' }).toArray();
    const productIds = allApprovedSales.map(sale => sale.productId);
    const products = await productsCollection.find({ id: { $in: productIds } }).toArray();
    const productPriceMap = new Map(products.map(p => [p.id, p.price]));

    let totalRevenue = 0;
    let todaySales = 0;
    let monthSales = 0;

    for (const sale of allApprovedSales) {
        const price = productPriceMap.get(sale.productId) || 0;
        totalRevenue += price;
        if (sale.createdAt >= today) {
            todaySales += price;
        }
        if (sale.createdAt >= startOfMonth) {
            monthSales += price;
        }
    }
    
    const paidOrders = allApprovedSales.length;
  const pendingOrders = await salesCollection.countDocuments({ status: 'pending' });
  const totalOrders = await salesCollection.countDocuments();
  
  const conversionRate = totalOrders > 0 ? (paidOrders / totalOrders) * 100 : 0;
  const averageTicket = paidOrders > 0 ? totalRevenue / paidOrders : 0;

  const totalClients = await tenantsCollection.countDocuments();
  const activeSubscribers = await tenantsCollection.countDocuments({ subscriptionStatus: 'active' });

    // Sales chart data without aggregate
  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);

    const recentSales = await salesCollection.find({ status: 'approved', createdAt: { $gte: last30Days } }).toArray();
    
    const salesByDate: { [key: string]: number } = {};
    for (const sale of recentSales) {
        const dateStr = sale.createdAt.toISOString().split('T')[0];
        const price = productPriceMap.get(sale.productId) || 0;
        salesByDate[dateStr] = (salesByDate[dateStr] || 0) + price;
    }

    const salesChartData: SalesChartDataPoint[] = Object.entries(salesByDate)
        .map(([date, vendas]) => ({ date, vendas }))
        .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalRevenue,
    todaySales,
    monthSales,
      averageTicket,
    paidOrders,
    pendingOrders,
    conversionRate,
    totalClients,
    activeSubscribers,
    salesChartData
  };
  } catch(error) {
      if (error instanceof Error && 'code' in error && error.code === 8000) {
          console.error("MongoServerError: Command not implemented or unknown. Your MongoDB version or service may not support the attempted command.", error);
          // Return a default or empty state for the dashboard to prevent crashing the page
          return {
              totalRevenue: 0, todaySales: 0, monthSales: 0, averageTicket: 0,
              paidOrders: 0, pendingOrders: 0, conversionRate: 0,
              totalClients: 0, activeSubscribers: 0, salesChartData: []
          };
      }
      // Re-throw other errors
      throw error;
  }
}
