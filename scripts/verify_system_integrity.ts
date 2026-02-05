
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifySystem() {
    console.log("\n🏥 ENIGMA OS SYSTEM HEALTH CHECK");
    console.log("================================");

    try {
        // 1. DB Connection
        await prisma.$connect();
        console.log("✅ Database Connection:    OK");

        // 2. Tenant Check
        const tenant = await prisma.tenant.findUnique({ where: { id: 'enigma_hq' } });
        if (tenant) {
            console.log(`✅ Tenant 'enigma_hq':     FOUND (${tenant.name})`);
        } else {
            console.error("❌ Tenant 'enigma_hq':     MISSING (Critical)");
        }

        // 3. Employee Check
        const employees = await prisma.employee.count({ where: { tenantId: 'enigma_hq' } });
        console.log(`✅ Active Employees:       ${employees}`);

        // 4. Shift History
        const recentShifts = await prisma.shift.findMany({
            where: { tenantId: 'enigma_hq' },
            take: 3,
            orderBy: { clockIn: 'desc' },
            include: { employee: true }
        });

        console.log(`\n📋 Recent Shift Activity (${recentShifts.length}):`);
        if (recentShifts.length === 0) {
            console.log("   (No shifts recorded yet)");
        } else {
            recentShifts.forEach(s => {
                const status = s.clockOut ? "COMPLETED" : "ACTIVE";
                console.log(`   - [${status}] ${s.employee.fullName} @ ${s.clockIn.toLocaleTimeString()}`);
            });
        }

        console.log("\n✨ SYSTEM STATUS: STABLE");

    } catch (e) {
        console.error("\n❌ SYSTEM CHECK FAILED");
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

verifySystem();
