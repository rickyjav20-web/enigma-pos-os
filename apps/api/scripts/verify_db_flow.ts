
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("🔍 1. STARTING DATABASE VERIFICATION");
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);

    // Test Data
    const testName = `Test_Supplier_${Date.now()}`;

    // 1. PRE-REQ: Ensure Tenant Exists
    const tenantId = 'enigma_hq_test';
    await prisma.tenant.upsert({
        where: { slug: tenantId },
        update: {},
        create: {
            id: tenantId,
            name: 'Test HQ',
            slug: tenantId
        }
    });

    // 2. WRITE
    console.log("\n📝 2. ATTEMPTING WRITE (Create Supplier)");
    const start = Date.now();
    const created = await prisma.supplier.create({
        data: {
            name: testName,
            tenantId: tenantId,
            category: 'TEST_FLOW'
        }
    });
    const end = Date.now();
    console.log(`✅ WRITE SUCCESS in ${end - start}ms`);
    console.log(`   - ID: ${created.id}`);
    console.log(`   - Name: ${created.name}`);
    console.log(`   - Tenant: ${created.tenantId}`);

    // 2. READ (Validation)
    console.log("\n📖 3. ATTEMPTING READ (Verify Persistence)");
    const read = await prisma.supplier.findUnique({
        where: { id: created.id }
    });

    if (read && read.name === testName) {
        console.log(`✅ READ SUCCESS`);
        console.log(`   - Match: TRUE`);
        console.log(`   - Value: ${read.name}`);
    } else {
        console.error(`❌ READ FAILED or MISMATCH`);
        console.error(`   - Expected: ${testName}`);
        console.error(`   - Actual: ${read?.name}`);
    }

    // 3. CLEANUP
    console.log("\n🧹 4. CLEANUP");
    await prisma.supplier.delete({ where: { id: created.id } });
    console.log("✅ Test Record Deleted");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
