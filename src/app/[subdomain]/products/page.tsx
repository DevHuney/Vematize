import { getProducts } from "./actions";
import { ProductsManager } from "./components/products-manager";

export default async function ProductsPage({ params }: { params: { subdomain: string } }) {
    const products = await getProducts(params.subdomain);

    return (
        <>
            <div className="flex-1 space-y-8 p-4 pt-6 md:p-8">
                <div className="flex items-center justify-between space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
                </div>
                <ProductsManager initialProducts={products} subdomain={params.subdomain} />
            </div>
        </>
    );
}
