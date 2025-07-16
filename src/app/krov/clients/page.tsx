import Link from 'next/link';
import { getClients, type Client } from './actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type StatusVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const getClientStatus = (client: Client): { text: string; variant: StatusVariant } => {
  if (client.subscriptionStatus === 'active') {
    return { text: 'Ativo', variant: 'default' };
  }
  if (client.subscriptionStatus === 'trialing') {
    if (client.trialEndsAt && new Date(client.trialEndsAt) > new Date()) {
      return { text: 'Em Teste', variant: 'secondary' };
    }
  }
  // All other cases are considered expired/inactive for simplicity
  return { text: 'Expirado', variant: 'destructive' };
};

function ClientTable({ clients, emptyMessage }: { clients: Client[]; emptyMessage: string }) {
  if (clients.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-md border border-dashed p-8 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
        <Table>
        <TableHeader>
            <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Subdomínio</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">ID</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {clients.map((client) => {
            const status = getClientStatus(client);
            return (
                <TableRow key={client.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                        <Link href={`/krov/clients/${client.id}`} className="hover:underline font-medium">
                            {client.ownerName || client.ownerEmail}
                        </Link>
                    </TableCell>
                    <TableCell>
                         <Link href={`/krov/clients/${client.id}`} className="hover:underline text-muted-foreground">
                            {client.ownerEmail}
                        </Link>
                    </TableCell>
                    <TableCell>
                         <Link href={`/krov/clients/${client.id}`} className="hover:underline text-muted-foreground">
                            {client.subdomain}.meubot.com
                        </Link>
                    </TableCell>
                    <TableCell>
                        <Link href={`/krov/clients/${client.id}`}>
                            <Badge variant={status.variant}>{status.text}</Badge>
                        </Link>
                    </TableCell>
                    <TableCell className="text-right">
                        <Link href={`/krov/clients/${client.id}`} className="hover:underline text-muted-foreground font-mono text-xs">
                           {client.id}
                        </Link>
                    </TableCell>
                </TableRow>
            );
            })}
        </TableBody>
        </Table>
    </div>
  );
}


export default async function ClientsPage() {
  const clients = await getClients();

  const allClients = clients;
  const activeClients = clients.filter(c => getClientStatus(c).text === 'Ativo');
  const trialClients = clients.filter(c => getClientStatus(c).text === 'Em Teste');
  const renewalClients: Client[] = []; // Logic to be defined
  const expiredClients = clients.filter(c => getClientStatus(c).text === 'Expirado');

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Clientes</h2>
      </div>
      
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Todos ({allClients.length})</TabsTrigger>
          <TabsTrigger value="active">Ativos ({activeClients.length})</TabsTrigger>
          <TabsTrigger value="trial">Em Teste ({trialClients.length})</TabsTrigger>
          <TabsTrigger value="renewal">Renovação ({renewalClients.length})</TabsTrigger>
          <TabsTrigger value="expired">Expirados ({expiredClients.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="pt-4">
            <ClientTable clients={allClients} emptyMessage="Nenhum cliente encontrado." />
        </TabsContent>
        <TabsContent value="active" className="pt-4">
             <ClientTable clients={activeClients} emptyMessage="Nenhum cliente ativo no momento." />
        </TabsContent>
        <TabsContent value="trial" className="pt-4">
            <ClientTable clients={trialClients} emptyMessage="Nenhum cliente em período de teste." />
        </TabsContent>
        <TabsContent value="renewal" className="pt-4">
            <ClientTable clients={renewalClients} emptyMessage="Lógica de renovação a ser definida." />
        </TabsContent>
        <TabsContent value="expired" className="pt-4">
            <ClientTable clients={expiredClients} emptyMessage="Nenhum cliente com assinatura expirada." />
        </TabsContent>
      </Tabs>
    </div>
  );
}
