
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const tenantSlug = 'enigma-cafe';
    const existing = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });

    if (!existing) {
        console.log(`Creating default tenant: ${tenantSlug}`);
        await prisma.tenant.create({
            data: {
                name: 'Enigma Café',
                slug: tenantSlug
            }
        });
    } else {
        console.log(`Tenant ${tenantSlug} already exists.`);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
