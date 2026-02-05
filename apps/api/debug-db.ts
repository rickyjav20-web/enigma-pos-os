import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

process.env.DATABASE_URL = "postgresql://admin:password123@localhost:5432/enigma_os_core?schema=public";
console.log('DB URL:', process.env.DATABASE_URL);

const prisma = new PrismaClient();
async function main() {
    console.log('Connecting to DB...');

    // 1. Get ALL Tenants
    const tenants = await prisma.tenant.findMany();
    console.log('--- ALL TENANTS ---');
    console.log(JSON.stringify(tenants, null, 2));

    // 2. Get Seeded Items using tenantId="enigma_hq"
    const trashItems = await prisma.supplyItem.findMany({
        where: { tenantId: 'enigma_hq' }
    });
    console.log(`--- TRASH ITEMS (explicit tenantId="enigma_hq") ---`);
    console.log(JSON.stringify(trashItems.map(i => ({ id: i.id, name: i.name, tid: i.tenantId })), null, 2));

    // 3. Find tenant with slug="enigma_hq"
    const targetTenant = tenants.find(t => t.slug === 'enigma_hq');
    if (targetTenant) {
        console.log(`--- FOUND TARGET TENANT (UUID: ${targetTenant.id}) ---`);

        // 4. Get items linked to UUID
        const realItems = await prisma.supplyItem.findMany({
            where: { tenantId: targetTenant.id }
        });
        console.log(`--- REAL ITEMS (Linked to UUID) ---`);
        console.log(JSON.stringify(realItems.map(i => ({ id: i.id, name: i.name, tid: i.tenantId })), null, 2));
    } else {
        console.log('--- NO TENANT FOUND WITH SLUG "enigma_hq" ---');
    }
}
main().finally(() => prisma.$disconnect());
