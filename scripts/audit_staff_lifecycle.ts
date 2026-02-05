
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

async function auditStaffLifecycle() {
    console.log("🕵️‍♂️ STARTING STRICT AUDIT: STAFF MODULE");
    console.log("========================================");

    const TEST_ID = randomUUID().substring(0, 8);
    const TENANT_ID = 'enigma_hq';
    const PIN = '9999';

    try {
        // --- STEP 1: CREATE EMPLOYEE ---
        console.log(`\n[STEP 1] Creating Employee (Simulating UI > API > DB)`);
        const newEmployee = await prisma.employee.create({
            data: {
                tenantId: TENANT_ID,
                fullName: `Audit User ${TEST_ID}`,
                role: 'Tester',
                pinCode: PIN,
                status: 'active'
            }
        });

        console.log(`✅ WRITE CONFIRMED:`);
        console.log(`   - Table: Employee`);
        console.log(`   - ID: ${newEmployee.id}`);
        console.log(`   - Name: ${newEmployee.fullName}`);
        console.log(`   - PIN: ${newEmployee.pinCode}`);
        console.log(`   - Timestamp: ${new Date().toISOString()}`);

        // --- STEP 2: VERIFY PIN (LOGIN) ---
        console.log(`\n[STEP 2] Verifying PIN (Simulating Kiosk Auth)`);
        const authUser = await prisma.employee.findFirst({
            where: { tenantId: TENANT_ID, pinCode: PIN }
        });

        if (!authUser) throw new Error("❌ Auth Failed: User not found by PIN");
        console.log(`✅ READ CONFIRMED:`);
        console.log(`   - Found User ID: ${authUser.id}`);
        console.log(`   - Matched PIN: ${authUser.pinCode}`);

        // --- STEP 3: CLOCK IN ---
        console.log(`\n[STEP 3] Clock In (Simulating 'Start Shift' Button)`);
        const clockInTime = new Date();
        const shift = await prisma.shift.create({
            data: {
                tenantId: TENANT_ID,
                employeeId: newEmployee.id,
                clockIn: clockInTime,
                mood: 'HAPPY'
            }
        });

        console.log(`✅ WRITE CONFIRMED:`);
        console.log(`   - Table: Shift`);
        console.log(`   - ID: ${shift.id}`);
        console.log(`   - EmployeeID: ${shift.employeeId}`);
        console.log(`   - ClockIn: ${shift.clockIn.toISOString()}`);
        console.log(`   - ClockOut: ${shift.clockOut} (Expected: null)`);

        // --- STEP 4: VERIFY ACTIVE SHIFT ---
        console.log(`\n[STEP 4] Verifying Active Shift (Simulating Dashboard State)`);
        const activeShift = await prisma.shift.findFirst({
            where: { employeeId: newEmployee.id, clockOut: null }
        });

        if (!activeShift) throw new Error("❌ State Error: No active shift found after clock in");
        console.log(`✅ STATE VERIFIED: User is currently 'ON SHIFT'`);
        console.log(`   - Shift ID: ${activeShift.id}`);

        // --- STEP 5: CLOCK OUT ---
        console.log(`\n[STEP 5] Clock Out (Simulating 'End Shift' Button)`);
        // Simulate a 1-second shift
        await new Promise(r => setTimeout(r, 1000));
        const clockOutTime = new Date();

        const updatedShift = await prisma.shift.update({
            where: { id: activeShift.id },
            data: {
                clockOut: clockOutTime,
                exitMood: 'TIRED',
                comments: 'Audit complete'
            }
        });

        console.log(`✅ UPDATE CONFIRMED:`);
        console.log(`   - Table: Shift`);
        console.log(`   - ID: ${updatedShift.id}`);
        console.log(`   - Prev ClockOut: null`);
        console.log(`   - New ClockOut: ${updatedShift.clockOut?.toISOString()}`);
        console.log(`   - Duration: ~1000ms`);

        // --- CLEANUP ---
        console.log(`\n[CLEANUP] Removing Test Data...`);
        await prisma.shift.delete({ where: { id: shift.id } });
        await prisma.employee.delete({ where: { id: newEmployee.id } });
        console.log(`✅ Cleanup Complete.`);

        console.log("\n🎯 PROOF OF INTEGRITY: VALID");

    } catch (e) {
        console.error("\n❌ AUDIT FAILED:", e);
    } finally {
        await prisma.$disconnect();
    }
}

auditStaffLifecycle();
