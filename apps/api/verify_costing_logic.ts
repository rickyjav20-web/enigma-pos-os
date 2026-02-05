
import prisma from './src/lib/prisma';

async function verifyCostingLogic() {
    console.log('--- 🧪 STARTING COSTING LOGIC VERIFICATION ---');
    const tenantId = 'test_costing_' + Date.now();
    const sku = 'TEST-ITEM-001';

    // 1. SETUP: Create Tenant and Item
    console.log('[SETUP] Creating Test Tenant and SupplyItem...');
    await prisma.tenant.create({ data: { id: tenantId, name: 'Test Costing', slug: tenantId } });

    const item = await prisma.supplyItem.create({
        data: {
            tenantId,
            name: 'Test Ingredient',
            sku,
            defaultUnit: 'kg',
            currentCost: 10.0,
            averageCost: 10.0, // Initial state
            lastPurchaseDate: new Date('2023-01-01'),
            // Mocking initial stock? 
            // Note: Our schema doesn't have a direct 'stock' field on SupplyItem yet, 
            // it relies on 'Stock' model or 'calculated'. 
            // For MVP, we'll assume we check the 'averageCost' update logic which relies on *some* stock source.
            // Wait, to calculate WAC we need CURRENT STOCK. 
            // If Stock model is missing, we can't calculate WAC properly unless we pass it or store it.
            // Let's check if 'Stock' model exists or if we should add a simple 'stockQuantity' to SupplyItem for this MVP.
            // checking... schema says 'stock Stock[]'.
        }
    });

    // 1.5. CREATE SUPPLIER
    const supplier = await prisma.supplier.create({
        data: {
            tenantId,
            name: 'Test Supplier',
        }
    });

    // 2. MOCK STOCK (Using new stockQuantity)
    await prisma.supplyItem.update({
        where: { id: item.id },
        // @ts-ignore
        data: { stockQuantity: 5.0 }
    });

    console.log(`[STATE] Initial Item: ID=${item.id} Cost=$${item.currentCost} Avg=$${item.averageCost} Stock=5.0`);

    // 3. ACTION: Purchase 5 units at $20.00
    console.log('[ACTION] Creating Purchase Order (5 units @ $20.00)...');

    const po = await prisma.purchaseOrder.create({
        data: {
            tenantId,
            supplierId: supplier.id,
            status: 'draft',
            totalAmount: 100.0,
            lines: {
                create: [{
                    supplyItemId: item.id,
                    quantity: 5,
                    unitCost: 20.0,
                    totalCost: 100.0
                }]
            }
        },
        include: { lines: true }
    });

    // 4. TRIGGER: Confirm Order (This should trigger the Logic)
    console.log('[TRIGGER] Confirming Order...');

    // Import service
    const { recipeService } = await import('./src/services/RecipeService');

    // Call with correct signature (just ID)
    await recipeService.handlePurchaseConfirmation(po.id);

    // 5. VERIFY: Read Item again
    const updatedItem = await prisma.supplyItem.findUnique({ where: { id: item.id } });

    console.log('--- 📊 RESULTS ---');
    console.log(`[EXPECTED] New Avg Cost should be roughly $15.00 (` +
        `((5*10) + (5*20)) / 10 = 150/10 = 15)`);
    console.log(`[ACTUAL]   New Avg Cost: $${updatedItem?.averageCost}`);
    console.log(`[ACTUAL]   Last Purchase: ${updatedItem?.lastPurchaseDate}`);

    if (Math.abs((updatedItem?.averageCost || 0) - 15.0) < 0.1) {
        console.log('✅ SUCCESS: WAC Logic Verified.');
    } else {
        console.log('❌ FAILURE: WAC Logic Incorrect.');
    }
}

verifyCostingLogic().catch(console.error);
