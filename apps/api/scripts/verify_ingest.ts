// @ts-nocheck
import { productIngestService } from '../src/services/ProductIngestService';
import prisma from '../src/lib/prisma';
import fs from 'fs';
import path from 'path';

async function verifyIngest() {
    console.log("🧪 STARTING FULL INGEST VERIFICATION (Target: enigma_hq)");
    const tenantId = 'enigma_hq';

    // 0. Ensure Tenant Exists
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
        await prisma.tenant.create({
            data: {
                id: tenantId,
                name: "Enigma HQ (Main)",
                slug: "enigma-hq"
            }
        });
        console.log(`0️⃣ Seeded Tenant: ${tenantId}`);
    }

    // 1. Load the REAL CSV file content
    const csvPath = '/Users/rickyjav/Desktop/Enigma_OS_V2/Loyverse_Ajuste_Enigma_Cafe/CSV_EDITADO/export_items_ESTANDARIZADO.csv';
    const csvContent = fs.readFileSync(csvPath, 'utf-8');

    console.log(`1️⃣ Loaded CSV (${csvContent.length} bytes).`);

    // 2. Run Ingest
    console.log("2️⃣ Running ProductIngestService...");
    const result = await productIngestService.ingestLoyverseExport(csvContent, tenantId);
    console.log("   -> Ingest Result:", result);

    // 3. Verify Ingredients (SupplyItems)
    const ingredients = await prisma.supplyItem.findMany({ where: { tenantId } });
    console.log(`   -> Found ${ingredients.length} SupplyItems created.`);

    // Check specific known ingredient: "Carne" or similar from CSV
    // Line 503: Tequeños, Ref 10037? Wait, let's look at a component.
    // Line 600: Vinagre Balsamico.
    // Let's check "10168" which is "Pan de Panini" or similar seen in CSV.
    // CSV Line 392: Component 10168 used in Panini.
    // CSV Line 385: Pan de Bagel? No let's check the SupplyItem itself.

    const sampleIngredient = await prisma.supplyItem.findFirst({ where: { tenantId, sku: '10168' } });
    if (sampleIngredient) {
        console.log(`   ✅ Verified Ingredient: ${sampleIngredient.name} (SKU: 10168) Cost: ${sampleIngredient.currentCost}`);
    } else {
        console.warn(`   ⚠️ Warning: Ingredient 10168 not found (might be named differently).`);
    }

    // 4. Verify Product (Parent)
    // "Panini - Amanecer" (Handle: panini-amanecer)
    // It should be linked to ingredient 10168 (Qty 2.000)
    // Find Product by Name or partial match
    // Product ID is UUID, so we search by Name? "Panini – Amanecer"

    // Wait, the ProductIngestService upserts Product by SKU.
    // CSV Line 388: REF 10195? No, REF for Panini Amanecer is missing in line 388?
    // Line 388: Handle: panini-amanecer, REF: PAN-005.
    const product = await prisma.product.findFirst({
        where: { tenantId, name: 'Panini – Amanecer' },
        include: { recipes: { include: { supplyItem: true } } }
    });

    if (product) {
        console.log(`   ✅ Verified Product: ${product.name} (Cost: ${product.cost})`);

        const pStr = product as any; // Bypass TS check for new relation
        console.log(`      Recipes: ${pStr.recipes.length} ingredients linked.`);

        pStr.recipes.forEach((r: any) => {
            console.log(`      - ${r.quantity} x ${r.supplyItem?.name} (SKU: ${r.supplyItem?.sku})`);
        });

        if (pStr.recipes.length > 0) {
            console.log("   ✅ SUCCESS: Recipes linked correctly!");
        } else {
            console.error("   ❌ FAILURE: No recipes linked.");
        }
    } else {
        console.error("   ❌ FAILURE: Product 'Panini – Amanecer' not found.");
    }
}

verifyIngest().catch(e => {
    console.error(e);
    process.exit(1);
});
