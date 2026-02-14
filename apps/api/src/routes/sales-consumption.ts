
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma';

const ProcessBatchSchema = z.object({
    batchId: z.string().uuid()
});

export default async function salesConsumptionRoutes(fastify: FastifyInstance) {
    fastify.post('/sales/process-batch', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const result = ProcessBatchSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({ error: "Invalid Batch ID", details: (result as any).error.errors });
        }

        const { batchId } = result.data;

        try {
            // 1. Fetch Batch & Events
            const batch = await prisma.saleBatch.findUnique({
                where: { id: batchId },
                include: { events: true }
            });

            if (!batch) return reply.status(404).send({ error: "Batch not found" });
            if (batch.status !== 'PENDING') return reply.status(400).send({ error: `Batch is already ${batch.status}` });

            // 2. Aggregate Sales (Map: Product Identifier -> Total Qty)
            // We use SKU as primary key, Product Name as fallback
            const productUsage = new Map<string, number>(); // Key: "SKU:..." or "NAME:..."

            for (const event of batch.events) {
                const key = event.sku ? `SKU:${event.sku.toLowerCase()}` : `NAME:${event.productName.toLowerCase()}`;
                const current = productUsage.get(key) || 0;
                productUsage.set(key, current + event.quantity);
            }

            // 3. Fetch Recipes for these products
            // We need to find the Product IDs first.
            const skuList = batch.events.filter(e => e.sku).map(e => e.sku!.toLowerCase());
            const nameList = batch.events.map(e => e.productName.toLowerCase());

            const products = await prisma.product.findMany({
                where: {
                    tenantId,
                    OR: [
                        { sku: { in: skuList, mode: 'insensitive' } },
                        { name: { in: nameList, mode: 'insensitive' } }
                    ]
                },
                include: {
                    recipes: {
                        include: { supplyItem: true }
                    }
                }
            });

            // Map Product to its Recipe
            // We need a lookup: Key (SKU/Name) -> Product with Recipe
            const productLookup = new Map();
            for (const p of products) {
                if (p.sku) productLookup.set(`SKU:${p.sku.toLowerCase()}`, p);
                productLookup.set(`NAME:${p.name.toLowerCase()}`, p);
            }

            // 4. Calculate Inventory Deductions
            const consumptions = new Map<string, { amount: number, supplyItemName: string }>(); // SupplyItemId -> Amount

            const missingRecipes = new Set<string>();

            for (const [key, qty] of productUsage.entries()) {
                const product = productLookup.get(key);

                if (!product) {
                    // unexpected, should have been caught in preview, but maybe product was deleted?
                    continue;
                }

                if (!product.recipes || product.recipes.length === 0) {
                    missingRecipes.add(product.name);
                    continue;
                }

                for (const recipe of product.recipes) {
                    const item = recipe.supplyItem;
                    const factor = item.stockCorrectionFactor || 1;
                    const yieldPct = item.yieldPercentage || 1;

                    // SMART YIELD DEDUCTION LOGIC:
                    // 1. Convert RecipeQty to StockUnit (e.g. 20g -> 0.02kg)
                    const qtyInStockUnit = recipe.quantity / factor;

                    // 2. Apply Yield to get Gross Deduction (e.g. 0.02kg / 0.4 -> 0.05kg)
                    const grossDeductionPerUnit = qtyInStockUnit / yieldPct;

                    // 3. Total for Sales Quantity
                    const totalNeeded = grossDeductionPerUnit * qty;

                    const existing = consumptions.get(recipe.supplyItemId);
                    consumptions.set(recipe.supplyItemId, {
                        amount: (existing?.amount || 0) + totalNeeded,
                        supplyItemName: recipe.supplyItem.name
                    });
                }
            }

            // 5. Execute Transaction
            await prisma.$transaction(async (tx) => {
                const now = new Date();

                // A. Deduct Inventory & Log
                for (const [supplyItemId, { amount, supplyItemName }] of consumptions.entries()) {
                    // Fetch current stock first to log history
                    const item = await tx.supplyItem.findUnique({ where: { id: supplyItemId } });
                    const currentStock = item?.stockQuantity || 0;
                    const newStock = currentStock - amount;

                    // Update Stock
                    await tx.supplyItem.update({
                        where: { id: supplyItemId },
                        data: { stockQuantity: newStock }
                    });

                    // Log it
                    await tx.inventoryLog.create({
                        data: {
                            tenantId,
                            supplyItemId,
                            previousStock: currentStock,
                            newStock: newStock,
                            changeAmount: -amount,
                            reason: `Batch ${batch.fileName || batchId} (Sales)`,
                            notes: `Deducted ${amount} of ${supplyItemName} for sales batch`
                        }
                    });
                }

                // B. Update Batch Status
                await tx.saleBatch.update({
                    where: { id: batchId },
                    data: {
                        status: 'COMPLETED',
                        processedAt: now
                    }
                });

                // C. Update Events Status
                await tx.saleEvent.updateMany({
                    where: { batchId },
                    data: { status: 'PROCESSED' }
                });
            });

            return {
                success: true,
                message: "Batch processed successfully.",
                stats: {
                    itemsDeducted: consumptions.size,
                    productsWithNoRecipe: Array.from(missingRecipes)
                }
            };

        } catch (e: any) {
            console.error("Consumption Error", e);
            return reply.status(500).send({ error: "Failed to process batch", message: e.message });
        }
    });
}
