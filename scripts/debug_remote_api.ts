
import fetch from 'node-fetch';

const API_URL = 'https://enigma-pos-os-production.up.railway.app/api/v1'; // Using the hardcoded prod URL from user context
const TENANT_ID = 'enigma_hq';

async function run() {
    console.log(`🔍 Diagnosing Production API at ${API_URL}...`);

    try {
        // 1. Check if we can reach the API (Health Check usually, but let's try Suppliers as a proxy for Tenant)
        console.log(`\n1. Checking Suppliers (Proxy for Tenant Validation)...`);
        const supRes = await fetch(`${API_URL}/suppliers`, {
            headers: { 'x-tenant-id': TENANT_ID }
        });

        if (supRes.status === 200) {
            console.log(`✅ Suppliers Endpoint OK. Tenant '${TENANT_ID}' seems valid.`);
        } else {
            console.error(`❌ Suppliers Endpoint Failed: ${supRes.status} ${supRes.statusText}`);
            console.error(await supRes.text());
            return; // Stop if tenant/auth is broken
        }

        // 2. Try to Create a Test Supply Item (Simulate OPS)
        console.log(`\n2. Attempting to Create Test Supply Item...`);
        const payload = {
            name: `DEBUG_ITEM_${Date.now()}`,
            sku: `DEBUG-${Date.now()}`,
            category: 'Debug',
            currentCost: 10,
            unitOfMeasure: 'kg', // Using the field expected by the API endpoint logic
            tenantId: TENANT_ID
        };

        const createRes = await fetch(`${API_URL}/supply-items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-tenant-id': TENANT_ID
            },
            body: JSON.stringify(payload)
        });

        if (createRes.status === 200 || createRes.status === 201) {
            const data = await createRes.json();
            console.log(`✅ Success! Created Item ID: ${(data as any).id}`);
            console.log(data);
        } else {
            console.error(`❌ Creation Failed: ${createRes.status} ${createRes.statusText}`);
            console.error(await createRes.text());
        }

    } catch (e) {
        console.error("🔥 Network/Script Error:", e);
    }
}

run();
