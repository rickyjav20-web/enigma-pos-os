
import prisma from '../apps/api/src/lib/prisma';
import { recipeService } from '../apps/api/src/services/RecipeService';

async function run() {
    console.log("🛠️ Fixing Yields...");

    // Sim Cookie Dough -> 10kg
    const cookie = await prisma.supplyItem.findFirst({ where: { name: 'Sim Cookie Dough' } });
    if (cookie) {
        await prisma.supplyItem.update({
            where: { id: cookie.id },
            data: { yieldQuantity: 10, yieldUnit: 'kg' }
        });
        console.log("Updated Cookie Dough Yield -> 10kg");
        await recipeService.recalculateSupplyItemCost(cookie.id);
        console.log("Recalculated Cost.");
    }

    // Sim Bread Dough -> 20kg
    const bread = await prisma.supplyItem.findFirst({ where: { name: 'Sim Bread Dough' } });
    if (bread) {
        await prisma.supplyItem.update({
            where: { id: bread.id },
            data: { yieldQuantity: 20, yieldUnit: 'kg' }
        });
        console.log("Updated Bread Dough Yield -> 20kg");
        await recipeService.recalculateSupplyItemCost(bread.id);
        console.log("Recalculated Cost.");
    }

    console.log("Done.");
}
run().catch(console.error);
