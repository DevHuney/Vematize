import { DollarSign, BarChart as BarChartIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getReportData } from './actions';
import { SalesReportChart } from './components/sales-report-chart';

function formatCurrency(value: number) {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

export default async function ReportsPage() {
    const reportData = await getReportData();

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Relatórios</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(reportData.totalRevenue)}</div>
                        <p className="text-xs text-muted-foreground">Receita total histórica (simulada)</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Receita (Últimos 90 dias)</CardTitle>
                        <BarChartIcon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(reportData.revenueLast90Days)}</div>
                         <p className="text-xs text-muted-foreground">Faturamento dos últimos 90 dias</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Receita (Últimos 30 dias)</CardTitle>
                        <BarChartIcon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(reportData.revenueLast30Days)}</div>
                        <p className="text-xs text-muted-foreground">Faturamento dos últimos 30 dias</p>
                    </CardContent>
                </Card>
            </div>
            <div className="pt-4">
                <SalesReportChart dailySales={reportData.dailySales} />
            </div>
        </div>
    );
}
