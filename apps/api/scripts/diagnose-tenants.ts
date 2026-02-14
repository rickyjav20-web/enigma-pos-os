
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("🔍 Diagnosing Tenant Data...");

    // 1. List Tenants
    const tenants = await prisma.tenant.findMany({
        include: {
            _count: {
                select: {
                    supplyItems: true,
                    products: true,
                    employees: true
                }
            }
        }
    });

    console.log(`Found ${tenants.length} tenants:`);
    console.table(tenants.map(t => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        Items: t._count.supplyItems,
        Products: t._count.products,
        Employees: t._count.employees
    })));

    // 2. Check for Orphaned Items (No tenant or invalid tenant)
    const orphans = await prisma.supplyItem.count({
        where: {
            tenantId: { notIn: tenants.map(t => t.id) }
        }
    });
    console.log(`Orphaned Supply Items (Invalid Tenant ID): ${orphans}`);

}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
