
const API_URL = 'http://localhost:4000/api/v1';
const TENANT_ID = 'enigma_hq';

async function verifyStaff() {
    console.log('🕵️‍♂️ VERIFYING STAFF API ENDPOINTS...');

    try {
        // 1. LIST EMPLOYEES
        // Path: /api/v1/employees (Previously /api/v1/staff/employees)
        console.log('\n[1] GET /employees');
        const listRes = await fetch(`${API_URL}/employees`, {
            headers: { 'x-tenant-id': TENANT_ID }
        });

        if (!listRes.ok) throw new Error(`List failed: ${listRes.status} ${await listRes.text()}`);

        const listData = await listRes.json();
        const employees = listData.employees || listData;
        console.log(`✅ Success. Found ${employees.length} employees.`);
        employees.forEach(e => console.log(`   - ${e.fullName} (PIN: ${e.pinCode})`));

        // 2. VERIFY PIN
        // Path: /api/v1/auth/verify-pin (Previously /api/v1/staff/auth/verify-pin)
        console.log('\n[2] POST /auth/verify-pin (PIN: 1234)');
        const authRes = await fetch(`${API_URL}/auth/verify-pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
            body: JSON.stringify({ pin: '1234' })
        });

        if (!authRes.ok) throw new Error(`Auth failed: ${authRes.status} ${await authRes.text()}`);
        const authData = await authRes.json();
        console.log(`✅ Auth Success. Logged in as: ${authData.employee.fullName}`);

        console.log('\n🎉 ALL CHECKS PASSED. Backend is ready.');

    } catch (e) {
        console.error('❌ VERIFICATION FAILED:', e);
    }
}

verifyStaff();
