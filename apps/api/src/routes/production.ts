import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { recipeService } from '../services/RecipeService';
import { eventBus } from '../events/EventBus';

export default async function productionRoutes(fastify: FastifyInstance) {

    // POST /production (Execute Production Run)
    fastify.post('/production', async (request, reply) => {
        const { supplyItemId, quantity, unit, reason, userId } = request.body as any;
        const tenantId = request.tenantId || 'enigma_hq';
        const actorId = userId || 'system';

        console.log(`🍳 Executing Production: Item ${supplyItemId}, Qty ${quantity} ${unit} (Reason: ${reason})`);

        // 1. Get the Batch Item
        const batchItem = await prisma.supplyItem.findUnique({
            where: { id: supplyItemId }
        });

        if (!batchItem) {
            return reply.status(404).send({ error: "Batch Item not found" });
        }

        // 2. Get Ingredients (ProductionRecipe)
        const ingredients = await prisma.productionRecipe.findMany({
            where: { parentItemId: supplyItemId },
            include: { component: true }
        });

        if (ingredients.length === 0) {
            return reply.status(400).send({ error: "This item has no ingredients defined." });
        }

        // 3. Calculate Scale Factor
        const yieldQty = batchItem.yieldQuantity || 1;
        const scale = quantity / yieldQty;

        // 4. Deduct Ingredients
        const movements = [];
        for (const ing of ingredients) {
            const requiredQty = ing.quantity * scale;

            // Deduct
            await prisma.supplyItem.update({
                where: { id: ing.supplyItemId },
                data: {
                    stockQuantity: { decrement: requiredQty }
                }
            });

            // Log Ingredient Usage
            await prisma.inventoryLog.create({
                data: {
                    tenantId,
                    supplyItemId: ing.supplyItemId,
                    previousStock: ing.component.stockQuantity, // Approximation
                    newStock: ing.component.stockQuantity - requiredQty, // Approximation
                    changeAmount: -requiredQty,
                    reason: 'PRODUCTION_INGREDIENT',
                    notes: `Used in Batch ${batchItem.name} (${quantity} ${unit})`
                }
            });

            movements.push({
                name: ing.component.name,
                used: requiredQty,
                unit: ing.unit
            });
        }

        // 5. Add Stock to Batch Item
        const previousBatchStock = batchItem.stockQuantity;
        const updatedBatch = await prisma.supplyItem.update({
            where: { id: supplyItemId },
            data: {
                stockQuantity: { increment: Number(quantity) },
                lastPurchaseDate: new Date()
            }
        });

        // Log Batch Creation
        await prisma.inventoryLog.create({
            data: {
                tenantId,
                supplyItemId,
                previousStock: previousBatchStock,
                newStock: updatedBatch.stockQuantity,
                changeAmount: Number(quantity),
                reason: 'PRODUCTION_OUTPUT',
                notes: reason || 'Manual Production Run'
            }
        });

        // 6. Recalculate Cost
        await recipeService.recalculateSupplyItemCost(supplyItemId);

        // 7. Emit Event
        await eventBus.publish({
            event_id: crypto.randomUUID(),
            tenant_id: tenantId,
            event_type: 'production_batch_completed',
            entity_type: 'supply_item',
            entity_id: supplyItemId,
            timestamp: Date.now(),
            actor_id: actorId,
            version: 1,
            metadata: {
                batchName: batchItem.name,
                quantity,
                unit,
                ingredientsUsed: movements,
                reason
            }
        });

        // 8. Log Kitchen Activity (for analytics)
        try {
            await prisma.kitchenActivityLog.create({
                data: {
                    tenantId,
                    employeeId: actorId,
                    employeeName: (request.body as any).userName || 'Unknown',
                    action: 'PRODUCTION',
                    entityType: 'supply_item',
                    entityId: supplyItemId,
                    entityName: batchItem.name,
                    quantity: Number(quantity),
                    unit: unit || batchItem.yieldUnit || 'und',
                    metadata: { reason, ingredientsUsed: movements }
                }
            });
        } catch (e) {
            console.warn('[PRODUCTION] Failed to log kitchen activity:', e);
        }

        return {
            success: true,
            message: `Produced ${quantity} ${unit} of ${batchItem.name}`,
            newStock: updatedBatch.stockQuantity,
            ingredientsUsed: movements
        };
    });
}

