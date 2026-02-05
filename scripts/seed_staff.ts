
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedStaff() {
    try {
        console.log("Starting Staff Seed...");

        // Ensure Tenant Exists
        const tenantId = 'enigma_hq';
        const tenant = await prisma.tenant.upsert({
            where: { id: tenantId },
            update: {},
            create: {
                id: tenantId,
                name: 'Enigma HQ',
                slug: 'enigma-hq'
            }
        });
        console.log(`Tenant verified: ${tenant.name}`);

        // Create Admin Employee
        const admin = await prisma.employee.create({
            data: {
                tenantId: tenantId,
                fullName: 'Admin User',
                role: 'Manager',
                pinCode: '1234',
                status: 'active',
                email: 'admin@enigma.com',
                salaryType: 'fixed',
                currency: 'USD'
            }
        });
        console.log(`Created Admin: ${admin.fullName} (PIN: 1234)`);

        // Create Staff Employee
        const staff = await prisma.employee.create({
            data: {
                tenantId: tenantId,
                fullName: 'John Barista',
                role: 'Barista',
                pinCode: '0000',
                status: 'active',
                email: 'john@enigma.com',
                salaryType: 'hourly',
                currency: 'USD'
            }
        });
        console.log(`Created Staff: ${staff.fullName} (PIN: 0000)`);

    } catch (e) {
        console.error("Error seeding staff:", e);
    } finally {
        await prisma.$disconnect();
    }
}

seedStaff();
