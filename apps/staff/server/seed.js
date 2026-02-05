const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    // 1. Create Tenant "Enigma Café"
    const tenant = await prisma.tenant.upsert({
        where: { slug: 'enigma-cafe' },
        update: {},
        create: {
            name: 'Enigma Café',
            slug: 'enigma-cafe',
        },
    });

    console.log(`Created Tenant: ${tenant.name}`);

    // 2. Create Admin Employee "Admin Enigma" (PIN: "0000")
    await prisma.employee.create({
        data: {
            tenantId: tenant.id,
            fullName: 'Admin Enigma',
            pinCode: '0000',
            role: 'ADMIN',
            status: 'active',
        },
    });

    // 3. Create Test Employees
    await prisma.employee.create({
        data: {
            tenantId: tenant.id,
            fullName: 'Barista 1',
            pinCode: '1111',
            role: 'STAFF',
            status: 'active',
        },
    });

    await prisma.employee.create({
        data: {
            tenantId: tenant.id,
            fullName: 'Cocinero 1',
            pinCode: '2222',
            role: 'STAFF',
            status: 'active',
        },
    });

    console.log('Seeding completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
