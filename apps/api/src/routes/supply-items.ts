import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { recipeService } from '../services/RecipeService';
import {
    deriveStockCorrectionFactor,
    enrichSupplyItemUnits,
    getOperationalUnit,
    getPreferredRecipeUnit,
    normalizeUnit,
} from '../lib/units';

export default async function supplyItemRoutes(fastify: FastifyInstance) {

    fastify.get<{ Querystring: { limit?: string } }>('/inventory/logs', async (request) => {
        const { limit } = request.query;
        const tenantId = request.tenantId || 'enigma_hq';
        const take = limit ? parseInt(limit, 10) : 50;

        const logs = await prisma.inventoryLog.findMany({
            where: { tenantId },
            take,
            orderBy: { createdAt: 'desc' },
            include: {
                supplyItem: {
                    select: {
                        name: true,
                        defaultUnit: true,
                        yieldUnit: true,
                        isProduction: true,
                    },
                },
            },
        });

        return {
            success: true,
            data: logs.map((log) => ({
                ...log,
                supplyItem: log.supplyItem
                    ? {
                        ...log.supplyItem,
                        operationalUnit: getOperationalUnit(log.supplyItem),
                    }
                    : null,
            })),
        };
    });

    fastify.get<{ Querystring: { search?: string; tenant_id?: string; limit?: string; showArchived?: string } }>(
        '/supply-items',
        async (request) => {
            const { search, limit, showArchived } = request.query;
            const activeTenant = request.tenantId || 'enigma_hq';
            const take = limit ? parseInt(limit, 10) : 1000;

            const where: any = { tenantId: activeTenant };
            if (showArchived !== 'true') where.isActive = true;
            if (search) {
                where.name = {
                    contains: search,
                    mode: 'insensitive',
                };
            }

            const totalItems = await prisma.supplyItem.count({ where });

            const items = await prisma.supplyItem.findMany({
                where,
                take,
                orderBy: { name: 'asc' },
                include: { ingredients: { include: { component: true } } },
            });

            const itemIds = items.map((item) => item.id);
            const recentLines = itemIds.length > 0
                ? await prisma.purchaseLine.findMany({
                    where: { supplyItemId: { in: itemIds } },
                    include: { purchaseOrder: { select: { status: true, date: true } } },
                    orderBy: { purchaseOrder: { date: 'desc' } },
                })
                : [];

            const linesByItem = new Map<string, number[]>();
            for (const line of recentLines) {
                if (line.purchaseOrder.status !== 'confirmed') continue;
                const existing = linesByItem.get(line.supplyItemId) || [];
                if (existing.length < 3) existing.push(line.unitCost);
                linesByItem.set(line.supplyItemId, existing);
            }

            const enriched = items.map((item) => {
                const prices = linesByItem.get(item.id) || [];
                const lastThreePurchasesAvg = prices.length > 0
                    ? prices.reduce((sum, price) => sum + price, 0) / prices.length
                    : null;

                return enrichSupplyItemUnits({
                    ...item,
                    lastThreePurchasesAvg,
                });
            });

            return { success: true, count: enriched.length, total: totalItems, data: enriched };
        }
    );

    fastify.get<{ Params: { id: string } }>('/supply-items/:id', async (request, reply) => {
        const { id } = request.params;
        const item = await prisma.supplyItem.findUnique({
            where: { id },
            include: {
                ingredients: { include: { component: true } },
                priceHistory: { orderBy: { changeDate: 'desc' }, take: 20 },
                inventoryLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
                preferredSupplier: true,
            },
        });

        if (!item) return reply.status(404).send({ error: 'Item not found' });

        const allPurchaseLines = await prisma.purchaseLine.findMany({
            where: { supplyItemId: id },
            include: {
                purchaseOrder: {
                    select: { status: true, date: true, supplier: { select: { name: true } } },
                },
            },
        });

        const lastThreePurchaseLines = allPurchaseLines
            .filter((line) => line.purchaseOrder.status === 'confirmed')
            .sort((a, b) => new Date(b.purchaseOrder.date).getTime() - new Date(a.purchaseOrder.date).getTime())
            .slice(0, 3);

        const lastThreePurchasesAvg = lastThreePurchaseLines.length > 0
            ? lastThreePurchaseLines.reduce((sum, line) => sum + line.unitCost, 0) / lastThreePurchaseLines.length
            : null;

        return enrichSupplyItemUnits({
            ...item,
            lastThreePurchases: lastThreePurchaseLines.map((line) => ({
                unitCost: line.unitCost,
                quantity: line.quantity,
                date: line.purchaseOrder.date,
                supplier: line.purchaseOrder.supplier?.name,
            })),
            lastThreePurchasesAvg,
        });
    });

    fastify.post('/supply-items', async (request, reply) => {
        try {
            const body = request.body as any;
            const defaultUnit = normalizeUnit(body.defaultUnit || body.unitOfMeasure || 'und');
            const isProduction = body.isProduction === true || Boolean(body.ingredients?.length);
            const yieldUnit = isProduction
                ? normalizeUnit(body.yieldUnit || defaultUnit)
                : body.yieldUnit ? normalizeUnit(body.yieldUnit) : null;
            const recipeUnit = normalizeUnit(body.recipeUnit || getPreferredRecipeUnit({ defaultUnit, yieldUnit }));
            const stockCorrectionFactor = deriveStockCorrectionFactor(defaultUnit, recipeUnit);

            const item = await prisma.supplyItem.create({
                data: {
                    name: body.name,
                    sku: body.sku || `SKU-${Date.now()}`,
                    category: body.category || 'General',
                    currentCost: Number(body.currentCost) || 0,
                    defaultUnit,
                    preferredSupplierId: body.preferredSupplierId || null,
                    tenantId: request.tenantId || 'enigma_hq',
                    stockQuantity: body.stockQuantity !== undefined ? Number(body.stockQuantity) : undefined,
                    yieldQuantity: body.yieldQuantity !== undefined && body.yieldQuantity !== null && body.yieldQuantity !== ''
                        ? Number(body.yieldQuantity)
                        : null,
                    yieldUnit,
                    yieldPercentage: body.yieldPercentage !== undefined ? Number(body.yieldPercentage) || 1 : 1,
                    recipeUnit,
                    stockCorrectionFactor,
                    isProduction,
                    parLevel: body.parLevel !== undefined ? Number(body.parLevel) : undefined,
                    minStock: body.minStock !== undefined ? Number(body.minStock) : undefined,
                    maxStock: body.maxStock !== undefined ? Number(body.maxStock) : undefined,
                    countFrequency: body.countFrequency || undefined,
                    countZone: body.countZone !== undefined ? Number(body.countZone) : undefined,
                },
            });

            if (Array.isArray(body.ingredients) && body.ingredients.length > 0) {
                await recipeService.syncRecipe(item.id, body.ingredients);
            }

            return enrichSupplyItemUnits(item);
        } catch (error: any) {
            console.error('[API] CRITICAL ERROR in POST /supply-items', error);
            return reply.status(500).send({ error: 'Server Error', message: error.message });
        }
    });

    fastify.put<{ Params: { id: string } }>('/supply-items/:id', async (request, reply) => {
        try {
            const { id } = request.params;
            const body = request.body as any;

            const currentItem = await prisma.supplyItem.findUnique({ where: { id } });
            if (!currentItem) return reply.status(404).send({ error: 'Item not found' });

            const defaultUnit = normalizeUnit(body.defaultUnit || body.unitOfMeasure || currentItem.defaultUnit || 'und');
            const resolvedIsProduction = typeof body.isProduction === 'boolean'
                ? body.isProduction
                : currentItem.isProduction || Boolean(body.ingredients?.length);
            const yieldUnit = resolvedIsProduction
                ? normalizeUnit(body.yieldUnit || currentItem.yieldUnit || defaultUnit)
                : (body.yieldUnit !== undefined ? normalizeUnit(body.yieldUnit) : currentItem.yieldUnit || null);
            const recipeUnit = normalizeUnit(
                body.recipeUnit
                || currentItem.recipeUnit
                || getPreferredRecipeUnit({ defaultUnit, yieldUnit })
            );
            const resolvedFactor = deriveStockCorrectionFactor(defaultUnit, recipeUnit);

            if (body.stockQuantity !== undefined) {
                const newStock = Number(body.stockQuantity);
                const oldStock = currentItem.stockQuantity || 0;

                if (newStock !== oldStock) {
                    await prisma.inventoryLog.create({
                        data: {
                            tenantId: currentItem.tenantId,
                            supplyItemId: id,
                            previousStock: oldStock,
                            newStock,
                            changeAmount: newStock - oldStock,
                            reason: 'audit',
                        },
                    });
                }
            }

            const updatedItem = await prisma.supplyItem.update({
                where: { id },
                data: {
                    name: body.name,
                    sku: body.sku,
                    category: body.category,
                    currentCost: body.currentCost !== undefined ? Number(body.currentCost) : undefined,
                    defaultUnit,
                    preferredSupplierId: body.preferredSupplierId !== undefined ? body.preferredSupplierId : undefined,
                    stockQuantity: body.stockQuantity !== undefined ? Number(body.stockQuantity) : undefined,
                    yieldQuantity: body.yieldQuantity !== undefined ? Number(body.yieldQuantity) : undefined,
                    yieldUnit,
                    yieldPercentage: body.yieldPercentage !== undefined ? Number(body.yieldPercentage) : undefined,
                    recipeUnit,
                    stockCorrectionFactor: resolvedFactor,
                    isProduction: resolvedIsProduction,
                    parLevel: body.parLevel !== undefined ? Number(body.parLevel) : undefined,
                    minStock: body.minStock !== undefined ? Number(body.minStock) : undefined,
                    maxStock: body.maxStock !== undefined ? Number(body.maxStock) : undefined,
                    countFrequency: body.countFrequency || undefined,
                    countZone: body.countZone !== undefined ? Number(body.countZone) : undefined,
                },
            });

            if (body.ingredients !== undefined && Array.isArray(body.ingredients)) {
                await recipeService.syncRecipe(id, body.ingredients);
            } else if (body.yieldQuantity !== undefined || body.currentCost !== undefined || body.recipeUnit !== undefined) {
                await recipeService.recalculateSupplyItemCost(id);
            }

            return enrichSupplyItemUnits(updatedItem);
        } catch (error: any) {
            console.error('[API] CRITICAL ERROR in PUT /supply-items/:id', error);
            return reply.status(500).send({ error: 'Server Error', message: error.message });
        }
    });

    fastify.get('/:id/price-history', async (request) => {
        const { id } = request.params as { id: string };

        const history = await prisma.priceHistory.findMany({
            where: { supplyItemId: id },
            orderBy: { changeDate: 'desc' },
            take: 20,
        });

        return history;
    });

    fastify.delete('/supply-items/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const tenantId = request.tenantId;
        if (!tenantId) return reply.code(400).send({ error: 'Missing tenant ID' });

        const item = await prisma.supplyItem.findFirst({ where: { id, tenantId } });
        if (!item) return reply.code(404).send({ error: 'Item not found' });

        await prisma.supplyItem.update({
            where: { id },
            data: { isActive: false },
        });

        return reply.send({ success: true, message: 'Item archived successfully' });
    });
}
