
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

async function verifyExtras() {
    console.log("🔍 Verifying Extras Configuration...\n");

    // 1. Get All Products
    const { data: products } = await request('/api/v1/products?limit=1000');

    // 2. Filter Extras
    const extras = products.filter(p => p.name.toLowerCase().includes('extra'));

    if (extras.length === 0) {
        console.log("❌ No products found with 'Extra' in name.");
        return;
    }

    console.log(`Found ${extras.length} Extras. Checking Recipes:\n`);

    for (const p of extras) {
        // Fetch full details (including recipes)
        const fullProduct = await request(`/api/v1/products/${p.id}`);

        console.log(`📦 **${fullProduct.name}** (Price: $${fullProduct.price})`);

        if (!fullProduct.recipes || fullProduct.recipes.length === 0) {
            console.log(`   ⚠️  NO RECIPE LINKED! (Will not deduct stock)\n`);
            continue;
        }

        for (const r of fullProduct.recipes) {
            console.log(`   ✅ DEDUCTS: ${r.quantity} ${r.unit} of "${r.supplyItem?.name}"`);
            console.log(`      (Supply Item ID: ${r.supplyItemId})`);

            // Check Supply Item Unit
            // We rely on what's in the recipe snapshot for now, but ideally we check the supply item too
            if (r.unit === 'und') {
                console.log(`      ⚠️  WARNING: Unit is 'und'. Is this correct?`);
            }
        }
        console.log(""); // Spacer
    }
}

verifyExtras();
