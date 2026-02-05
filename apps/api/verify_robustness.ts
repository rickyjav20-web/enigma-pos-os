
import prisma from './src/lib/prisma';
import { recipeService } from './src/services/RecipeService';

async function logState(label: string, id: string, type: 'SUPPLY' | 'PRODUCT') {
    if (type === 'SUPPLY') {
        const item = await prisma.supplyItem.findUnique({ where: { id } });
        console.log(`[STATE] ${label} | Cost: $${item?.currentCost?.toFixed(4)} | Avg: $${item?.averageCost?.toFixed(4)}`);
        return item?.currentCost || 0;
    } else {
        const item = await prisma.product.findUnique({ where: { id } });
        console.log(`[STATE] ${label} | Cost: $${item?.cost?.toFixed(4)} | Price: $${item?.price?.toFixed(2)}`);
        return item?.cost || 0;
    }
}

async function verifyRobustness() {
    console.log('\n🔵 --- STARTING ROBUSTNESS VERIFICATION (DOUBLE CHECK) ---');
    const tenantId = 'robust_check_' + Date.now();
    await prisma.tenant.create({ data: { id: tenantId, name: 'Robustness Lab', slug: tenantId } });

    // --- STEP 1: CREATE HIERARCHY ---
    console.log('\n🔹 [STEP 1] PROVISIONING HIERARCHY (Pantry -> Kitchen -> Menu)');

    // 1. Pantry: Oil
    const oil = await prisma.supplyItem.create({
        data: { tenantId, name: 'Aceite Oliva (Raw)', currentCost: 10.0, defaultUnit: 'lt', averageCost: 10.0, stockQuantity: 10 }
    });
    console.log(`✅ Created Raw: ${oil.name} (ID: ${oil.id}) @ $10.00`);

    // 2. Kitchen: Mayo Batch (Yields 1kg, Uses 0.5lt Oil)
    // Theoretical Cost: 0.5 * 10 = $5.00
    const mayo = await prisma.supplyItem.create({
        data: { tenantId, name: 'Mayonesa Casera (Batch)', yieldQuantity: 1, yieldUnit: 'kg', isProduction: true, defaultUnit: 'kg' }
    });
    await recipeService.syncRecipe(mayo.id, [{ id: oil.id, quantity: 0.5, unit: 'lt' }]);
    console.log(`✅ Created Batch: ${mayo.name} (ID: ${mayo.id}) <- Linked to Oil`);

    // 3. Menu: Sandwich (Uses 0.1kg Mayo)
    // Theoretical Cost: 0.1 * 5.00 = $0.50
    const sandwich = await prisma.product.create({
        data: { tenantId, name: 'Club Sandwich', price: 15.0, cost: 0 }
    });
    await recipeService.syncProductRecipe(sandwich.id, [{ id: mayo.id, quantity: 0.1, unit: 'kg' }]);
    console.log(`✅ Created Product: ${sandwich.name} (ID: ${sandwich.id}) <- Linked to Mayo`);

    // --- STEP 2: VERIFY INITIAL STATE ---
    console.log('\n🔹 [STEP 2] VERIFYING INITIAL INTEGRITY');
    const initialMayoCost = await logState('Mayo', mayo.id, 'SUPPLY');
    const initialSandwichCost = await logState('Sandwich', sandwich.id, 'PRODUCT');

    if (Math.abs(initialMayoCost - 5.0) > 0.1) console.error('❌ ERROR: Mayo Initial Cost Mismatch');
    if (Math.abs(initialSandwichCost - 0.5) > 0.01) console.error('❌ ERROR: Sandwich Initial Cost Mismatch');

    // --- STEP 3: EXECUTE INFLATION EVENT (Purchase) ---
    console.log('\n🔹 [STEP 3] EXECUTING INFLATION EVENT (Buying Oil @ $20.00)');
    // Initial: 10 units @ $10.
    // Buy: 10 units @ $20.
    // New Total: 20 units. Total Value: (10*10) + (10*20) = 100 + 200 = 300.
    // New Avg: 300 / 20 = $15.00.

    // Create Supplier
    const supplier = await prisma.supplier.create({ data: { tenantId, name: 'Inflated Supplier', email: 'greedy@supplier.com' } });

    // Create PO
    const po = await prisma.purchaseOrder.create({
        data: { tenantId, supplierId: supplier.id, status: 'DRAFT', totalAmount: 200.0 }
    });

    await prisma.purchaseLine.create({
        data: {
            purchaseOrderId: po.id,
            supplyItemId: oil.id,
            quantity: 10,
            unitCost: 20.0,
            totalCost: 200.0 // 10 * 20
        }
    });

    // CONFIRM PO (Triggers handlePurchaseConfirmation)
    console.log('⚡ TRIGGERING PO CONFIRMATION...');
    await recipeService.handlePurchaseConfirmation(po.id);

    // --- STEP 4: VERIFY CASCADE ---
    console.log('\n🔹 [STEP 4] VERIFYING CASCADE UPDATES');
    // Expected:
    // Oil Avg: $15.00
    // Mayo: 0.5 * 15.00 = $7.50
    // Sandwich: 0.1 * 7.50 = $0.75

    await logState('Oil', oil.id, 'SUPPLY');
    const newMayoCost = await logState('Mayo', mayo.id, 'SUPPLY');
    const newSandwichCost = await logState('Sandwich', sandwich.id, 'PRODUCT');

    if (Math.abs(newMayoCost - 7.5) < 0.1 && Math.abs(newSandwichCost - 0.75) < 0.01) {
        console.log('\n✅✅ DOUBLE CHECK PASSED: System is Robust and Reactive.');
    } else {
        console.error('\n❌❌ DOUBLE CHECK FAILED: Cascade values incorrect.');
        console.error(`Expected Mayo ~$7.50, Got $${newMayoCost}`);
        console.error(`Expected Sandwich ~$0.75, Got $${newSandwichCost}`);
    }
}

verifyRobustness().catch(console.error);
