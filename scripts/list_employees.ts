
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listEmployees() {
    try {
        console.log("🕵️‍♂️ LISTING EMPLOYEES & PINS");
        console.log("============================");

        const employees = await prisma.employee.findMany({
            select: {
                id: true,
                fullName: true,
                pinCode: true,
                role: true,
                tenantId: true
            }
        });

        if (employees.length === 0) {
            console.log("❌ No employees found!");
        } else {
            console.table(employees);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

listEmployees();
