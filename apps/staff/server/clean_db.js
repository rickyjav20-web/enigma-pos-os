const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- CLEANING DB ---');
    // Delete in order of constraints
    await prisma.document.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.shift.deleteMany({});
    await prisma.recurringSchedule.deleteMany({});
    await prisma.schedule.deleteMany({});

    // Delete Employees
    await prisma.employee.deleteMany({});

    // Delete Tenants? Maybe keep to avoid ID shift if external consistency needed, 
    // but seed.js upserts tenant. Let's keep tenant to be safe, or delete if we want total reset.
    // Given the seed uses upsert on slug, keeping it is fine.

    console.log('Cleaned: Documents, Payments, Shifts, Recurring, Schedules, Employees.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
