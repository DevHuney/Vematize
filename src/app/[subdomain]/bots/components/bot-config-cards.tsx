'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BotConnections } from "../actions";
import { platformConfigMap, supportedPlatforms, type Platform } from '../platform-config';


interface BotConfigCardsProps {
    initialConnections: BotConnections;
}

export function BotConfigCards({ initialConnections }: BotConfigCardsProps) {
    const params = useParams();
    const subdomain = params.subdomain as string;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {supportedPlatforms.map(platform => {
                const config = platformConfigMap[platform];
                const connection = initialConnections?.[platform];
                const isConnected = !!(connection && connection[config.connectionCheckKey]);
                const Icon = config.icon;

                return (
                    <Card key={platform} className="flex flex-col">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Icon className="h-10 w-10" />
                                    <div>
                                        <CardTitle>{platform.charAt(0).toUpperCase() + platform.slice(1)}</CardTitle>
                                        <CardDescription>{platform === 'whatsapp' ? 'Conta comercial' : platform === 'instagram' ? 'Mensagens diretas' : 'Bot pessoal'}</CardDescription>
                                    </div>
                                </div>
                                <Badge variant={isConnected ? 'default' : 'destructive'}>
                                    {isConnected ? 'Conectado' : 'Desconectado'}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <p className="text-sm text-muted-foreground">
                                {config.description}
                            </p>
                        </CardContent>
                        <CardFooter>
                            <Button asChild className="w-full">
                                <Link href={`/${subdomain}/bots/${platform}`}>
                                  {isConnected ? 'Ver Configuração' : 'Configurar Conexão'}
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>
                )
            })}
        </div>
    );
}
