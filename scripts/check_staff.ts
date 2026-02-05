
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStaff() {
    try {
        const employees = await prisma.employee.findMany();
        console.log(`Found ${employees.length} employees.`);
        console.log(JSON.stringify(employees, null, 2));
    } catch (e) {
        console.error("Error fetching employees:", e);
    } finally {
        await prisma.$disconnect();
    }
}

checkStaff();
