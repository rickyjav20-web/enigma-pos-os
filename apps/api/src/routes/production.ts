import { randomUUID } from 'crypto';
import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { recipeService } from '../services/RecipeService';
import { eventBus } from '../events/EventBus';
import { getInventoryDeduction } from '../lib/inventory-math';
import { convertQuantity, getOperationalUnit, normalizeUnit } from '../lib/units';

export default async function productionRoutes(fastify: FastifyInstance) {

    fastify.post('/production', async (request, reply) => {
        const { supplyItemId, quantity, unit, reason, userId } = request.body as any;
        const tenantId = request.tenantId || 'enigma_hq';
        const actorId = userId || 'system';

        const batchItem = await prisma.supplyItem.findUnique({
            where: { id: supplyItemId }
        });

        if (!batchItem) {
            return reply.status(404).send({ error: 'Batch Item not found' });
        }

        const ingredients = await prisma.productionRecipe.findMany({
            where: { parentItemId: supplyItemId },
            include: { component: true }
        });

        if (ingredients.length === 0) {
            return reply.status(400).send({ error: 'This item has no ingredients defined.' });
        }

        const requestedUnit = normalizeUnit(unit || batchItem.yieldUnit || batchItem.defaultUnit || 'und');
        const outputUnit = getOperationalUnit(batchItem);

        let normalizedQuantity = Number(quantity) || 0;
        try {
            normalizedQuantity = convertQuantity(normalizedQuantity, requestedUnit, outputUnit);
        } catch {
            normalizedQuantity = Number(quantity) || 0;
        }

        const yieldQty = Number(batchItem.yieldQuantity) || 1;
        const scale = normalizedQuantity / yieldQty;

        const movements = [];
        for (const ingredient of ingredients) {
            const requiredQty = getInventoryDeduction({
                recipeQuantity: ingredient.quantity,
                multiplier: scale,
                stockCorrectionFactor: ingredient.component?.stockCorrectionFactor,
                yieldPercentage: ingredient.component?.yieldPercentage,
            });

            await prisma.supplyItem.update({
                where: { id: ingredient.supplyItemId },
                data: {
                    stockQuantity: { decrement: requiredQty }
                }
            });

            await prisma.inventoryLog.create({
                data: {
                    tenantId,
                    supplyItemId: ingredient.supplyItemId,
                    previousStock: ingredient.component.stockQuantity,
                    newStock: ingredient.component.stockQuantity - requiredQty,
                    changeAmount: -requiredQty,
                    reason: 'PRODUCTION_INGREDIENT',
                    notes: `Used in Batch ${batchItem.name} (${normalizedQuantity} ${outputUnit})`
                }
            });

            movements.push({
                name: ingredient.component.name,
                used: requiredQty,
                unit: ingredient.unit
            });
        }

        const previousBatchStock = batchItem.stockQuantity;
        const updatedBatch = await prisma.supplyItem.update({
            where: { id: supplyItemId },
            data: {
                stockQuantity: { increment: normalizedQuantity },
                lastPurchaseDate: new Date()
            }
        });

        await prisma.inventoryLog.create({
            data: {
                tenantId,
                supplyItemId,
                previousStock: previousBatchStock,
                newStock: updatedBatch.stockQuantity,
                changeAmount: normalizedQuantity,
                reason: 'PRODUCTION_OUTPUT',
                notes: reason || 'Manual Production Run'
            }
        });

        await recipeService.recalculateSupplyItemCost(supplyItemId);

        await eventBus.publish({
            event_id: randomUUID(),
            tenant_id: tenantId,
            event_type: 'production_batch_completed',
            entity_type: 'supply_item',
            entity_id: supplyItemId,
            timestamp: Date.now(),
            actor_id: actorId,
            version: 1,
            metadata: {
                batchName: batchItem.name,
                quantity: normalizedQuantity,
                unit: outputUnit,
                ingredientsUsed: movements,
                reason
            }
        });

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
                    quantity: normalizedQuantity,
                    unit: outputUnit,
                    metadata: { reason, ingredientsUsed: movements }
                }
            });
        } catch (error) {
            console.warn('[PRODUCTION] Failed to log kitchen activity:', error);
        }

        return {
            success: true,
            message: `Produced ${normalizedQuantity} ${outputUnit} of ${batchItem.name}`,
            newStock: updatedBatch.stockQuantity,
            ingredientsUsed: movements
        };
    });
}
