
import https from 'https';

const BASE_URL = 'https://enigma-pos-os-production.up.railway.app';
const TENANT_ID = 'enigma_hq';

// Colors for console
const C = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    blue: "\x1b[34m",
    yellow: "\x1b[33m"
};

async function request(path: string, method: string = 'GET', body: any = null) {
    return new Promise<any>((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'x-tenant-id': TENANT_ID
            }
        };

        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(data); // Handle non-JSON response
                    }
                } else {
                    reject({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', e => reject(e));

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function runVerification() {
    console.log(`${C.blue}🚀 Starting PRODUCTION Data Flow Verification...${C.reset}`);

    try {
        // 1. Auth: Get Employee
        console.log(`${C.yellow}[1/7] Fetching Employee...${C.reset}`);
        const { employees } = await request('/api/v1/employees'); // Assuming prefix based on restore-prod.ts having /api/v1
        // Wait, restore-prod.ts had /api/v1/ingest/products. 
        // But staff.ts routes don't show prefix. Usually index.ts mounts them.
        // I will try /api/v1/employees first. If fails, I'll debug.

        let employee = employees.find((e: any) => e.fullName === 'Test User');
        if (!employee) {
            console.log("Test User not found, using first available.");
            employee = employees[0];
        }
        if (!employee) throw new Error("No employees found. Cannot authenticate.");
        console.log(`${C.green}✅ Using Employee: ${employee.fullName} (${employee.id})${C.reset}`);


        // 2. Session: Open Register
        console.log(`${C.yellow}[2/7] Opening Register Session...${C.reset}`);
        // Endpoint: /register/open
        // Need to check prefix. Usually routes are mounted under /api/v1/register?
        // Let's assume /api/v1 prefix for all.
        let sessionId;
        const sessionRes = await request('/api/v1/register/open', 'POST', {
            employeeId: employee.id,
            startingCash: 100
        }).catch(async err => {
            if (err.status === 400) {
                console.log("   Register already open, fetching active session...");
                return await request(`/api/v1/register/status/${employee.id}`);
            }
            throw err;
        });

        if (sessionRes && sessionRes.id) {
            sessionId = sessionRes.id;
            console.log(`${C.green}✅ Session Active: ${sessionId}${C.reset}`);
        } else {
            throw new Error("Could not get Session ID. Response: " + JSON.stringify(sessionRes));
        }

        // 3. Setup: Create Test Items
        const TIMESTAMP = Date.now();
        const ITEM_NAME = `VERIFY_ITEM_${TIMESTAMP}`;
        const BATCH_NAME = `VERIFY_BATCH_${TIMESTAMP}`;

        console.log(`${C.yellow}[3/7] Creating Test Ingredient: ${ITEM_NAME}...${C.reset}`);
        const ingredient = await request('/api/v1/supply-items', 'POST', {
            name: ITEM_NAME,
            category: 'TEST',
            currentCost: 1.0,
            unitOfMeasure: 'und',
            tenantId: TENANT_ID
        });
        console.log(`${C.green}✅ Ingredient Created. Cost: $1.0${C.reset}`);

        console.log(`${C.yellow}[4/7] Creating Test Batch linked to Ingredient...${C.reset}`);
        const batch = await request('/api/v1/supply-items', 'POST', {
            name: BATCH_NAME,
            category: 'TEST',
            currentCost: 0, // Should calc
            unitOfMeasure: 'und',
            tenantId: TENANT_ID,
            yieldQuantity: 1,
            ingredients: [
                { id: ingredient.id, quantity: 2, unit: 'und' }
            ]
        });
        console.log(`${C.green}✅ Batch Created.${C.reset}`);

        // CHECK INITIAL COST
        console.log("   Verifying initial calculated cost...");
        const batchCheck = await request(`/api/v1/supply-items/${batch.id}`);
        // Expected: 2 * 1.0 = 2.0
        if (batchCheck.currentCost === 2.0) {
            console.log(`${C.green}   ✅ Initial Cost Correct: $2.0${C.reset}`);
        } else {
            console.log(`${C.red}   ❌ Initial Cost Error: Got ${batchCheck.currentCost}, Expected 2.0${C.reset}`);
        }

        // 5. Action: Purchase Ingredient with NEW PRICE
        console.log(`${C.yellow}[5/7] Executing Purchase with Price Change ($1.0 -> $2.0)...${C.reset}`);

        await request('/api/v1/register/transaction', 'POST', {
            sessionId,
            type: 'EXPENSE',
            amount: 20.0, // 10 * 2.0
            description: 'Verification Test Purchase',
            supplyItemId: ingredient.id,
            quantity: 10,
            unitCost: 2.0 // DOUBLED PRICE
        });
        console.log(`${C.green}✅ Purchase Recorded.${C.reset}`);

        // 6. Verify Ingredient Update (Zone 3)
        console.log(`${C.yellow}[6/7] Verifying Ingredient Update...${C.reset}`);
        const ingCheck = await request(`/api/v1/supply-items/${ingredient.id}`);

        if (ingCheck.currentCost === 2.0) {
            console.log(`${C.green}   ✅ Ingredient Cost Updated to $2.0${C.reset}`);
        } else {
            console.log(`${C.red}   ❌ Ingredient Cost Failed: ${ingCheck.currentCost}${C.reset}`);
        }

        // Check Stock
        const expectedStock = ingredient.stockQuantity ? (ingredient.stockQuantity + 10) : 10;
        if (ingCheck.stockQuantity === expectedStock) {
            console.log(`${C.green}   ✅ Stock Updated.${C.reset}`);
        } else {
            console.log(`${C.red}   ❌ Stock Mismatch.${C.reset}`);
        }

        // Check Price History
        // Try both URL patterns found in code
        let history = [];
        try {
            history = await request(`/api/v1/supply-items/${ingredient.id}/price-history`);
            if (!Array.isArray(history)) throw new Error("Not array");
        } catch (e) {
            try {
                history = await request(`/api/v1/${ingredient.id}/price-history`);
            } catch (e2) { }
        }

        if (history.length > 0 && history[0].newCost === 2.0) {
            console.log(`${C.green}   ✅ Smart Shopper PriceHistory Created.${C.reset}`);
        } else {
            console.log(`${C.red}   ❌ PriceHistory Missing or Incorrect.${C.reset}`);
        }

        // 7. Verify Batch Update (Zone 5)
        console.log(`${C.yellow}[7/7] Verifying Batch Cost Recursive Update...${C.reset}`);
        const batchFinal = await request(`/api/v1/supply-items/${batch.id}`);
        // Expected: 2 * 2.0 = 4.0
        if (Math.abs(batchFinal.currentCost - 4.0) < 0.01) {
            console.log(`${C.green}   ✅ RECURSIVE UPDATE SUCCESS! Batch Cost is $4.0${C.reset}`);
        } else {
            console.log(`${C.red}   ❌ Recursive Update Failed. Got ${batchFinal.currentCost}, Expected 4.0${C.reset}`);
        }

        // CLEANUP (Optional - maybe keep for inspection)
        console.log("test complete");

    } catch (e: any) {
        console.error(`${C.red}💥 CRITICAL FAILURE: ${e.message || JSON.stringify(e)}${C.reset}`);
        if (e.data) console.error(e.data);
    }
}

runVerification();
