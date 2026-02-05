const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkShifts() {
    console.log("--- Checking All Shifts (History) ---");
    const shifts = await prisma.shift.findMany({
        include: { employee: true },
        orderBy: { clockIn: 'desc' }
    });

    shifts.forEach(s => {
        console.log(`\nID: ${s.id}`);
        console.log(`Employee: ${s.employee.fullName}`);
        console.log(`IN: ${s.clockIn} | Mood: ${s.mood}`);
        console.log(`OUT: ${s.clockOut} | ExitMood: ${s.exitMood} | Comment: ${s.comments}`);
        console.log(`Photo: ${s.photoUrl ? `Base64 (Length: ${s.photoUrl.length})` : 'NULL'}`);
    });
}

checkShifts()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
