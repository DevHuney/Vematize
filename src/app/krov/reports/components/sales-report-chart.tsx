'use client';

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ReportData } from '../actions';

interface SalesReportChartProps {
  dailySales: ReportData['dailySales'];
}

export function SalesReportChart({ dailySales }: SalesReportChartProps) {
  const [period, setPeriod] = useState<'7' | '15' | '30' | '90'>('30');

  const dataForPeriod = dailySales.slice(-Number(period));

  const chartData = dataForPeriod.map(item => ({
    dateISO: item.date, // Keep original ISO date for tooltip
    date: format(new Date(item.date), 'dd MMM', { locale: ptBR }),
    vendas: item.vendas,
  }));

  const formatCurrency = (value: number) => 
    `R$ ${value.toFixed(2).replace('.', ',')}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle>Visão Geral de Vendas</CardTitle>
          <Tabs defaultValue="30" onValueChange={(value) => setPeriod(value as any)} className="w-full sm:w-auto">
            <TabsList className="grid w-full grid-cols-4 sm:w-auto">
              <TabsTrigger value="7">7 Dias</TabsTrigger>
              <TabsTrigger value="15">15 Dias</TabsTrigger>
              <TabsTrigger value="30">30 Dias</TabsTrigger>
              <TabsTrigger value="90">90 Dias</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="pl-2">
        <ChartContainer
          config={{ vendas: { label: 'Vendas', color: 'hsl(var(--primary))' } }}
          className="h-[350px] w-full"
        >
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(value) => formatCurrency(value)}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              width={100}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent
                labelFormatter={(label, payload) => {
                  const dataPoint = payload[0]?.payload;
                  if (dataPoint?.dateISO) {
                      return format(new Date(dataPoint.dateISO), "eeee, dd 'de' MMMM", {locale: ptBR});
                  }
                  return label;
                }}
                formatter={(value) => formatCurrency(Number(value))}
              />}
            />
            <Bar dataKey="vendas" fill="var(--color-vendas)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
