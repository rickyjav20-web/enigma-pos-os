
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking Database Stats ---');

    // Check all tenants
    const tenants = await prisma.supplier.groupBy({
        by: ['tenantId'],
    });
    console.log('Active Tenants (via Suppliers):', tenants.map(t => t.tenantId));

    const productCount = await prisma.product.count();
    const supplyItemCount = await prisma.supplyItem.count();
    const supplierCount = await prisma.supplier.count();
    const recipeCount = await prisma.recipe.count();

    console.log(`Total Products: ${productCount}`);
    console.log(`Total SupplyItems: ${supplyItemCount}`);
    console.log(`Total Suppliers: ${supplierCount}`);
    console.log(`Total Recipes: ${recipeCount}`);

    // Check specifically for 'enigma_hq'
    const hqProducts = await prisma.product.count({ where: { tenantId: 'enigma_hq' } });
    console.log(`Products in 'enigma_hq': ${hqProducts}`);

    // Check for 'Reposteria B.O' supplier
    const supplier = await prisma.supplier.findFirst({
        where: { name: { contains: 'Reposteria' } }
    });
    console.log('Found Supplier "Reposteria"?', supplier ? `Yes (ID: ${supplier.id})` : 'No');

    if (supplier) {
        const itemsLinked = await prisma.supplyItem.count({ where: { preferredSupplierId: supplier.id } });
        console.log(`Items linked to "Reposteria": ${itemsLinked}`);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
