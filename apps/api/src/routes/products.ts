import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { recipeService } from '../services/RecipeService';

export default async function productRoutes(fastify: FastifyInstance) {

    // GET /products (Listing)
    fastify.get<{ Querystring: { tenant_id: string } }>('/products', async (request, reply) => {
        const { tenant_id } = request.query;
        const activeTenant = request.tenantId || 'enigma_hq';

        const products = await prisma.product.findMany({
            where: { tenantId: activeTenant },
            include: { variants: true, recipes: { include: { supplyItem: true } } }
        });
        return {
            success: true,
            count: products.length,
            data: products
        };
    });

    // GET /products/:id
    fastify.get<{ Params: { id: string } }>('/products/:id', async (request, reply) => {
        const { id } = request.params;
        const product = await prisma.product.findUnique({
            where: { id },
            include: {
                variants: true,
                recipes: { include: { supplyItem: true } },
                costHistory: { orderBy: { changeDate: 'desc' } }
            }
        });
        if (!product) return reply.status(404).send({ error: "Product not found" });
        return product;
    });

    // POST /products
    fastify.post('/products', async (request, reply) => {
        const { name, price, cost, tenantId, categoryId, recipes } = request.body as any;

        const product = await prisma.product.create({
            data: {
                name,
                price: Number(price),
                cost: Number(cost) || 0,
                tenantId: tenantId || 'enigma_hq',
                categoryId
            }
        });

        // 2. Handle Recipe (if provided)
        if (recipes && Array.isArray(recipes) && recipes.length > 0) {
            await recipeService.syncProductRecipe(product.id, recipes);
        }

        return product;
    });

    // PUT /products/:id
    fastify.put<{ Params: { id: string } }>('/products/:id', async (request, reply) => {
        try {
            const { id } = request.params;
            const body = request.body as any;
            const { name, price, cost, categoryId, recipes } = body;

            console.log(`[API] PUT /products/${id} payload:`, { name, recipesCount: recipes?.length });

            const product = await prisma.product.update({
                where: { id },
                data: {
                    name,
                    price: price !== undefined ? Number(price) : undefined,
                    cost: cost !== undefined ? Number(cost) : undefined,
                    categoryId
                }
            });

            // 2. Sync Recipe (if provided)
            if (recipes !== undefined && Array.isArray(recipes)) {
                console.log(`[API] Syncing recipes for ${id}...`);
                await recipeService.syncProductRecipe(id, recipes);
                console.log(`[API] Recipe Sync Complete.`);
            }

            return product;
        } catch (error: any) {
            console.error(`[API] CRITICAL ERROR in PUT /products/:id`, error);
            // Return 500 with message so UI can show it
            return reply.status(500).send({
                error: "Server Error",
                message: error.message || "Unknown error during update"
            });
        }
    });

    // POST /products/:id/recipes (Add Ingredient)
    fastify.post<{ Params: { id: string } }>('/products/:id/recipes', async (request, reply) => {
        const { id } = request.params;
        const { supplyItemId, quantity, unit } = request.body as any;

        await prisma.productRecipe.create({
            data: {
                productId: id,
                supplyItemId,
                quantity: Number(quantity),
                unit
            }
        });

        await recipeService.recalculateProductCost(id);
        return { success: true };
    });

    // DELETE /products/:id/recipes/:recipeId (Remove Ingredient)
    fastify.delete<{ Params: { id: string; recipeId: string } }>('/products/:id/recipes/:recipeId', async (request, reply) => {
        const { id, recipeId } = request.params;
        await prisma.productRecipe.delete({ where: { id: recipeId } });
        await recipeService.recalculateProductCost(id);
        return { success: true };
    });
}
