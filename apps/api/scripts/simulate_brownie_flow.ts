
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' }); // Adjust path to root .env
import prisma from '../src/lib/prisma';

async function main() {
    const tenantId = 'enigma_hq';
    console.log("🍪 STARTING BROWNIE SIMULATION 🍪");

    // 1. SETUP: Find Items
    const batchName = 'Bandeja Brownie';
    const productName = 'Brownie';

    const batchItem = await prisma.supplyItem.findFirst({
        where: { name: { contains: batchName, mode: 'insensitive' }, isProduction: true },
        include: { ingredients: { include: { component: true } } }
    });

    if (!batchItem) {
        console.error(`❌ Batch Item '${batchName}' not found!`);
        return;
    }

    const product = await prisma.product.findFirst({
        where: { name: { contains: productName, mode: 'insensitive' } },
        include: { recipes: { include: { supplyItem: true } } }
    });

    if (!product) {
        console.error(`❌ Product '${productName}' not found!`);
        return;
    }

    console.log(`✅ Found Batch: ${batchItem.name} (ID: ${batchItem.id})`);
    console.log(`   - Current Stock: ${batchItem.stockQuantity} ${batchItem.yieldUnit || 'units'}`);
    console.log(`   - Yield per Batch: ${batchItem.yieldQuantity || 1}`);
    console.log(`✅ Found Product: ${product.name} (ID: ${product.id})`);

    // 2. SIMULATE PRODUCTION (1 Batch)
    console.log("\n🏭 STEP 1: EXECUTING PRODUCTION (1 BATCH)...");

    // Snapshot ingredients
    const ingredientSnapshots: Record<string, number> = {};
    for (const ing of batchItem.ingredients) {
        const item = await prisma.supplyItem.findUnique({ where: { id: ing.supplyItemId } });
        if (item) ingredientSnapshots[item.id] = item.stockQuantity;
        console.log(`   - Ingredient ${ing.component.name}: ${item?.stockQuantity} -> Should decrease by ${ing.quantity}`);
    }

    const startBatchStock = batchItem.stockQuantity;
    const batchYield = batchItem.yieldQuantity || 1;

    // EXECUTE DB UPDATES (Mimicking /production route)
    // 2a. Deduct Ingredients
    for (const ing of batchItem.ingredients) {
        await prisma.supplyItem.update({
            where: { id: ing.supplyItemId },
            data: { stockQuantity: { decrement: ing.quantity } }
        });

        // Log
        await prisma.inventoryLog.create({
            data: {
                supplyItemId: ing.supplyItemId,
                changeAmount: -ing.quantity,
                reason: 'SIM_PRODUCTION_DEDUCT',
                tenantId,
                previousStock: ingredientSnapshots[ing.supplyItemId],
                newStock: ingredientSnapshots[ing.supplyItemId] - ing.quantity
            }
        });
    }

    // 2b. Add Batch Stock
    await prisma.supplyItem.update({
        where: { id: batchItem.id },
        data: { stockQuantity: { increment: batchYield } }
    });
    // Log
    await prisma.inventoryLog.create({
        data: {
            supplyItemId: batchItem.id,
            changeAmount: batchYield,
            reason: 'SIM_PRODUCTION_YIELD',
            tenantId,
            previousStock: startBatchStock,
            newStock: startBatchStock + batchYield
        }
    });

    console.log("✅ Production Complete.");

    // VERIFY PRE-SALE
    const updatedBatch = await prisma.supplyItem.findUnique({ where: { id: batchItem.id } });
    console.log(`   👉 New Batch Stock: ${updatedBatch?.stockQuantity} (Expected: ${startBatchStock + batchYield})`);


    // 3. SIMULATE SALE (1 Brownie)
    console.log("\n💰 STEP 2: SIMULATING SALE (1 BROWNIE)...");

    // Logic: Product "Brownie" uses X amount of SupplyItem "Bandeja Brownie" (or maybe it uses a Portion?)
    // Let's check the recipe
    const recipeLine = product.recipes.find(r => r.supplyItemId === batchItem.id);

    if (!recipeLine) {
        console.error("❌ Link Broken: Product does not use Batch Item in its recipe!");
        console.log("   - Product Recipe Ingredients:", product.recipes.map(r => r.supplyItem?.name));
    } else {
        const portionQty = recipeLine.quantity;
        console.log(`   - Recipe: 1 ${product.name} uses ${portionQty} ${recipeLine.unit} of ${batchItem.name}`);

        // EXECUTE SALE DEDUCTION
        await prisma.supplyItem.update({
            where: { id: batchItem.id },
            data: { stockQuantity: { decrement: portionQty } }
        });

        await prisma.inventoryLog.create({
            data: {
                supplyItemId: batchItem.id,
                changeAmount: -portionQty,
                reason: `SIM_SALE: ${product.name}`,
                tenantId,
                previousStock: updatedBatch!.stockQuantity,
                newStock: updatedBatch!.stockQuantity - portionQty
            }
        });

        const finalBatch = await prisma.supplyItem.findUnique({ where: { id: batchItem.id } });
        console.log("✅ Sale Complete.");
        console.log(`   👉 Final Batch Stock: ${finalBatch?.stockQuantity} (Expected: ${updatedBatch!.stockQuantity - portionQty})`);

        const value = (finalBatch?.stockQuantity || 0) * (finalBatch?.currentCost || 0);
        console.log(`   💰 Final Asset Value (Stock * Cost): $${value.toFixed(2)}`);
    }

    console.log("\n🏁 SIMULATION ENDED.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
