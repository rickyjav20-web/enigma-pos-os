import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { recipeService } from '../services/RecipeService';

export default async function productionRoutes(fastify: FastifyInstance) {

    // POST /production (Execute Production Run)
    fastify.post('/production', async (request, reply) => {
        const { supplyItemId, quantity, unit } = request.body as any;
        const activeTenant = request.tenantId || 'enigma_hq';

        console.log(`🍳 Executing Production: Item ${supplyItemId}, Qty ${quantity} ${unit}`);

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
        // If Batch Yield is defined (e.g. Yield 5L), and we are producing 10L, scale is 2.
        // If no yield defined, assume 1-to-1 recipe definition per unit? 
        // Typically recipes are defined for X yield.

        const yieldQty = batchItem.yieldQuantity || 1;
        const scale = quantity / yieldQty;

        console.log(`   - Recipe Yield: ${yieldQty} ${batchItem.yieldUnit}`);
        console.log(`   - Target Qty: ${quantity} ${unit}`);
        console.log(`   - Scale Factor: ${scale}`);

        // 4. Deduct Ingredients
        const movements = [];
        for (const ing of ingredients) {
            const requiredQty = ing.quantity * scale;

            console.log(`   - Consuming: ${ing.component.name}: ${requiredQty} ${ing.unit}`);

            // Deduct
            await prisma.supplyItem.update({
                where: { id: ing.supplyItemId },
                data: {
                    stockQuantity: { decrement: requiredQty }
                }
            });

            movements.push({
                name: ing.component.name,
                used: requiredQty,
                unit: ing.unit
            });
        }

        // 5. Add Stock to Batch Item
        const updatedBatch = await prisma.supplyItem.update({
            where: { id: supplyItemId },
            data: {
                stockQuantity: { increment: Number(quantity) },
                lastPurchaseDate: new Date() // Mark as 'recently filled'
            }
        });

        // 6. Recalculate Cost (Just in case ingredients changed cost recently)
        await recipeService.recalculateSupplyItemCost(supplyItemId);

        return {
            success: true,
            message: `Produced ${quantity} ${unit} of ${batchItem.name}`,
            newStock: updatedBatch.stockQuantity,
            ingredientsUsed: movements
        };
    });
}
