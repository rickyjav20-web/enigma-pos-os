import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';

export default async function productRoutes(fastify: FastifyInstance) {

    // Force Restart Trigger
    // GET /products
    fastify.get<{ Querystring: { tenant_id: string } }>('/products', async (request, reply) => {
        const { tenant_id } = request.query;

        // Use resolved tenant ID from middleware (UUID)
        const activeTenant = request.tenantId || 'enigma_hq';

        const products = await prisma.product.findMany({
            where: { tenantId: activeTenant },
            include: { variants: true, recipes: { include: { supplyItem: true } } }
        });
        console.log(`[API DEBUG] GET /products tenant=${activeTenant} found=${products.length}`);
        console.log(`[API DEBUG] DB_URL=${process.env.DATABASE_URL}`);
        return {
            success: true,
            count: products.length,
            data: products,
            debug: {
                tenant: activeTenant,
                db_url: process.env.DATABASE_URL,
                node_env: process.env.NODE_ENV
            }
        };
    });

    // GET /products/:id
    fastify.get<{ Params: { id: string } }>('/products/:id', async (request, reply) => {
        const { id } = request.params;
        const product = await prisma.product.findUnique({
            where: { id },
            include: { variants: true, recipes: { include: { supplyItem: true } } }
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
            const { recipeService } = await import('../services/RecipeService');
            await recipeService.syncProductRecipe(product.id, recipes);
        }

        return product;
    });

    // PUT /products/:id
    fastify.put<{ Params: { id: string } }>('/products/:id', async (request, reply) => {
        const { id } = request.params;
        const { name, price, cost, categoryId, recipes } = request.body as any;

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
            console.log(`[API] PUT /products/${id} syncing recipes:`, recipes);
            try {
                const { recipeService } = await import('../services/RecipeService');
                await recipeService.syncProductRecipe(id, recipes);
                console.log(`[API] Sync Success for ${id}`);
            } catch (err: any) {
                console.error(`[API] Sync Error for ${id}:`, err);
            }
        }

        return product;
    });

    // POST /products/:id/recipes (Add Ingredient)
    fastify.post<{ Params: { id: string } }>('/products/:id/recipes', async (request, reply) => {
        const { id } = request.params;
        const { supplyItemId, quantity, unit } = request.body as any;

        // Create Recipe Link
        await prisma.productRecipe.create({
            data: {
                productId: id,
                supplyItemId,
                quantity: Number(quantity),
                unit
            }
        });

        // Recalculate
        const { recipeService } = await import('../services/RecipeService');
        await recipeService.recalculateProductCost(id);

        return { success: true };
    });

    // DELETE /products/:id/recipes/:recipeId (Remove Ingredient)
    fastify.delete<{ Params: { id: string; recipeId: string } }>('/products/:id/recipes/:recipeId', async (request, reply) => {
        const { id, recipeId } = request.params;

        // Remove
        await prisma.productRecipe.delete({
            where: { id: recipeId }
        });

        // Recalculate
        const { recipeService } = await import('../services/RecipeService');
        await recipeService.recalculateProductCost(id);

        return { success: true };
    });
}
