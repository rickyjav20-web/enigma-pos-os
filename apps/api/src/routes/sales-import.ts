
import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { z } from 'zod';

const SalesImportSchema = z.object({
    sales: z.array(z.object({
        productName: z.string(),
        quantity: z.number().min(0)
    }))
});

export default async function salesImportRoutes(fastify: FastifyInstance) {
    fastify.post('/sales/import', async (request, reply) => {
        const result = SalesImportSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({ error: "Invalid format", details: (result as any).error.errors });
        }

        const { sales } = result.data;
        const tenantId = request.tenantId || 'enigma_hq';
        const report = {
            successCount: 0,
            failedCount: 0,
            errors: [] as string[],
            deductions: [] as any[]
        };

        // Process sequentially to avoid race conditions on inventory for now
        // In a high-throughput system, we'd batch this.
        for (const sale of sales) {
            try {
                // 1. Find Product by Name
                // We use a case-insensitive rudimentary search or exact match
                // Ideally, SKU matching is better, but user asked for "Name"
                const product = await prisma.product.findFirst({
                    where: {
                        name: { equals: sale.productName, mode: 'insensitive' },

                    },
                    include: {
                        recipes: {
                            include: {
                                supplyItem: true
                            }
                        }
                    }
                });

                if (!product) {
                    report.failedCount++;
                    report.errors.push(`Product not found: ${sale.productName}`);
                    continue;
                }

                const ingredients = product.recipes;

                if (!ingredients || ingredients.length === 0) {
                    report.failedCount++;
                    report.errors.push(`No recipe ingredients for: ${sale.productName}`);
                    continue;
                }

                // 3. Deduct Inventory
                for (const recipeItem of ingredients) {
                    if (!recipeItem.supplyItemId) continue;

                    const quantityToDeduct = recipeItem.quantity * sale.quantity;

                    await prisma.supplyItem.update({
                        where: { id: recipeItem.supplyItemId },
                        data: {
                            stockQuantity: { decrement: quantityToDeduct }
                        }
                    });

                    // Log movement
                    await prisma.inventoryLog.create({
                        data: {
                            supplyItemId: recipeItem.supplyItemId,
                            changeAmount: -quantityToDeduct,
                            reason: `SALE_IMPORT: ${sale.productName} x${sale.quantity}`,
                            tenantId,
                            previousStock: 0,
                            newStock: 0
                        }
                    });

                    report.deductions.push({
                        item: recipeItem.supplyItem?.name || recipeItem.supplyItemId,
                        deducted: quantityToDeduct,
                        unit: recipeItem.unit
                    });
                }

                report.successCount++;

            } catch (e: any) {
                console.error(e);
                report.failedCount++;
                report.errors.push(`Error processing ${sale.productName}: ${e.message}`);
            }
        }

        return report;
    });
}
