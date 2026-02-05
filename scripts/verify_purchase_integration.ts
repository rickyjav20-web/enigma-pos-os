
import axios from 'axios';
import prisma from '../apps/api/src/lib/prisma';
import { recipeService } from '../apps/api/src/services/RecipeService';

const API_URL = 'http://localhost:4000/api/v1';
const TENANT_ID = 'enigma_hq';

async function run() {
    console.log("🚀 Verifying Purchase Flow & Cost Updates...");

    // 1. Snapshot Initial State
    const flour = await prisma.supplyItem.findFirst({ where: { name: 'Sim Flour' } });
    const dough = await prisma.supplyItem.findFirst({ where: { name: 'Sim Cookie Dough' } });
    const cookie = await prisma.product.findFirst({ where: { name: 'Sim Choco Cookie' } });

    if (!flour || !dough || !cookie) throw new Error("Missing Simulated Data");

    console.log("\n📉 Initial State:");
    console.log(`   - Flour Cost: $${flour.currentCost} (Avg: $${flour.averageCost})`);
    console.log(`   - Dough Cost: $${dough.currentCost} (10kg Batch)`);
    console.log(`   - Cookie Cost: $${cookie.cost}`);

    // 2. Execute Purchase: Buy 20kg Flour @ $2.00 (Old Price $1.50)
    // New Avg Logic:
    // Current: 0 qty (assumed for sim) @ 0 avg?  Wait, sim items might have 0 stock.
    // If stock 0, Avg becomes new price.
    // Let's assume we want to see impact.

    console.log("\n💳 Creating Purchase Order (20kg Flour @ $2.00)...");
    const supplier = await prisma.supplier.findFirst({ where: { name: 'Simulated Foods Inc' } });
    if (!supplier) throw new Error("Missing Supplier");

    const poRes = await axios.post(`${API_URL}/purchases`, {
        supplierId: supplier.id,
        tenantId: TENANT_ID,
        status: 'confirmed', // Immediate confirmation
        items: [
            { supplyItemId: flour.id, quantity: 20, unitCost: 2.00 }
        ]
    });

    console.log(`✅ PO Created & Confirmed: ${poRes.data.id}`);

    // 3. Wait for Async Logic (EventBus -> RecipeService)
    console.log("⏳ Waiting for async cost propagation (3s)...");
    await new Promise(r => setTimeout(r, 3000));

    // 4. Verify Updates
    console.log("\n📈 Final State Verification:");

    const flourNew = await prisma.supplyItem.findUnique({ where: { id: flour.id } });
    const doughNew = await prisma.supplyItem.findUnique({ where: { id: dough.id } });
    const cookieNew = await prisma.product.findUnique({ where: { id: cookie.id } });

    console.log(`   - Flour New Avg: $${flourNew?.averageCost} (Last: $${flourNew?.currentCost})`);

    // Validate Flour
    // If stock was 0: Avg = 2.00.
    // If stock had value, WAC applies.
    if (Math.abs((flourNew?.averageCost || 0) - 2.00) > 0.1) {
        console.warn("⚠️ Flour Average Cost didn't update as expected (assuming 0 start stock).");
    } else {
        console.log("   ✅ Flour Cost Updated.");
    }

    // Validate Dough (Batch)
    // Old Dough (10kg): 5kg flour ($1.5) + others. total $28.5 -> unit $2.85.
    // New Dough: 5kg flour ($2.0) + others. total $31.0 -> unit $3.10.
    // Increase: $0.25 per kg (since 5kg flour diff is $2.5 total / 10kg yield = $0.25).
    console.log(`   - Dough New Cost: $${doughNew?.currentCost}`);
    if (Math.abs((doughNew?.currentCost || 0) - 3.1) < 0.2) {
        console.log("   ✅ Dough Cost Increased Correctly (Unit Cost ~$3.10).");
    } else {
        console.error(`   ❌ Dough Cost Incorrect (Expected ~$3.10, Got $${doughNew?.currentCost}).`);
    }

    // Validate Cookie (Product)
    console.log(`   - Cookie New Cost: $${cookieNew?.cost}`);
    if ((cookieNew?.cost || 0) > (cookie.cost || 0)) {
        console.log("   ✅ Product Cost Increased (Double Ripple Logic Works).");
    } else {
        console.error("   ❌ Product Cost DID NOT Increase.");
    }
}

run().catch(console.error);
