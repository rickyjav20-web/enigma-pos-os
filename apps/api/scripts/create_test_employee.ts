
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Creating test employee...");

    // Check if tenant exists, create if not
    let tenant = await prisma.tenant.findUnique({
        where: { slug: 'enigma_hq' }
    });

    if (!tenant) {
        console.log("Creating default tenant...");
        tenant = await prisma.tenant.create({
            data: {
                name: "Enigma HQ",
                slug: "enigma_hq"
            }
        });
    }

    // Create Employee
    const employee = await prisma.employee.create({
        data: {
            tenantId: tenant.id,
            fullName: "Cajero Test",
            role: "cashier",
            pinCode: "1234",
            email: "cajero@test.com",
            status: "active"
        }
    });

    console.log(`✅ Created Employee: ${employee.fullName} (PIN: ${employee.pinCode})`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
