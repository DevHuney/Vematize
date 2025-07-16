'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Edit, Trash2, Loader2, Package, MoreVertical, DollarSign, Archive, RefreshCw, Layers, KeySquare, FileDown, BadgePercent } from 'lucide-react';
import { ProductFormDialog } from './product-form-dialog';
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
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { deleteProduct } from '../actions';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface ProductsManagerProps {
  initialProducts: Product[];
  subdomain: string;
}

function formatCurrency(value: number) {
    if (value === 0) return "Grátis";
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

const ProductIcon = ({ product }: {product: Product}) => {
    if (product.type === 'subscription') {
        return <RefreshCw className="h-6 w-6 text-muted-foreground" />;
    }
    switch (product.productSubtype) {
        case 'activation_codes':
            return <KeySquare className="h-6 w-6 text-muted-foreground" />;
        case 'digital_file':
            return <FileDown className="h-6 w-6 text-muted-foreground" />;
        default:
            return <Package className="h-6 w-6 text-muted-foreground" />;
    }
}

const StockInfo = ({ product }: {product: Product}) => {
    if (product.type === 'subscription') {
        return <span className="flex items-center gap-1.5"><Layers className="h-4 w-4 text-muted-foreground"/> {product.durationDays ? `${product.durationDays} dias` : 'Vitalícia'}</span>
    }
    
    let stockText = 'Ilimitado';
    if (product.productSubtype === 'activation_codes') {
        const available = Array.isArray(product.activationCodes) ? product.activationCodes.length : 0;
        const used = product.activationCodesUsed?.length ?? 0;
        stockText = `${available} disp. / ${used} usados`;
    } else if (product.stock !== null && product.stock !== undefined) {
        stockText = `${product.stock} em estoque`;
    }
    
    return <span className="flex items-center gap-1.5"><Archive className="h-4 w-4 text-muted-foreground"/> {stockText}</span>
}

const PriceInfo = ({ product }: { product: Product }) => {
    const isOfferActive = product.discountPrice != null && product.offerExpiresAt && new Date(product.offerExpiresAt) > new Date();

    if (isOfferActive) {
        return (
            <div className="flex items-baseline gap-2">
                <span className="font-semibold text-primary">{formatCurrency(product.discountPrice!)}</span>
                <span className="text-sm text-muted-foreground line-through">{formatCurrency(product.price)}</span>
            </div>
        );
    }
    return <span className="font-semibold">{formatCurrency(product.price)}</span>;
};

const OfferBadge = ({ product }: { product: Product }) => {
    const isOfferActive = product.discountPrice != null && product.offerExpiresAt && new Date(product.offerExpiresAt) > new Date();
    if (!isOfferActive) return null;

    const discountPercentage = Math.round(((product.price - product.discountPrice!) / product.price) * 100);
    const expirationDate = parseISO(product.offerExpiresAt!);
    const expiresIn = formatDistanceToNow(expirationDate, { addSuffix: true, locale: ptBR });

    return (
        <Badge variant="destructive" className="flex items-center gap-1.5">
            <BadgePercent className="h-3 w-3" />
            {discountPercentage}% OFF (expira {expiresIn})
        </Badge>
    );
};

export function ProductsManager({ initialProducts, subdomain }: ProductsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState(initialProducts);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const handleAddProduct = () => {
    setSelectedProduct(null);
    setIsDialogOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsDialogOpen(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    setIsDeleting(productId);
    const result = await deleteProduct(subdomain, productId);
    if (result.success) {
      toast({ title: 'Sucesso!', description: result.message });
      setProducts(products.filter(p => p.id !== productId));
      router.refresh();
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: result.message });
    }
    setIsDeleting(null);
  };

  return (
    <>
      <ProductFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        product={selectedProduct}
        subdomain={subdomain}
        onSuccess={() => {
            router.refresh();
        }}
      />
      <Card>
        <CardHeader className="flex flex-row items-start sm:items-center justify-between">
          <div>
            <CardTitle>Meus Produtos e Serviços</CardTitle>
            <CardDescription>
              Gerencie os produtos e assinaturas que você vende através do bot.
            </CardDescription>
          </div>
          <Button onClick={handleAddProduct} className="shrink-0">
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar Item
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {products.length > 0 ? (
              products.map(product => (
                <div key={product.id} className="flex items-start justify-between rounded-md border p-4 gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-secondary p-3 rounded-md hidden sm:block">
                            <ProductIcon product={product} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h4 className="font-semibold">{product.name}</h4>
                                <Badge variant={product.type === 'subscription' ? 'default' : 'secondary'} className="capitalize">
                                    {product.type === 'subscription' ? 'Assinatura' : 'Produto'}
                                </Badge>
                                <OfferBadge product={product} />
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {product.description || 'Nenhuma descrição fornecida.'}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-sm">
                                <span className="flex items-center gap-1.5"><DollarSign className="h-4 w-4 text-muted-foreground"/> <PriceInfo product={product} /></span>
                                <StockInfo product={product} />
                            </div>
                        </div>
                    </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                         <Button variant="ghost" size="icon" disabled={isDeleting === product.id}>
                            {isDeleting === product.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                            <span className="sr-only">Ações</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                         <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                            <Edit className="mr-2 h-4 w-4" />
                            <span>Editar</span>
                        </DropdownMenuItem>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span>Excluir</span>
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                             <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. Isso excluirá permanentemente o item "{product.name}".
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => handleDeleteProduct(product.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                >
                                    Sim, excluir
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            ) : (
              <div className="text-center py-10 border-dashed border-2 rounded-md">
                 <p className="text-muted-foreground">Nenhum produto encontrado.</p>
                 <Button variant="link" onClick={handleAddProduct}>Adicione o primeiro!</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
