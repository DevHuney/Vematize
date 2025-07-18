import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { getBotConfig } from "../actions";
import { platformConfigMap, supportedPlatforms, type Platform } from '../platform-config';
import { PlatformConnectionManager } from "./components/config-form";
import { FlowBuilder } from "./components/flow-builder";
import { getProducts } from "../../products/actions";

export default async function BotPlatformPage({ params }: { params: { subdomain: string, platform: string } }) {
    const { subdomain, platform } = params;
    const platformKey = platform as Platform;

    if (!supportedPlatforms.includes(platformKey)) {
        notFound();
    }
    
    const config = platformConfigMap[platformKey];

    if (platformKey !== 'telegram') {
        return (
             <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                <div className="flex items-center space-x-2">
                    <Button asChild variant="ghost" size="icon">
                        <Link href={`/${subdomain}/bots`}>
                            <ChevronLeft className="h-4 w-4" />
                            <span className="sr-only">Voltar</span>
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-bold tracking-tight">{config.title}</h1>
                </div>
                <p>A configuração para {platform} não está disponível no momento.</p>
            </div>
        )
    }

    const [botConfigData, productsData] = await Promise.all([
        getBotConfig(subdomain),
        getProducts(subdomain)
    ]);

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
             <div className="flex items-center space-x-2">
                <Button asChild variant="ghost" size="icon">
                    <Link href={`/${subdomain}/bots`}>
                        <ChevronLeft className="h-4 w-4" />
                        <span className="sr-only">Voltar</span>
                    </Link>
                </Button>
                <h1 className="text-2xl font-bold tracking-tight">{config.title}</h1>
            </div>
            <Tabs defaultValue="connection" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="connection">Conexão</TabsTrigger>
                    <TabsTrigger value="flow">Fluxo do Bot</TabsTrigger>
                </TabsList>
                <TabsContent value="connection" className="pt-6">
                   <PlatformConnectionManager 
                        subdomain={subdomain}
                    />
                </TabsContent>
                <TabsContent value="flow" className="pt-6">
                    <FlowBuilder
                        subdomain={subdomain}
                        initialData={botConfigData}
                        products={productsData}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
