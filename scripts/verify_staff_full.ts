
import axios from 'axios';

const API_URL = 'http://localhost:4000/api/v1';
const TENANT_HEADER = { 'x-tenant-id': 'enigma_hq' };

async function verifyKioskFlow() {
    console.log("🔍 STARTING KIOSK & SCHEDULER VERIFICATION");
    console.log("==========================================");

    try {
        // 1. Verify PIN (Kiosk Login)
        console.log("\n1️⃣ Verifying PIN (Kiosk Login)...");
        // We need a valid employee PIN. Using '1234' as typical default or finding one.
        // First list employees to find a pin.
        const empRes = await axios.get(`${API_URL}/staff/employees`, { headers: TENANT_HEADER });
        const employees = empRes.data.employees;

        if (employees.length === 0) {
            console.error("❌ No employees found. Create one first.");
            return;
        }

        const employee = employees[0];
        console.log(`   Testing with Employee: ${employee.fullName} (PIN: ${employee.pinCode})`);

        const authRes = await axios.post(`${API_URL}/staff/auth/verify-pin`, { pin: employee.pinCode }, { headers: TENANT_HEADER });

        if (authRes.status === 200 && authRes.data.employee) {
            console.log("   ✅ Login Successful!");
        } else {
            console.error("   ❌ Login Failed");
        }

        // 2. Scheduler Autofill Test
        console.log("\n2️⃣ Testing Scheduler Autofill...");
        // Define range for next week
        const start = new Date();
        const end = new Date();
        end.setDate(end.getDate() + 7);

        console.log(`   Range: ${start.toISOString()} to ${end.toISOString()}`);

        const autofillRes = await axios.post(`${API_URL}/staff/schedules/autofill`, {
            start: start.toISOString(),
            end: end.toISOString()
        }, { headers: TENANT_HEADER });

        console.log(`   ✅ Autofill Result: Created ${autofillRes.data.created} shifts.`);

        // 3. Verify Schedules Created
        const schedRes = await axios.get(`${API_URL}/staff/schedules?start=${start.toISOString()}&end=${end.toISOString()}`, { headers: TENANT_HEADER });
        const count = schedRes.data.schedules.length;
        console.log(`   📊 Validated in DB: Found ${count} shifts.`);

        if (count > 0) {
            console.log("\n✅ SYSTEM HEALTHY: Kiosk Auth & Scheduler Logic Operational.");
        } else {
            console.log("\n⚠️ WARNING: No schedules found. Did the employee have recurring patterns?");
        }

    } catch (e) {
        console.error("\n❌ VERIFICATION FAILED");
        if (e.response) {
            console.error(`   Status: ${e.response.status}`);
            console.error(`   Data: ${JSON.stringify(e.response.data)}`);
        } else {
            console.error(`   Error: ${e.message}`);
        }
    }
}

verifyKioskFlow();
