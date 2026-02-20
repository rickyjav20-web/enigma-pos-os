import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { recipeService } from '../services/RecipeService';

export default async function supplyItemRoutes(fastify: FastifyInstance) {

    // GET /inventory/logs (Global Activity)
    fastify.get<{ Querystring: { limit?: string } }>('/inventory/logs', async (request, reply) => {
        const { limit } = request.query;
        const tenantId = request.tenantId || 'enigma_hq';
        const take = limit ? parseInt(limit) : 50;

        const logs = await prisma.inventoryLog.findMany({
            where: { tenantId },
            take,
            orderBy: { createdAt: 'desc' },
            include: { supplyItem: { select: { name: true, defaultUnit: true } } }
        });
        return { success: true, data: logs };
    });

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

        // Compute last-3-purchases average for each item in a single query
        const itemIds = items.map(i => i.id);
        const recentLines = await prisma.purchaseLine.findMany({
            where: {
                supplyItemId: { in: itemIds },
                purchaseOrder: { status: 'confirmed' }
            },
            orderBy: { purchaseOrder: { date: 'desc' } },
            select: { supplyItemId: true, unitCost: true }
        });

        // Group by item, take last 3, compute avg
        const linesByItem = new Map<string, number[]>();
        for (const l of recentLines) {
            const arr = linesByItem.get(l.supplyItemId) || [];
            if (arr.length < 3) arr.push(l.unitCost);
            linesByItem.set(l.supplyItemId, arr);
        }

        const enriched = items.map(item => {
            const prices = linesByItem.get(item.id) || [];
            const lastThreePurchasesAvg = prices.length > 0
                ? prices.reduce((s, p) => s + p, 0) / prices.length
                : null;
            return { ...item, lastThreePurchasesAvg };
        });

        return { success: true, count: enriched.length, total: totalItems, data: enriched };
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

        // Last 3 confirmed purchase prices for this item
        const lastThreePurchaseLines = await prisma.purchaseLine.findMany({
            where: {
                supplyItemId: id,
                purchaseOrder: { status: 'confirmed' }
            },
            orderBy: { purchaseOrder: { date: 'desc' } },
            take: 3,
            select: {
                unitCost: true,
                quantity: true,
                purchaseOrder: { select: { date: true, supplier: { select: { name: true } } } }
            }
        });

        const lastThreePurchasesAvg = lastThreePurchaseLines.length > 0
            ? lastThreePurchaseLines.reduce((sum, l) => sum + l.unitCost, 0) / lastThreePurchaseLines.length
            : null;

        console.log(`[API] Fetching SupplyItem ${item.name} (${id})`);
        console.log(`[API] Found ${item.inventoryLogs?.length || 0} inventory logs.`);

        return {
            ...item,
            lastThreePurchases: lastThreePurchaseLines.map(l => ({
                unitCost: l.unitCost,
                quantity: l.quantity,
                date: l.purchaseOrder.date,
                supplier: l.purchaseOrder.supplier?.name
            })),
            lastThreePurchasesAvg
        };
    });

    // POST /supply-items (Create)
    fastify.post('/supply-items', async (request, reply) => {
        try {
            const { name, sku, category, currentCost, unitOfMeasure, preferredSupplierId, tenantId, yieldQuantity, yieldUnit, yieldPercentage, recipeUnit, stockCorrectionFactor, ingredients } = request.body as any;

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
                    yieldUnit,
                    // Smart Yield
                    yieldPercentage: yieldPercentage ? Number(yieldPercentage) : 1.0,
                    recipeUnit,
                    stockCorrectionFactor: stockCorrectionFactor ? Number(stockCorrectionFactor) : 1.0
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
            const { name, sku, category, currentCost, defaultUnit, preferredSupplierId, stockQuantity, yieldQuantity, yieldUnit, yieldPercentage, recipeUnit, stockCorrectionFactor, ingredients } = request.body as any;

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
                    yieldUnit,
                    // Smart Yield
                    yieldPercentage: yieldPercentage !== undefined ? Number(yieldPercentage) : undefined,
                    recipeUnit,
                    stockCorrectionFactor: stockCorrectionFactor !== undefined ? Number(stockCorrectionFactor) : undefined
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
