
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listTenants() {
    try {
        console.log("🕵️‍♂️ LISTING TENANTS");
        console.log("====================");

        const tenants = await prisma.tenant.findMany();

        if (tenants.length === 0) {
            console.log("❌ No tenants found!");
        } else {
            console.table(tenants);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

listTenants();
