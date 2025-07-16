'use client';

import { useState } from 'react';
import { Loader2, Database, AlertTriangle, CheckCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { migrateData, type MigrationResult } from './actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

export default function MigratePage() {
  const [isMigrating, setIsMigrating] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMigration = async () => {
    setIsMigrating(true);
    setError(null);
    setResult(null);

    try {
      const migrationResult = await migrateData();
      setResult(migrationResult);
    } catch (err) {
      setError('Ocorreu um erro inesperado durante a migração. Verifique o console do servidor para mais detalhes.');
      console.error(err);
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Migração de Dados</h2>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database />
            Migrar do Banco de Dados Antigo (PFBR)
          </CardTitle>
          <CardDescription>
            Use esta ferramenta para copiar seus dados do banco de dados legado 'PFBR' para o novo banco de dados 'vematize'.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção!</AlertTitle>
            <AlertDescription>
              Execute esta operação apenas uma vez. Ela é segura e não duplicará dados, mas não há necessidade de executá-la novamente após a conclusão. Certifique-se de que o sistema não está sendo usado durante a migração.
            </AlertDescription>
          </Alert>
          <Button onClick={handleMigration} disabled={isMigrating} className="w-full">
            {isMigrating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Migrando... Por favor, aguarde.
              </>
            ) : (
              'Iniciar Migração de Dados'
            )}
          </Button>

          {result && (
            <div className="mt-6 space-y-4">
              <Separator />
                <Alert variant={result.success ? "default" : "destructive"}>
                    {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    <AlertTitle>{result.success ? "Migração Concluída com Sucesso!" : "Migração Concluída com Avisos"}</AlertTitle>
                    <AlertDescription>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            {result.messages.map((message, index) => (
                                <li key={index}>{message}</li>
                            ))}
                        </ul>
                    </AlertDescription>
              </Alert>
            </div>
          )}

          {error && (
             <div className="mt-6">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Erro na Migração</AlertTitle>
                    <AlertDescription>
                       {error}
                    </AlertDescription>
                </Alert>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
