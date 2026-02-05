
import { PrismaClient } from '@prisma/client';
import { productIngestService } from './src/services/ProductIngestService';
import { recipeService } from './src/services/RecipeService';

const prisma = new PrismaClient();

async function main() {
    console.log("Creating Test Data for Enigma HQ...");
    const tenantId = "enigma_hq"; // The main tenant used by Frontend

    // Ensure Tenant Exists
    await prisma.tenant.upsert({
        where: { id: tenantId },
        update: {},
        create: { id: tenantId, name: "Enigma HQ", slug: "enigma-hq" }
    });
    // Clean up previous test data if any (Optional: careful not to wipe real data if user has it, but they are in dev mode)
    // Asking user logic: "Ensure items can exist... without connections".
    // I will upsert data instead of delete.

    const csvContent = `
Handle,Nombre,REF,Categoria,Precio [Enigma Café ],Coste,REF del componente,Cantidad del componente
harina-trigo,Harina de Trigo,ING-HAR-001,Secos,0,1.50,,
azucar,Azucar Blanca,ING-AZU-001,Secos,0,1.20,,
huevos,Huevos,ING-HUE-001,Frescos,0,0.30,,
masa-brownie,Masa de Brownie (Batch),PREP-MASA-001,Preparados,0,0,ING-HAR-001,0.500
,,,,,,ING-AZU-001,0.300
,,,,,,ING-HUE-001,4.000
brownie-std,Brownie Standard,PROD-BR-001,Postres,3.50,0,PREP-MASA-001,0.100
    `.trim();

    await productIngestService.ingestLoyverseExport(csvContent, tenantId);

    // Force Recalc for the batch
    const batch = await prisma.supplyItem.findUnique({ where: { tenantId_sku: { tenantId, sku: 'PREP-MASA-001' } } });
    if (batch) {
        await recipeService.recalculateSupplyItemCost(batch.id);
        console.log("Recalculated Batch Cost");
    }

    console.log("Done.");
}

main().finally(() => prisma.$disconnect());
