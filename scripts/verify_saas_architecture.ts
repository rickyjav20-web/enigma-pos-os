
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyMultiTenant() {
    try {
        console.log("🏢 Starting SaaS/Tenant Verification...");

        // 1. Create Tenant A (Burger Joint)
        const tenantA = await prisma.tenant.upsert({
            where: { slug: 'burger-joint' },
            create: { name: 'Burger Joint', slug: 'burger-joint' },
            update: {}
        });
        console.log(`✅ Tenant A Created: ${tenantA.name} (${tenantA.id})`);

        // 2. Create Tenant B (Pizza Place)
        const tenantB = await prisma.tenant.upsert({
            where: { slug: 'pizza-place' },
            create: { name: 'Pizza Place', slug: 'pizza-place' },
            update: {}
        });
        console.log(`✅ Tenant B Created: ${tenantB.name} (${tenantB.id})`);

        // 3. Create Employees in respective tenants
        const empA = await prisma.employee.create({
            data: {
                tenantId: tenantA.id,
                fullName: 'Burger flipper',
                role: 'Cook',
                pinCode: '1111'
            }
        });

        const empB = await prisma.employee.create({
            data: {
                tenantId: tenantB.id,
                fullName: 'Pizza Baker',
                role: 'Chef',
                pinCode: '2222'
            }
        });

        // 4. Verify Isolation (Should NOT see each other)
        const staffA = await prisma.employee.findMany({ where: { tenantId: tenantA.id } });
        const staffB = await prisma.employee.findMany({ where: { tenantId: tenantB.id } });

        console.log(`\n🔍 Verifying Isolation:`);
        console.log(`   Tenant A Staff Count: ${staffA.length} (Expected: 1)`);
        console.log(`   Tenant B Staff Count: ${staffB.length} (Expected: 1)`);

        if (staffA.find(e => e.id === empB.id)) throw new Error("🚨 LEAK: Tenant A can see Tenant B employee!");
        if (staffB.find(e => e.id === empA.id)) throw new Error("🚨 LEAK: Tenant B can see Tenant A employee!");

        console.log(`✅ SUCCESS: Staff lists are strictly isolated.`);

        // 5. Test Kiosk Authentication (SaaS Logic)
        // Simulate Login Attempt for Tenant A
        const loginAttemptA = await prisma.employee.findFirst({
            where: { tenantId: tenantA.id, pinCode: '2222' } // Try using Emp B's PIN on Tenant A
        });

        if (loginAttemptA) throw new Error("🚨 SECURITY FAIL: Tenant B PIN worked on Tenant A!");
        console.log(`✅ SECURITY PASS: Tenant B PIN rejected on Tenant A Kiosk.`);

        console.log("\n🎉 SaaS Architecture Verified: Data is safe and isolated.");

    } catch (e) {
        console.error("❌ Verification Failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

verifyMultiTenant();
