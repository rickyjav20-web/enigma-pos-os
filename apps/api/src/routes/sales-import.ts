
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
            return reply.status(400).send({ error: "Invalid format", details: result.error.errors });
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
                                ingredients: { include: { supplyItem: true } }
                            }
                        }
                    }
                });

                if (!product) {
                    report.failedCount++;
                    report.errors.push(`Product not found: ${sale.productName}`);
                    continue;
                }

                // 2. Find Active Recipe
                // For MVP, take the first recipe. 
                const recipe = product.recipes[0];

                if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
                    report.failedCount++;
                    report.errors.push(`No recipe for: ${sale.productName}`);
                    continue;
                }

                // 3. Deduct Inventory
                for (const ingredient of recipe.ingredients) {
                    if (!ingredient.supplyItemId) continue;

                    const quantityToDeduct = ingredient.quantity * sale.quantity;

                    await prisma.supplyItem.update({
                        where: { id: ingredient.supplyItemId },
                        data: {
                            stockQuantity: { decrement: quantityToDeduct }
                        }
                    });

                    // Log movement
                    // Log movement
                    await prisma.inventoryLog.create({
                        data: {
                            supplyItemId: ingredient.supplyItemId,
                            changeAmount: -quantityToDeduct,
                            reason: `SALE_IMPORT: ${sale.productName} x${sale.quantity}`,
                            tenantId,
                            previousStock: 0,
                            newStock: 0
                        }
                    });

                    report.deductions.push({
                        item: ingredient.supplyItem?.name || ingredient.supplyItemId,
                        deducted: quantityToDeduct,
                        unit: ingredient.unit
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
