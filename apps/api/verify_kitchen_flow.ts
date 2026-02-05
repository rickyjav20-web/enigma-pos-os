
import { PrismaClient } from '@prisma/client';
import { productIngestService } from './src/services/ProductIngestService';
import { recipeService } from './src/services/RecipeService';

const prisma = new PrismaClient();

async function main() {
    console.log("🧪 Starting Kitchen Hierarchy Verification...");

    // 1. Setup Tenant
    const tenantId = "verify-kitchen-tenant";
    await prisma.productRecipe.deleteMany({ where: { product: { tenantId } } });
    await prisma.productionRecipe.deleteMany({ where: { parent: { tenantId } } });
    await prisma.product.deleteMany({ where: { tenantId } });
    await prisma.supplyItem.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });

    await prisma.tenant.create({ data: { id: tenantId, name: "Kitchen Test", slug: "kitchen-test" } });

    // 2. CSV Content (Mocking the Brownie chain)
    // Structure: 
    // - Harina (Raw)
    // - Bandeja Brownie (Batch, uses Harina) -> Category: Preparados
    // - Brownie (Sub-Product/Portion, uses Bandeja)
    // - Brownie con Helado (Product, uses Brownie)
    const csvContent = `
Handle,Nombre,REF,Categoria,Precio [Enigma Café ],Coste,REF del componente,Cantidad del componente
harina,Harina,ING-HAR,Secos,0,10.00,,
huevos,Huevos,ING-HUE,Frescos,0,0.50,,
bandeja-brownie,Bandeja Brownie,PREP-BANDEJA,Preparados,0,0,ING-HAR,0.500
,,,,,,ING-HUE,4.000
brownie-porcion,Brownie Porcion,PROD-BROWNIE,Postres,3.00,0,PREP-BANDEJA,0.083
brownie-helado,Brownie con Helado,PROD-BROWNIE-HELADO,Postres,5.00,0,PROD-BROWNIE,1.000
    `.trim();

    // 3. Ingest
    console.log("📥 Ingesting CSV...");
    const result = await productIngestService.ingestLoyverseExport(csvContent, tenantId);
    console.log("✅ Ingest Result:", result);

    // 4. Verify Hierarchy & Costs
    // A. Check Raw Items
    const flour = await prisma.supplyItem.findUnique({ where: { tenantId_sku: { tenantId, sku: 'ING-HAR' } } });
    console.log(`Resource: Flour Cost = ${flour?.currentCost} (Expected 10)`);

    // B. Check Batch (Bandeja)
    const bandeja = await prisma.supplyItem.findUnique({
        where: { tenantId_sku: { tenantId, sku: 'PREP-BANDEJA' } },
        include: { ingredients: true }
    });
    console.log(`Batch: Bandeja isProduction = ${bandeja?.isProduction}`);
    console.log(`Batch: Bandeja Cost = ${bandeja?.currentCost}`);
    // Expected Cost: (0.5 * 10) + (4 * 0.5) = 5 + 2 = 7.00
    // Note: Cost might be 0 initially if ingest doesn't auto-calc recursive.

    // TRIGGER RECALC (Ingest handles ingestion, but maybe not full recursive calc triggered automatically?)
    // Let's force a recalc to be sure
    await recipeService.recalculateSupplyItemCost(bandeja!.id);
    const bandejaUpdated = await prisma.supplyItem.findUnique({ where: { id: bandeja!.id } });
    console.log(`Batch: Bandeja Cost (After Recalc) = ${bandejaUpdated?.currentCost} (Expected 7.00)`);

    // C. Check Sub-Product (Brownie Portion)
    // It consumes 0.083 of Bandeja (7.00) => ~0.58
    // Wait, Brownie Porcion is Sold ($3.00) -> It is a Product. 
    // But does it use 'Bandeja' (SupplyItem) or is it a SupplyItem itself?
    // In CSV: `brownie-porcion` has `PROD-BROWNIE`. 
    // It depends on how Ingest parsed it. It has Price > 0, so it's a Product.
    // It uses `PREP-BANDEJA` (SupplyItem).
    const brownieProd = await prisma.product.findFirst({ where: { tenantId, sku: 'PROD-BROWNIE' } });
    await recipeService.recalculateProductCost(brownieProd!.id);
    const brownieUpdated = await prisma.product.findUnique({ where: { id: brownieProd!.id } });
    console.log(`Product: Brownie Portion Cost = ${brownieUpdated?.cost} (Expected ~0.58)`);

    // D. Check Final Product (Brownie with Ice Cream)
    // Uses Brownie Portion (Product? No, ProductRecipe can link to SupplyItem).
    // Wait. `Brownie con Helado` links to `PROD-BROWNIE`.
    // If `PROD-BROWNIE` is a Product, we CANNOT link it in `ProductRecipe` (Logic constraint: ProductRecipe links Product -> SupplyItem).
    // THIS IS A FINDING.
    // Loyverse allows Product -> Product.
    // My Schema allows Product -> SupplyItem.
    // CORRECTION: `PROD-BROWNIE` must ALSO exist as a `SupplyItem` if it is used as an ingredient.
    // My Ingest logic creates SupplyItem for EVERYTHING that has an SKU.
    // So `PROD-BROWNIE` should exist as SupplyItem too.

    const brownieSupply = await prisma.supplyItem.findUnique({ where: { tenantId_sku: { tenantId, sku: 'PROD-BROWNIE' } } });
    console.log(`SupplyItem: Brownie Portion Exists? ${!!brownieSupply}`);

    // We need to ensure that when `Brownie Portion` (Product) updates its cost, `Brownie Portion` (SupplyItem) ALSO updates its cost?
    // Or simpler: `Brownie Portion` is JUST a SupplyItem that happens to be sold (Product table entry is just for POS/Price).
    // The Recipe uses the SupplyItem version.
    // Cost of SupplyItem 'PROD-BROWNIE' needs to be calculated.
    // Does 'PROD-BROWNIE' have a ProductionRecipe?
    // In CSV: `brownie-porcion` uses `PREP-BANDEJA`.
    // Ingest Logic: 
    // - Parent: brownie-porcion (Price > 0 -> Product).
    // - Parent is also created as SupplyItem.
    // - Link: ProductionRecipe (SupplyItem -> SupplyItem) OR ProductRecipe (Product -> SupplyItem).
    // - If we want hierarchy, we need SupplyItem -> SupplyItem.

    // Let's see what happened.
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
