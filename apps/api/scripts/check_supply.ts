
const https = require('https');

const BASE_URL = 'https://enigma-pos-os-production.up.railway.app';
const TENANT_ID = 'enigma_hq';

async function request(path) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-tenant-id': TENANT_ID
            }
        };
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', e => reject(e));
        req.end();
    });
}

async function checkSupplyItems() {
    console.log("🔍 Checking Supply Items: Chocolate & Chantilly...\n");

    // IDs from previous run
    const chocolateId = 'e69a3b3e-3442-46a7-9dd9-dd4aacf3ecd2';
    const chantillyId = '379db21e-ba9b-49e3-aeff-67426ad8dde8';

    const ids = [chocolateId, chantillyId];

    for (const id of ids) {
        try {
            const item = await request(`/api/v1/supply-items/${id}`);
            console.log(`📦 **${item.name}**`);
            console.log(`   - Default Unit: ${item.defaultUnit}`);
            console.log(`   - Recipe Unit: ${item.recipeUnit || 'None'}`);
            console.log(`   - Current Cost: $${item.currentCost}`);
            console.log(`   - Stock: ${item.stockQuantity} ${item.defaultUnit}\n`);
        } catch (e) {
            console.error(`❌ Failed to fetch item ${id}`);
        }
    }
}

checkSupplyItems();
