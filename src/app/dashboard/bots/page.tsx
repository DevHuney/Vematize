import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function DeprecatedPage() {
  return (
    <Card className="w-full max-w-xl text-center">
        <CardHeader>
            <CardTitle>Rota Obsoleta</CardTitle>
            <CardDescription>
                Esta página foi movida para uma nova estrutura de URL para múltiplos clientes.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
                As páginas do cliente agora são acessadas através do seu subdomínio.
                <br />
                Por exemplo: <strong>/seu-subdominio/bots</strong>
            </p>
            <Button asChild>
                <Link href="/login">
                    Ir para o Login
                </Link>
            </Button>
        </CardContent>
    </Card>
  );
}
