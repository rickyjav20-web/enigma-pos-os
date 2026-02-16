/**
 * Kitchen Module V2 — Full Data Flow Verification
 * Tests: Production (ingredient deduction + batch creation) + Waste (stock deduction + logging)
 * Run: npx ts-node apps/api/scripts/verify_kitchen_flow.ts
 */

const BASE_URL = 'https://enigma-pos-os-production.up.railway.app';
const API = `${BASE_URL}/api/v1`;

interface TestResult {
    test: string;
    pass: boolean;
    detail: string;
}

const results: TestResult[] = [];

function log(test: string, pass: boolean, detail: string) {
    results.push({ test, pass, detail });
    const icon = pass ? '✅' : '❌';
    console.log(`${icon} ${test}: ${detail}`);
}

async function fetchJSON(url: string, opts?: any) {
    const resp = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    });
    return resp.json();
}

async function main() {
    console.log('='.repeat(60));
    console.log('  KITCHEN MODULE V2 — DATA FLOW VERIFICATION');
    console.log('='.repeat(60));
    console.log(`  Target: ${BASE_URL}`);
    console.log(`  Time: ${new Date().toISOString()}`);
    console.log('='.repeat(60));

    // ===== PHASE 1: ROLES & PERMISSIONS =====
    console.log('\n📋 PHASE 1: Roles & Permissions');
    const rolesRes = await fetchJSON(`${API}/roles`);
    const roles = rolesRes.roles || [];
    log('Roles exist', roles.length > 0, `Found ${roles.length} roles`);

    const cocinaRole = roles.find((r: any) => r.name === 'Cocina');
    if (cocinaRole) {
        log('Cocina canAccessKitchen', cocinaRole.canAccessKitchen === true, `canAccessKitchen=${cocinaRole.canAccessKitchen}`);
        log('Cocina canAccessOps is false', cocinaRole.canAccessOps === false, `canAccessOps=${cocinaRole.canAccessOps}`);
    } else {
        log('Cocina role exists', false, 'Cocina role not found');
    }

    const adminRole = roles.find((r: any) => r.name === 'ADMIN');
    if (adminRole) {
        log('ADMIN canAccessKitchen', adminRole.canAccessKitchen === true, `canAccessKitchen=${adminRole.canAccessKitchen}`);
    }

    const cajeroRole = roles.find((r: any) => r.name === 'Cajero');
    if (cajeroRole) {
        log('Cajero canAccessKitchen blocked', cajeroRole.canAccessKitchen === false, `canAccessKitchen=${cajeroRole.canAccessKitchen}`);
    }

    // ===== PHASE 2: FIND PRODUCTION ITEM =====
    console.log('\n🍳 PHASE 2: Production Data Flow');

    // Find a production item with ingredients
    const supplyRes = await fetchJSON(`${API}/supply-items?limit=300`);
    const allItems = supplyRes.data || [];
    const productionItems = allItems.filter((i: any) => i.isProduction && i.ingredients?.length > 0);
    log('Production items found', productionItems.length > 0, `Found ${productionItems.length} items with isProduction=true and ingredients`);

    if (productionItems.length === 0) {
        console.log('⚠️ No production items with ingredients. Skipping production test.');
    } else {
        // Use "Rolls de Canela – 8u" if available, otherwise first one
        const testItem = productionItems.find((i: any) => i.name.includes('Rolls')) || productionItems[0];
        console.log(`\n  📦 Test Item: ${testItem.name} (ID: ${testItem.id})`);
        console.log(`  Yield: ${testItem.yieldQuantity || 'NULL'} ${testItem.yieldUnit || 'NULL'}`);
        console.log(`  Current Stock: ${testItem.stockQuantity}`);
        console.log(`  Ingredients:`);
        for (const ing of testItem.ingredients) {
            console.log(`    - ${ing.component?.name}: ${ing.quantity} ${ing.unit} (stock: ${ing.component?.stockQuantity})`);
        }

        // Snapshot BEFORE production
        const beforeBatchStock = testItem.stockQuantity;
        const ingredientSnapshots: Record<string, number> = {};
        for (const ing of testItem.ingredients) {
            ingredientSnapshots[ing.supplyItemId] = ing.component?.stockQuantity || 0;
        }

        // Execute production (1 batch)
        const prodPayload = {
            supplyItemId: testItem.id,
            quantity: testItem.yieldQuantity || 1,
            unit: testItem.yieldUnit || 'und',
            reason: 'VERIFICATION_TEST',
            userId: 'system-verifier',
            userName: 'Data Flow Test'
        };

        console.log(`\n  🔄 Executing production: ${JSON.stringify(prodPayload)}`);
        const prodResult = await fetchJSON(`${API}/production`, {
            method: 'POST',
            body: JSON.stringify(prodPayload)
        });

        log('Production API success', prodResult.success === true, prodResult.message || JSON.stringify(prodResult));

        if (prodResult.success) {
            // Verify batch stock increased
            log('Batch stock increased', prodResult.newStock > beforeBatchStock,
                `Before: ${beforeBatchStock} → After: ${prodResult.newStock}`);

            // Verify ingredients used
            if (prodResult.ingredientsUsed) {
                log('Ingredients deducted', prodResult.ingredientsUsed.length > 0,
                    `${prodResult.ingredientsUsed.length} ingredients used: ${prodResult.ingredientsUsed.map((i: any) => `${i.name}: -${i.used} ${i.unit}`).join(', ')}`);
            }

            // Refresh and verify actual DB state
            const afterItem = await fetchJSON(`${API}/supply-items/${testItem.id}`);
            log('DB stock matches', afterItem.stockQuantity === prodResult.newStock,
                `API returned ${prodResult.newStock}, DB has ${afterItem.stockQuantity}`);

            // Check ingredient stocks actually decremented
            for (const ing of testItem.ingredients) {
                const afterIng = await fetchJSON(`${API}/supply-items/${ing.supplyItemId}`);
                const expectedStock = ingredientSnapshots[ing.supplyItemId] - (ing.quantity * ((testItem.yieldQuantity || 1) / (testItem.yieldQuantity || 1)));
                log(`Ingredient ${ing.component?.name} deducted`,
                    afterIng.stockQuantity < ingredientSnapshots[ing.supplyItemId] || ingredientSnapshots[ing.supplyItemId] === 0,
                    `Before: ${ingredientSnapshots[ing.supplyItemId]} → After: ${afterIng.stockQuantity}`);
            }

            // Check InventoryLog
            const logs = await fetchJSON(`${API}/inventory/logs?limit=10`);
            const recentLogs = (logs.data || []).filter((l: any) =>
                l.reason === 'PRODUCTION_OUTPUT' || l.reason === 'PRODUCTION_INGREDIENT'
            );
            log('InventoryLogs created', recentLogs.length > 0,
                `Found ${recentLogs.length} production-related logs`);
        }
    }

    // ===== PHASE 3: WASTE DATA FLOW =====
    console.log('\n🗑️ PHASE 3: Waste Data Flow');

    // Find an item with stock to waste
    const itemsWithStock = allItems.filter((i: any) => i.stockQuantity > 0);
    console.log(`  Items with stock > 0: ${itemsWithStock.length}`);

    // Use the production item we just created (it should have stock now)
    let wasteTestItem = productionItems.length > 0 ? productionItems.find((i: any) => i.name.includes('Rolls')) || productionItems[0] : null;

    // Refresh stock
    if (wasteTestItem) {
        wasteTestItem = await fetchJSON(`${API}/supply-items/${wasteTestItem.id}`);
    }

    if (!wasteTestItem || wasteTestItem.stockQuantity <= 0) {
        // Fallback: find any item with stock
        if (itemsWithStock.length > 0) {
            wasteTestItem = itemsWithStock[0];
        } else {
            console.log('⚠️ No items with stock > 0 for waste test. Picking a zero-stock item.');
            wasteTestItem = allItems[0];
        }
    }

    if (wasteTestItem) {
        console.log(`\n  📦 Waste Test Item: ${wasteTestItem.name} (ID: ${wasteTestItem.id})`);
        console.log(`  Current Stock: ${wasteTestItem.stockQuantity}`);

        const wastePayload = {
            itemId: wasteTestItem.id,
            quantity: 1,
            unit: wasteTestItem.defaultUnit || 'und',
            type: 'WRONG_ORDER',
            reason: 'Verification test - wrong order',
            userId: 'system-verifier',
            userName: 'Data Flow Test'
        };

        const beforeWasteStock = wasteTestItem.stockQuantity;
        console.log(`\n  🔄 Reporting waste: ${JSON.stringify(wastePayload)}`);
        const wasteResult = await fetchJSON(`${API}/waste`, {
            method: 'POST',
            body: JSON.stringify(wastePayload)
        });

        log('Waste API success', wasteResult.success === true, wasteResult.message || JSON.stringify(wasteResult));

        if (wasteResult.success) {
            log('Waste stock deducted', wasteResult.newStock === beforeWasteStock - 1,
                `Before: ${beforeWasteStock} → After: ${wasteResult.newStock}`);

            // Verify DB
            const afterWaste = await fetchJSON(`${API}/supply-items/${wasteTestItem.id}`);
            log('Waste DB stock matches', afterWaste.stockQuantity === wasteResult.newStock,
                `API returned ${wasteResult.newStock}, DB has ${afterWaste.stockQuantity}`);
        }
    }

    // ===== PHASE 4: KITCHEN ACTIVITY LOG =====
    console.log('\n📊 PHASE 4: Kitchen Activity Log');
    const activityRes = await fetchJSON(`${API}/kitchen/activity?limit=10`);
    if (activityRes.success) {
        log('Activity logs accessible', true, `Found ${activityRes.count || 0} activity entries`);
        const productionLogs = (activityRes.data || []).filter((l: any) => l.action === 'PRODUCTION');
        const wasteLogs = (activityRes.data || []).filter((l: any) => l.action === 'WASTE');
        log('Production activity logged', productionLogs.length > 0, `${productionLogs.length} production logs`);
        log('Waste activity logged', wasteLogs.length > 0, `${wasteLogs.length} waste logs`);
    } else {
        log('Activity endpoint works', false, JSON.stringify(activityRes));
    }

    // Analytics
    const analyticsRes = await fetchJSON(`${API}/kitchen/analytics`);
    if (analyticsRes.success) {
        log('Analytics endpoint works', true, `Total actions: ${analyticsRes.summary?.totalActions || 0}`);
    } else {
        log('Analytics endpoint works', false, JSON.stringify(analyticsRes));
    }

    // ===== SUMMARY =====
    console.log('\n' + '='.repeat(60));
    console.log('  SUMMARY');
    console.log('='.repeat(60));
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  Total: ${results.length}`);
    console.log('='.repeat(60));

    if (failed > 0) {
        console.log('\n🔴 FAILURES:');
        results.filter(r => !r.pass).forEach(r => {
            console.log(`  ❌ ${r.test}: ${r.detail}`);
        });
    }
}

main().catch(console.error);
