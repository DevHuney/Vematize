'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useFormContext } from "react-hook-form";
import { z } from "zod";
import { useEffect, useState } from "react";
import { ArrowRight, GripVertical, Loader2, Plus, PlusCircle, Sparkles, Star, Trash2, BotMessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from 'uuid';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { BotConfigSchema, BotFlowSchema, BotStepSchema } from "@/lib/schemas";
import type { Product } from "@/lib/types";
import { saveBotConfig } from "../../actions";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VariablesHelper } from "./variables-helper";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface FlowBuilderProps {
    subdomain: string;
    initialData: z.infer<typeof BotConfigSchema> | null;
    products: Product[];
}

const createDefaultFlow = (): z.infer<typeof BotFlowSchema> => {
    const defaultStep = {
    id: uuidv4(),
    name: "Mensagem de Boas-Vindas",
    message: "Olá, {userName}! 👋 Bem-vindo(a) ao nosso bot. Clique no botão abaixo para ver nossos produtos.",
    buttons: []
    };
    return {
        id: uuidv4(),
        name: "Fluxo Principal",
        trigger: "/start",
        startStepId: defaultStep.id,
        steps: [defaultStep]
    };
};

export function FlowBuilder({ subdomain, initialData, products }: FlowBuilderProps) {
    const { toast } = useToast();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeFlowTab, setActiveFlowTab] = useState("0");

    const form = useForm<z.infer<typeof BotConfigSchema>>({
        resolver: zodResolver(BotConfigSchema),
        defaultValues: {
            flows: [],
        }
    });

    const { fields: flows, append: appendFlow, remove: removeFlow } = useFieldArray({
        control: form.control,
        name: "flows",
        keyName: "key",
    });

    useEffect(() => {
        if (initialData && initialData.flows && initialData.flows.length > 0) {
            form.reset(initialData);
        } else {
             form.reset({
                flows: [createDefaultFlow()],
             });
        }
    }, [initialData, form]);

    async function onSubmit(values: z.infer<typeof BotConfigSchema>) {
        // Validate that every flow has a start step
        for (const flow of values.flows) {
            if (!flow.startStepId) {
                toast({ variant: "destructive", title: "Erro de Validação", description: `O fluxo "${flow.name}" precisa de um passo inicial definido.` });
            return;
            }
        }

        setIsSubmitting(true);
        try {
            const result = await saveBotConfig(subdomain, values);
            if (result.success) {
                toast({ title: "Sucesso!", description: result.message });
                router.refresh();
            } else {
                toast({ variant: "destructive", title: "Erro", description: result.message });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Erro Inesperado", description: "Ocorreu um erro ao salvar." });
        } finally {
            setIsSubmitting(false);
        }
    }

    const addNewFlow = () => {
        const newFlow = createDefaultFlow();
        newFlow.name = `Novo Fluxo ${flows.length + 1}`;
        newFlow.trigger = `/fluxo${flows.length + 1}`;
        appendFlow(newFlow);
        // Switch to the new tab
        setActiveFlowTab(String(flows.length)); 
    };
    
    const handleRemoveFlow = (index: number) => {
        if (flows.length <= 1) {
            toast({ variant: "destructive", title: "Ação não permitida", description: "Você deve ter pelo menos um fluxo." });
            return;
        }
        removeFlow(index);
        // Adjust active tab if needed
        const newTabIndex = Math.max(0, index - 1);
        setActiveFlowTab(String(newTabIndex));
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Construtor de Fluxo</CardTitle>
                        <CardDescription>
                            Crie múltiplos fluxos de conversa para seu bot. Cada fluxo é ativado por um comando específico.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={activeFlowTab} onValueChange={setActiveFlowTab} className="w-full">
                            <div className="flex items-center gap-4 border-b">
                                <TabsList>
                                    {flows.map((flow, index) => (
                                        <TabsTrigger key={flow.key} value={String(index)}>
                                            <BotMessageSquare className="h-4 w-4 mr-2"/>
                                            {form.watch(`flows.${index}.name`) || `Fluxo ${index + 1}`}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                                <Button type="button" variant="outline" size="sm" onClick={addNewFlow}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Adicionar Fluxo
                                </Button>
                            </div>

                            {flows.map((flow, flowIndex) => (
                                <TabsContent key={flow.key} value={String(flowIndex)} className="pt-6">
                                    <FlowContent 
                                        flowIndex={flowIndex} 
                             products={products}
                                        onRemoveFlow={() => handleRemoveFlow(flowIndex)}
                           />
                                </TabsContent>
                        ))}
                        </Tabs>
                    </CardContent>
                    <CardFooter>
                         <Button type="submit" disabled={isSubmitting} size="lg">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : "Salvar Todos os Fluxos"}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    );
}

// Represents the content of a single flow tab
function FlowContent({ flowIndex, products, onRemoveFlow }: { flowIndex: number; products: Product[]; onRemoveFlow: () => void; }) {
    const { control, watch, setValue } = useFormContext<z.infer<typeof BotConfigSchema>>();

    const { fields: steps, append: appendStep, remove: removeStep } = useFieldArray({
        control,
        name: `flows.${flowIndex}.steps`,
        keyName: "key",
    });

    const watchStartStepId = watch(`flows.${flowIndex}.startStepId`);
    
    const addNewStep = () => {
        appendStep({
            id: uuidv4(),
            name: `Novo Passo ${steps.length + 1}`,
            message: "Escreva sua mensagem aqui...",
            buttons: [],
        });
    };

    return (
        <div className="space-y-6">
             <Card className="bg-background/40 border-dashed">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xl">Configurações do Fluxo</CardTitle>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                 <Button type="button" variant="destructive" size="sm">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remover Fluxo
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. Isso removerá permanentemente este fluxo e todos os seus passos.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={onRemoveFlow}>Continuar</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                     <FormField
                        control={control}
                        name={`flows.${flowIndex}.name`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nome do Fluxo</FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="Ex: Boas-vindas, Suporte" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={control}
                        name={`flows.${flowIndex}.trigger`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Comando de Ativação (Gatilho)</FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="Ex: /start, /ajuda" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </CardContent>
            </Card>

            <div className="space-y-4">
                {steps.map((step, stepIndex) => (
                    <StepCard 
                        key={step.key} 
                        flowIndex={flowIndex}
                        stepIndex={stepIndex} 
                        removeStep={removeStep} 
                        products={products}
                        allSteps={steps}
                        isStartStep={watchStartStepId === step.id}
                        setAsStartStep={() => setValue(`flows.${flowIndex}.startStepId`, step.id)}
                    />
                ))}
            </div>

            <Separator />
            
             <Button type="button" variant="secondary" onClick={addNewStep}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar Passo
            </Button>
        </div>
    )
}


function StepCard({ flowIndex, stepIndex, removeStep, products, allSteps, isStartStep, setAsStartStep }: { flowIndex: number, stepIndex: number, removeStep: (index: number) => void, products: Product[], allSteps: z.infer<typeof BotStepSchema>[], isStartStep: boolean, setAsStartStep: () => void }) {
    const { control, watch, getValues, setValue } = useFormContext<z.infer<typeof BotConfigSchema>>();
    const { fields: buttons, append: appendButton, remove: removeButton } = useFieldArray({
        control,
        name: `flows.${flowIndex}.steps.${stepIndex}.buttons`,
        keyName: "key",
    });

    const stepId = watch(`flows.${flowIndex}.steps.${stepIndex}.id`);

    const addNewButton = () => {
        appendButton({
            id: uuidv4(),
            text: "Novo Botão",
            action: { type: 'GO_TO_STEP', payload: '' },
        });
    };
    
    return (
        <Card className="bg-background/40">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                        <FormField
                            control={control}
                            name={`flows.${flowIndex}.steps.${stepIndex}.name`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input {...field} className="text-lg font-semibold border-none shadow-none p-0 focus-visible:ring-0" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         {isStartStep && <Badge variant="default"><Star className="h-3 w-3 mr-1.5"/> Passo Inicial</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                         {!isStartStep && (
                            <Button type="button" variant="ghost" size="sm" onClick={setAsStartStep}>
                                <Star className="h-4 w-4 mr-2" />
                                Definir como Inicial
                            </Button>
                         )}
                        <Button type="button" variant="destructive" size="icon" onClick={() => removeStep(stepIndex)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                 <FormField
                    control={control}
                    name={`flows.${flowIndex}.steps.${stepIndex}.message`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Mensagem</FormLabel>
                            <FormControl>
                                <Textarea {...field} rows={5} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="flex justify-end">
                    <VariablesHelper />
                </div>
                <Separator />
                <div>
                    <h4 className="text-md font-semibold mb-2">Botões</h4>
                    <div className="space-y-3">
                        {buttons.map((button, buttonIndex) => (
                           <ButtonCard key={button.key} flowIndex={flowIndex} stepIndex={stepIndex} buttonIndex={buttonIndex} removeButton={removeButton} products={products} allSteps={allSteps} />
                        ))}
                    </div>
                     <Button type="button" variant="outline" size="sm" className="mt-4" onClick={addNewButton}>
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Botão
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

// Represents a single button card
function ButtonCard({ flowIndex, stepIndex, buttonIndex, removeButton, products, allSteps }: { flowIndex: number, stepIndex: number, buttonIndex: number, removeButton: (index: number) => void, products: Product[], allSteps: any[] }) {
    const { control, watch } = useFormContext<z.infer<typeof BotConfigSchema>>();
    
    const buttonType = watch(`flows.${flowIndex}.steps.${stepIndex}.buttons.${buttonIndex}.action.type`);
    
    return (
        <Card className="bg-background/80 relative">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                        <p className="font-semibold">Botão</p>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeButton(buttonIndex)}
                    >
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={control}
                    name={`flows.${flowIndex}.steps.${stepIndex}.buttons.${buttonIndex}.text`}
                    render={({ field }) => (
                            <FormItem>
                            <FormLabel>Texto do Botão</FormLabel>
                            <FormControl>
                                    <Input {...field} placeholder="Ex: Ver Produtos" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name={`flows.${flowIndex}.steps.${stepIndex}.buttons.${buttonIndex}.action.type`}
                    render={({ field }) => (
                        <FormItem>
                                <FormLabel>Ação</FormLabel>
                         <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione uma ação" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                        <SelectItem value="GO_TO_STEP">Ir para outro passo</SelectItem>
                                        <SelectItem value="LINK_TO_PRODUCT">Link para Produto</SelectItem>
                                        <SelectItem value="MAIN_MENU">Menu Principal</SelectItem>
                                        <SelectItem value="SHOW_PROFILE">Mostrar Perfil</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {buttonType === 'GO_TO_STEP' && (
                    <FormField
                        control={control}
                        name={`flows.${flowIndex}.steps.${stepIndex}.buttons.${buttonIndex}.action.payload`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Passo de Destino</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                     <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione o passo" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {allSteps.filter(step => step.id !== watch(`flows.${flowIndex}.steps.${stepIndex}.id`)).map(step => (
                                            <SelectItem key={step.id} value={step.id}>{step.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                {buttonType === 'LINK_TO_PRODUCT' && (
                    <FormField
                        control={control}
                        name={`flows.${flowIndex}.steps.${stepIndex}.buttons.${buttonIndex}.action.payload`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Produto</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione o produto" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    {products.map(product => (
                                            <SelectItem key={product.id} value={product.id!}>{product.name}</SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
            </div>
            </CardContent>
        </Card>
    );
}
