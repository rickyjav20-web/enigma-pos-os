
const API_URL = 'http://localhost:4000/api/v1';

async function listEmployees() {
    console.log('🔍 SCANNING FOR EMPLOYEES...');

    // Check default tenant 'enigma_hq'
    console.log('\n--- Checking Tenant: enigma_hq ---');
    try {
        const res = await fetch(`${API_URL}/employees`, {
            headers: { 'x-tenant-id': 'enigma_hq' }
        });
        if (res.ok) {
            const json = await res.json();
            const users = json.employees || json;
            console.log(`count: ${users.length}`);
            users.forEach(u => console.log(` - [${u.id}] ${u.fullName} (PIN: ${u.pinCode}) (Tenant: ${u.tenantId})`));
        } else {
            console.log(`❌ Error: ${res.status} ${await res.text()}`);
        }
    } catch (e) {
        console.log('❌ Failed to connect:', e.message);
    }
}

listEmployees();
