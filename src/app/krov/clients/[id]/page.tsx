import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Detalhes do Cliente</h2>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Informações do Cliente</CardTitle>
            <CardDescription>Esta página está em construção.</CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">
                Aqui serão exibidos todos os detalhes para o cliente com ID:
                <span className="font-mono ml-2 p-1 rounded bg-muted text-sm">{params.id}</span>
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
