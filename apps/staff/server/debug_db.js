const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
    console.log("--- Checking Tenants ---");
    const tenants = await prisma.tenant.findMany();
    console.log(tenants);

    console.log("\n--- Checking Employees ---");
    const employees = await prisma.employee.findMany();
    console.log(employees);
}

checkData()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
