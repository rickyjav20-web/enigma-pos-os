import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { eventBus } from '../events/EventBus';

export default async function wasteRoutes(fastify: FastifyInstance) {

    // POST /waste (Report Waste)
    fastify.post('/waste', async (request, reply) => {
        const { itemId, quantity, unit, type, reason, userId } = request.body as any;
        const tenantId = request.tenantId || 'enigma_hq';
        const actorId = userId || 'system';

        console.log(`🗑️ Reporting Waste: Item ${itemId}, Qty ${quantity} ${unit} (Type: ${type}, Reason: ${reason})`);

        // Check if item is SupplyItem or Product
        let supplyItem = await prisma.supplyItem.findUnique({ where: { id: itemId } });
        let product = null;
        let isSupplyItem = !!supplyItem;

        if (!supplyItem) {
            product = await prisma.product.findUnique({ where: { id: itemId } });
            if (!product) {
                return reply.status(404).send({ error: "Item not found" });
            }
        }

        const itemName = isSupplyItem ? supplyItem?.name : product?.name;
        const previousStock = isSupplyItem ? (supplyItem?.stockQuantity || 0) : 0; // Products don't strictly track stock yet in this schema usually, but if they did...
        // Note: The schema shows Product has `track_inventory` but no `stockQuantity` field directly on Product? 
        // Wait, schema check: Product has `track_inventory`, but where is the stock?
        // Ah, Product might not track stock directly if it's not a SupplyItem.
        // For MVP, if it's a Product (Zone 1), we might just log the waste without stock deduction capabilities if the field is missing,
        // OR we map it to its recipes.
        // BUT user said: "registar productos completos ya hechos de la zona 1".
        // If the Product doesn't have a stock field, we can't deduct.
        // Let's assume for now we only deduct if it's a SupplyItem, or if we add stock to Product (which might be a schema change I missed or isn't there).
        // Checking schema again... `Product` model has NO `stockQuantity`.
        // However, `SupplyItem` DOES.
        // If a Product is "Made", it might be a SupplyItem with `isProduction=true`.
        // If it's a "Sales Item" only (Product), and we waste it... technically we waste the INGREDIENTS?
        // OR we just log the financial loss.
        // For this MVP, I will log the "Event" and "InventoryLog" (if possible).
        // If it's a Supply Item, I deduct stock.

        let newStock = previousStock;

        if (isSupplyItem && supplyItem) {
            await prisma.supplyItem.update({
                where: { id: itemId },
                data: {
                    stockQuantity: { decrement: Number(quantity) }
                }
            });
            newStock = previousStock - Number(quantity);
        } else {
            // It's a Product. We can't deduct stock directly from Product table as it doesn't exist.
            // We just record the log.
            // Ideally we should deduct ingredients, but that's complex "De-production".
            // User just wants to "Registrar Merma".
            console.log("   - Waste is for a Product (Sales Item). No direct stock field to decrement. Logging event only.");
        }

        // Create InventoryLog (Linked to SupplyItem if possible)
        // InventoryLog requires `supplyItemId`. If it's a Product, we can't link it comfortably unless we have a SupplyItem for it.
        // Workaround: If it's a product, we rely on the Event for analytics, and maybe don't make an InventoryLog if strict FK is needed?
        // Schema: `supplyItem SupplyItem @relation(...)`. Yes, strictly needs SupplyItem.
        // SO: We only create InventoryLog if it's a SupplyItem.
        // If it's a Product, we relying on the EVENT for the "Data Core" to process (maybe the data core deducts ingredients).

        if (isSupplyItem) {
            await prisma.inventoryLog.create({
                data: {
                    tenantId,
                    supplyItemId: itemId,
                    previousStock,
                    newStock,
                    changeAmount: -Number(quantity),
                    reason: `WASTE_${type}`, // e.g. WASTE_BURNED
                    notes: reason || type
                }
            });
        }

        // Emit Event (This is the critical part for Data Core)
        await eventBus.publish({
            event_id: crypto.randomUUID(),
            tenant_id: tenantId,
            event_type: 'waste_reported',
            entity_type: isSupplyItem ? 'supply_item' : 'product',
            entity_id: itemId,
            timestamp: Date.now(),
            actor_id: actorId,
            version: 1,
            metadata: {
                itemName,
                quantity,
                unit,
                wasteType: type,
                reason,
                isSupplyItem
            }
        });

        // Log Kitchen Activity (for analytics)
        try {
            await prisma.kitchenActivityLog.create({
                data: {
                    tenantId,
                    employeeId: actorId,
                    employeeName: (request.body as any).userName || 'Unknown',
                    action: 'WASTE',
                    entityType: isSupplyItem ? 'supply_item' : 'product',
                    entityId: itemId,
                    entityName: itemName || 'Unknown',
                    quantity: Number(quantity),
                    unit: unit || 'und',
                    metadata: { wasteType: type, reason }
                }
            });
        } catch (e) {
            console.warn('[WASTE] Failed to log kitchen activity:', e);
        }

        return {
            success: true,
            message: `Reported waste for ${itemName}`,
            newStock
        };
    });
}
