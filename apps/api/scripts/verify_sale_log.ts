
const https = require('https');

const BASE_URL = 'https://enigma-pos-os-production.up.railway.app';
const TENANT_ID = 'enigma_hq';

// 1. Employee & Session Setup (Reusing verify_flow logic simplified)
async function request(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'x-tenant-id': TENANT_ID
            }
        };
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 400) reject(JSON.parse(data));
                else resolve(JSON.parse(data));
            });
        });
        req.on('error', e => reject(e));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function verifySaleDeduction() {
    console.log("🛒 Simulating Sale & Verifying Deduction Log...\n");

    try {
        // 1. Get Employee
        const { employees } = await request('/api/v1/employees');
        const employee = employees[0];

        // 2. Open Session (if needed)
        // Try getting status first
        let sessionId;
        try {
            const status = await request(`/api/v1/register/status/${employee.id}`);
            if (status.id) sessionId = status.id;
        } catch (e) { }

        if (!sessionId) {
            console.log("Opening new session...");
            const session = await request('/api/v1/register/open', 'POST', {
                employeeId: employee.id,
                startingCash: 100
            });
            sessionId = session.id;
        }
        console.log(`Session ID: ${sessionId}`);

        // 3. Find Product "Extra - Arequipe"
        const { data: products } = await request('/api/v1/products?search=Extra%20–%20Arequipe');
        const product = products.find(p => p.name.includes('Arequipe'));

        if (!product) throw new Error("Product 'Extra - Arequipe' not found");
        console.log(`Product Found: ${product.name} (${product.id})`);

        // 4. Check Ingredient Stock BEFORE
        // We know it uses "Arequipe" (SupplyItem). Let's find it.
        const { data: supplies } = await request('/api/v1/supply-items?search=Arequipe');
        const supplyItem = supplies.find(s => s.name === 'Arequipe');
        if (!supplyItem) throw new Error("Supply Item 'Arequipe' not found");

        console.log(`Initial Stock of Arequipe: ${supplyItem.stockQuantity} ${supplyItem.defaultUnit}`);

        // 5. Execute Sale
        console.log("Executing Sale of 1x Extra - Arequipe...");
        const sale = await request('/api/v1/sales', 'POST', {
            sessionId,
            items: [{ productId: product.id, quantity: 1, price: product.price }],
            paymentMethod: 'cash',
            notes: 'TEST_VERIFICATION_SALE'
        });
        console.log("Sale Created:", sale.id);

        // 6. Check Logs & Stock AFTER
        // Wait a moment for async processing (though sales.ts looks synchronous for logs)
        await new Promise(r => setTimeout(r, 1000));

        const { data: logs } = await request('/api/v1/inventory/logs?limit=5');
        const relevantLog = logs.find(l => l.supplyItemId === supplyItem.id && l.reason === 'sale');

        if (relevantLog) {
            console.log("\n✅ LOG FOUND:");
            console.log(`   Change: ${relevantLog.changeAmount}`);
            console.log(`   Reason: ${relevantLog.reason}`);
            console.log(`   Notes:  "${relevantLog.notes}"`);  // Expecting "Sold 1x Extra - Arequipe"

            if (relevantLog.notes.includes('Extra')) {
                console.log("   --> Visual Confirmation: Log explicitly mentions the product name!");
            }
        } else {
            console.error("\n❌ NO RECENT LOG FOUND for this sale!");
        }

        const updatedSupply = await request(`/api/v1/supply-items/${supplyItem.id}`);
        console.log(`\nFinal Stock of Arequipe: ${updatedSupply.stockQuantity} ${updatedSupply.defaultUnit}`);
        console.log(`Delta: ${updatedSupply.stockQuantity - supplyItem.stockQuantity}`);

    } catch (e) {
        console.error("Error:", e);
    }
}

verifySaleDeduction();
