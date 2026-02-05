
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createHqTenant() {
    try {
        console.log("🛠️ CREATING ENIGMA HQ TENANT");
        console.log("============================");

        // Check if it exists first (to be safe)
        const existing = await prisma.tenant.findUnique({
            where: { id: 'enigma_hq' }
        });

        if (existing) {
            console.log("✅ Tenant 'enigma_hq' already exists.");
            return;
        }

        const tenant = await prisma.tenant.create({
            data: {
                id: 'enigma_hq',
                name: 'Enigma HQ',
                slug: 'enigma_hq',
                // Add required fields if any. Assuming defaults handling.
            }
        });

        console.log(`✅ Created Tenant: ${tenant.name} (${tenant.id})`);

    } catch (e) {
        console.error("❌ Failed to create tenant:", e);
    } finally {
        await prisma.$disconnect();
    }
}

createHqTenant();
