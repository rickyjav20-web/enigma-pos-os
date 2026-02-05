
import axios from 'axios';

async function debugReadFlow() {
    console.log("🔍 STARTING READ PATH DEBUGGING");
    console.log("===============================");
    console.log("Target: http://localhost:4000/api/v1/staff/shifts/history");
    console.log("Tenant Header: 'enigma_hq'");

    try {
        const res = await axios.get('http://localhost:4000/api/v1/staff/shifts/history', {
            headers: {
                'x-tenant-id': 'enigma_hq'
            }
        });

        console.log(`\n✅ STATUS: ${res.status}`);
        console.log(`📦 PAYLOAD: ${JSON.stringify(res.data, null, 2)}`);

        const shifts = res.data.shifts || [];
        console.log(`\n📊 Count: ${shifts.length}`);

        if (shifts.length > 0) {
            console.log("✅ Data is flowing correctly from API.");
        } else {
            console.log("⚠️ API returned 0 records. Check DB query criteria.");
        }

    } catch (e) {
        console.error("\n❌ REQUEST FAILED");
        if (e.response) {
            console.error(`Status: ${e.response.status}`);
            console.error(`Data: ${JSON.stringify(e.response.data)}`);
        } else {
            console.error(e.message);
        }
    }
}

debugReadFlow();
