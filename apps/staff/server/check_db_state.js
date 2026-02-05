const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- DB CHECK ---');
    const tenants = await prisma.tenant.findMany();
    console.log('Tenants:', JSON.stringify(tenants, null, 2));

    const employees = await prisma.employee.findMany();
    console.log('Employees:', JSON.stringify(employees, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
