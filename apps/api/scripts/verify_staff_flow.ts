
import axios from 'axios';

const API_URL = 'http://localhost:4000/api/v1';

async function runStaffAudit() {
    console.log("🕵️ STARTING STAFF MODULE AUDIT");
    const timestamp = Date.now();
    const pin = '9999'; // Test PIN

    try {
        // 1. Create Employee
        const url = `${API_URL}/staff/employees`;
        console.log("\n👤 1. Creating Test Employee...", url);
        const empRes = await axios.post(url, {
            fullName: `Audit User_${timestamp}`,
            pinCode: pin,
            role: 'server',
            // hourlyRate removed (not in schema or optional)
            tenantId: 'enigma_hq_test'
        });
        const employee = empRes.data.employee; // API returns { employee: ... } wrapper? Check controller.
        // Controller (line 231) returns { employee }. Script previously expected direct object.
        console.log(`   ✅ Created: ${employee.fullName}`);
        console.log(`   🔑 ID: ${employee.id}`);
        console.log(`   🔢 PIN: ${pin}`);

        // 2. Auth (Login)
        console.log("\n🔐 2. Testing Authentication (PIN Login)...");
        const authRes = await axios.post(`${API_URL}/staff/auth/verify-pin`, {
            pin: pin,
            tenantId: 'enigma_hq_test'
        });

        // Controller returns { employee, activeShift }
        if (authRes.data.employee) {
            console.log(`   ✅ Auth Successful. User verified.`);
        } else {
            throw new Error("Auth Failed");
        }

        // 3. Start Shift (Clock In)
        console.log("\n⏰ 3. Clocking In...");
        const startRes = await axios.post(`${API_URL}/staff/shifts/clock-in`, {
            employeeId: employee.id,
            tenantId: 'enigma_hq_test'
        });
        const shift = startRes.data.shift;
        console.log(`   ✅ Shift Started`);
        console.log(`   🆔 Shift ID: ${shift.id}`);
        console.log(`   🕒 Start Time: ${shift.clockIn}`);

        // 4. End Shift (Clock Out)
        console.log("\n🏁 4. Clocking Out...");
        const endRes = await axios.post(`${API_URL}/staff/shifts/clock-out`, {
            employeeId: employee.id,
            tenantId: 'enigma_hq_test'
        });
        const closedShift = endRes.data.shift;
        console.log(`   ✅ Shift Ended`);
        console.log(`   🕒 End Time: ${closedShift.clockOut}`);

        // 5. Verify History
        console.log("\n📜 5. Verifying History Log...");
        const historyRes = await axios.get(`${API_URL}/staff/shifts/history?employeeId=${employee.id}&tenantId=enigma_hq_test`);
        // API returns { shifts: [] }
        const found = historyRes.data.shifts.find((s: any) => s.id === shift.id);

        if (found) {
            console.log(`   ✅ Evidence: Shift ${found.id} found in history.`);
            console.log(`   ⏱️ Duration: ${found.durationMinutes || 'N/A'} mins`);
        } else {
            console.error(`   ❌ FAILURE: Shift not found in history.`);
            process.exit(1);
        }

    } catch (error: any) {
        console.error("❌ AUDIT FAILED:", error.response ? error.response.data : error.message);
        process.exit(1);
    }
}

runStaffAudit();
