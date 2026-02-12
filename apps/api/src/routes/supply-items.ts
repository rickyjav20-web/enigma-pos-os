import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { recipeService } from '../services/RecipeService';

export default async function supplyItemRoutes(fastify: FastifyInstance) {

    // GET /supply-items (Search & List)
    fastify.get<{ Querystring: { search?: string; tenant_id?: string; limit?: string } }>('/supply-items', async (request, reply) => {
        const { search, limit } = request.query;
        // Use resolved tenant ID from middleware (UUID) 
        const activeTenant = request.tenantId || 'enigma_hq';


        const take = limit ? parseInt(limit) : 1000;

        const where: any = {
            tenantId: activeTenant
        };

        if (search) {
            where.name = {
                contains: search,
                mode: 'insensitive'
            };
        }

        const totalItems = await prisma.supplyItem.count({ where });

        const items = await prisma.supplyItem.findMany({
            where,
            take,
            orderBy: { name: 'asc' },
            include: { ingredients: { include: { component: true } } }
        });

        return { success: true, count: items.length, total: totalItems, data: items };
    });

    // GET /supply-items/:id
    fastify.get<{ Params: { id: string } }>('/supply-items/:id', async (request, reply) => {
        const { id } = request.params;
        const item = await prisma.supplyItem.findUnique({
            where: { id },
            include: {
                ingredients: { include: { component: true } },
                priceHistory: { orderBy: { changeDate: 'desc' }, take: 20 },
                inventoryLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
                preferredSupplier: true
            }
        });
        if (!item) return reply.status(404).send({ error: "Item not found" });
        return item;
    });

    // POST /supply-items (Create)
    fastify.post('/supply-items', async (request, reply) => {
        try {
            const { name, sku, category, currentCost, unitOfMeasure, preferredSupplierId, tenantId, yieldQuantity, yieldUnit, ingredients } = request.body as any;

            const item = await prisma.supplyItem.create({
                data: {
                    name,
                    sku: sku || `SKU-${Date.now()}`,
                    category: category || 'General',
                    currentCost: Number(currentCost) || 0,
                    defaultUnit: unitOfMeasure || 'und',
                    preferredSupplierId,
                    tenantId: request.tenantId || 'enigma_hq',
                    yieldQuantity: yieldQuantity ? Number(yieldQuantity) : null,
                    yieldUnit
                }
            });

            // 2. Handle Recipe (if provided)
            if (ingredients && Array.isArray(ingredients) && ingredients.length > 0) {
                await recipeService.syncRecipe(item.id, ingredients);
            }

            return item;
        } catch (error: any) {
            console.error(`[API] CRITICAL ERROR in POST /supply-items`, error);
            return reply.status(500).send({ error: "Server Error", message: error.message });
        }
    });

    // PUT /supply-items/:id (Update & Sync Recipe)
    fastify.put<{ Params: { id: string } }>('/supply-items/:id', async (request, reply) => {
        try {
            const { id } = request.params;
            const { name, sku, category, currentCost, defaultUnit, preferredSupplierId, stockQuantity, yieldQuantity, yieldUnit, ingredients } = request.body as any;

            // 1. Fetch current item for Audit
            const currentItem = await prisma.supplyItem.findUnique({ where: { id } });
            if (!currentItem) return reply.status(404).send({ error: "Item not found" });

            // 2. Check for Stock Audit
            if (stockQuantity !== undefined) {
                const newStock = Number(stockQuantity);
                const oldStock = currentItem.stockQuantity || 0;

                if (newStock !== oldStock) {
                    const diff = newStock - oldStock;
                    await prisma.inventoryLog.create({
                        data: {
                            tenantId: currentItem.tenantId,
                            supplyItemId: id,
                            previousStock: oldStock,
                            newStock: newStock,
                            changeAmount: diff,
                            reason: 'audit' // Manual Adjustment
                        }
                    });
                }
            }

            // 3. Update Basic Info
            const updatedItem = await prisma.supplyItem.update({
                where: { id },
                data: {
                    name,
                    sku,
                    category,
                    currentCost: currentCost !== undefined ? Number(currentCost) : undefined,
                    defaultUnit,
                    preferredSupplierId,
                    stockQuantity: stockQuantity !== undefined ? Number(stockQuantity) : undefined,
                    yieldQuantity: yieldQuantity !== undefined ? Number(yieldQuantity) : undefined,
                    yieldUnit
                }
            });

            // 4. Sync Recipe (if provided)
            if (ingredients !== undefined && Array.isArray(ingredients)) {
                await recipeService.syncRecipe(id, ingredients);
            } else if (yieldQuantity !== undefined) {
                // If Yield changed but ingredients didn't (e.g. updating definition), we MUST recalculate cost
                // because Unit Cost = Total Ingredients / Yield
                await recipeService.recalculateSupplyItemCost(id);
            }

            return updatedItem;
        } catch (error: any) {
            console.error(`[API] CRITICAL ERROR in PUT /supply-items/:id`, error);
            return reply.status(500).send({ error: "Server Error", message: error.message });
        }
    });

    // --- PRICE HISTORY ---
    fastify.get('/:id/price-history', async (request) => {
        const { id } = request.params as { id: string };

        const history = await prisma.priceHistory.findMany({
            where: { supplyItemId: id },
            orderBy: { changeDate: 'desc' },
            take: 20
        });

        return history;
    });
}
