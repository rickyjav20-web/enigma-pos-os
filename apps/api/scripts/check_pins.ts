
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("🔍 Checking for employees in local database...");

    const employees = await prisma.employee.findMany({
        select: {
            fullName: true,
            pinCode: true,
            role: true,
            status: true
        }
    });

    if (employees.length === 0) {
        console.log("❌ No employees found in the database.");
    } else {
        console.table(employees);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
