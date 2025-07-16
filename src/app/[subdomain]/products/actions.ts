'use server';

import { z } from "zod";
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import clientPromise from "@/lib/mongodb";
import { ProductSchema } from "@/lib/schemas";
import type { Tenant, Product } from "@/lib/types";

// The document type in the 'products' collection
type ProductDocument = Omit<Product, 'id'> & { _id: ObjectId };


export async function getProducts(subdomain: string): Promise<Product[]> {
    try {
        const client = await clientPromise;
        const db = client.db('vematize');
        
        const tenant = await db.collection<Tenant>('tenants').findOne({ subdomain }, { projection: { _id: 1 } });
        if (!tenant) {
            console.warn(`Tenant not found for subdomain: ${subdomain}`);
            return [];
        }

        const productsCollection = db.collection<ProductDocument>('products');
        const products = await productsCollection.find({ tenantId: tenant._id.toString() }).toArray();

        // This mapping is crucial. It converts the DB document to the client-facing type.
        return products.map((product) => {
            const { _id, ...rest } = product;
            return {
                ...rest,
                id: _id.toString(), // Convert ObjectId to string and assign to 'id'
                type: product.type || 'product', // Set default type for old products
                activationCodesUsed: product.activationCodesUsed || [],
            };
        });

    } catch (error) {
        console.error('Database error fetching products:', error);
        return [];
    }
}

export async function getProductById(subdomain: string, productId: string): Promise<Product | null> {
    try {
        if (!ObjectId.isValid(productId)) {
            return null;
        }

        const client = await clientPromise;
        const db = client.db('vematize');

        const tenant = await db.collection<Tenant>('tenants').findOne({ subdomain }, { projection: { _id: 1 } });
        if (!tenant) return null;
        
        const product = await db.collection<ProductDocument>('products').findOne({ 
            _id: new ObjectId(productId),
            tenantId: tenant._id.toString()
        });

        if (!product) {
            return null;
        }

        const { _id, ...rest } = product;
        return { 
            ...rest, 
            id: _id.toString(),
            type: product.type || 'product',
            activationCodesUsed: product.activationCodesUsed || [],
        };

    } catch (error) {
        console.error('Database error fetching product by ID:', error);
        return null;
    }
}


export async function saveProduct(
    subdomain: string,
    productData: z.infer<typeof ProductSchema>
): Promise<{ success: boolean; message: string; }> {
    try {
        const validation = ProductSchema.safeParse(productData);
        if (!validation.success) {
            return { success: false, message: validation.error.errors.map(e => e.message).join(', ') };
        }

        const client = await clientPromise;
        const db = client.db('vematize');

        const tenant = await db.collection<Tenant>('tenants').findOne({ subdomain });
        if (!tenant) {
            return { success: false, message: "Tenant não encontrado." };
        }
        
        const { id, ...dataToSave } = validation.data;
        const collection = db.collection('products');
        
        // This is the final object we'll save or update.
        const productPayload: any = {
            ...dataToSave,
            tenantId: tenant._id.toString(),
        };

        // Special handling for activation codes
        if (productPayload.productSubtype === 'activation_codes') {
            const newCodes = (productPayload.activationCodes || '')
                .split('\n') // Corrected separator
                .map((c: string) => c.trim())
                .filter(Boolean);

            productPayload.activationCodes = newCodes;
            productPayload.stock = newCodes.length; // Stock is always the count of *available* codes
        }


        if (id && ObjectId.isValid(id)) {
            // UPDATE operation
            if (productPayload.productSubtype === 'activation_codes') {
                 const existingProduct = await collection.findOne({ _id: new ObjectId(id) });
                 productPayload.activationCodesUsed = existingProduct?.activationCodesUsed || [];
            }
            
            const result = await collection.updateOne(
                { _id: new ObjectId(id), tenantId: tenant._id.toString() },
                { $set: productPayload }
            );

            if (result.matchedCount === 0) {
                return { success: false, message: "Produto não encontrado para atualizar." };
            }
            if (result.modifiedCount === 0) {
                // This can happen if the data submitted is identical to the existing data.
                // We'll treat it as a "success" but with a specific message.
                return { success: true, message: "Nenhuma alteração detectada, mas sincronizado." };
            }

        } else {
            // CREATE operation
            if (productPayload.productSubtype === 'activation_codes') {
                productPayload.activationCodesUsed = [];
            }
            
            const result = await collection.insertOne(productPayload);
            if (!result.insertedId) {
                return { success: false, message: "Falha ao criar o novo produto no banco de dados." };
            }
        }

        revalidatePath(`/${subdomain}/products`);
        return { success: true, message: "Produto salvo com sucesso!" };

    } catch (error) {
        console.error("Error saving product:", error);
        return { success: false, message: "Ocorreu um erro no servidor." };
    }
}

export async function deleteProduct(subdomain: string, productId: string) {
     try {
        if (!ObjectId.isValid(productId)) {
            return { success: false, message: "ID do produto inválido." };
        }

        const client = await clientPromise;
        const db = client.db('vematize');

        const tenant = await db.collection<Tenant>('tenants').findOne({ subdomain }, { projection: { _id: 1 } });
        if (!tenant) {
            return { success: false, message: "Tenant não encontrado." };
        }

        const result = await db.collection('products').deleteOne({
            _id: new ObjectId(productId),
            tenantId: tenant._id.toString()
        });

        if (result.deletedCount === 0) {
             return { success: false, message: "Produto não encontrado ou não pertence a este tenant." };
        }

        revalidatePath(`/${subdomain}/products`);
        return { success: true, message: "Produto excluído com sucesso." };

    } catch (error) {
        console.error("Error deleting product:", error);
        return { success: false, message: "Ocorreu um erro no servidor." };
    }
}

export async function getPaymentIntegrations(subdomain: string): Promise<{ id: string; name: string; }[]> {
  try {
    const client = await clientPromise;
    const db = client.db('vematize');

    const tenant = await db.collection('tenants').findOne({ subdomain });
    if (!tenant || !tenant.paymentIntegrations) {
      return [];
    }
    
    const integrations = tenant.paymentIntegrations;
    const availableGateways = [];

    if (integrations.mercadopago) {
      const mp = integrations.mercadopago;
      const isProductionReady = mp.mode === 'production' && mp.production_access_token;
      const isSandboxReady = mp.mode === 'sandbox' && mp.sandbox_access_token;

      if (isProductionReady || isSandboxReady) {
        availableGateways.push({ id: 'mercadopago', name: 'Mercado Pago' });
      }
    }
    
    // Future gateways can be added here
    // Ex: if (integrations.stripe && integrations.stripe.enabled) { ... }

    return availableGateways;

  } catch (error) {
    console.error('Failed to get payment integrations:', error);
    return [];
  }
}
