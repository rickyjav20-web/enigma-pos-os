
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding Enigma Cafe Tenant...');

    // 1. Create the Tenant
    const tenantSlug = 'enigma_cafe';
    let tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });

    if (!tenant) {
        tenant = await prisma.tenant.create({
            data: {
                name: 'Enigma Cafe',
                slug: tenantSlug,
            }
        });
        console.log(`✅ Tenant Created: ${tenant.name} (${tenant.id})`);
    } else {
        console.log(`ℹ️ Tenant already exists: ${tenant.name}`);
    }

    // 2. Create the Admin User (Employee with 'ADMIN' role)
    // Note: Your schema uses 'Employee' for login in your Staff module logic.
    // We need to ensure we have a login mechanism (Email/Pin).
    // Schema check: Employee has 'email' and 'pinCode'. Does it have Password?
    // Let's check Schema... user login might be via PIN or we need a proper User table separate from Employee.
    // Assuming 'Employee' is the user for now based on Staff App logic. Or is there a 'User' model? 
    // Checking schema... just Employee. We will use a dedicated PIN or add Password field later.

    const adminEmail = 'admin@enigmacafe.com';
    const existingUser = await prisma.employee.findFirst({
        where: {
            tenantId: tenant.id,
            email: adminEmail
        }
    });

    if (!existingUser) {
        await prisma.employee.create({
            data: {
                tenantId: tenant.id,
                fullName: 'Ricky Admin',
                role: 'OWNER', // Super Role
                pinCode: '0000', // Default PIN
                email: adminEmail,
                status: 'active'
            }
        });
        console.log(`✅ Admin User Created: ${adminEmail} / PIN: 0000`);
    } else {
        console.log(`ℹ️ Admin User already exists.`);
    }

}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
