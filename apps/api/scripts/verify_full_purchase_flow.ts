
import axios from 'axios';

const API_URL = 'http://localhost:4000/api/v1'; // Core API Port

async function runTest() {
    console.log("🚀 STARTING FULL INTEGRATION TEST: PURCHASE MODULE");
    const timestamp = Date.now();

    try {
        // 1. Create Supplier
        console.log("\n🚚 1. Creating Supplier...");
        const supplierRes = await axios.post(`${API_URL}/suppliers`, {
            name: `Integration Test Supplier ${timestamp}`,
            tenantId: 'enigma_hq_test',
            email: `test_${timestamp}@example.com`,
            category: 'TEST_INTEGRATION'
        });
        const supplier = supplierRes.data;
        console.log(`   ✅ Created Supplier: ${supplier.name} (ID: ${supplier.id})`);

        // 2. Create Supply Item
        console.log("\n📦 2. Creating Supply Item...");
        const itemRes = await axios.post(`${API_URL}/supply-items`, {
            name: `Test Item ${timestamp}`,
            sku: `SKU-${timestamp}`,
            category: 'Testing',
            currentCost: 10.00, // Initial Cost
            unitOfMeasure: 'kg',
            preferredSupplierId: supplier.id,
            tenantId: 'enigma_hq_test'
        });
        const item = itemRes.data;
        console.log(`   ✅ Created Item: ${item.name} (ID: ${item.id})`);
        console.log(`   💰 Initial Cost: $${item.currentCost}`);

        // 3. Record Purchase (The Critical Flow)
        console.log("\n📝 3. Recording Manual Purchase (Price Spike)...");
        // We simulate buying it at $15.00 (was $10.00)
        const purchaseRes = await axios.post(`${API_URL}/purchases`, {
            supplierId: supplier.id,
            status: 'confirmed',
            items: [
                {
                    supplyItemId: item.id,
                    quantity: 100,
                    unitCost: 15.00
                }
            ],
            tenantId: 'enigma_hq_test'
        });
        console.log(`   ✅ Purchase Recorded (ID: ${purchaseRes.data.id})`);

        // 4. Verify Side Effects (Price Update)
        console.log("\n🔍 4. Verifying Price Update...");
        const verifyItemRes = await axios.get(`${API_URL}/supply-items/${item.id}`);
        const updatedItem = verifyItemRes.data;

        if (updatedItem.currentCost === 15.00) {
            console.log(`   ✅ SUCCESS: Item Cost Updated to $15.00`);
        } else {
            console.error(`   ❌ FAILURE: Item Cost is $${updatedItem.currentCost} (Expected $15.00)`);
            process.exit(1);
        }

        // 5. Verify History Log
        console.log("\n📜 5. Verifying Price History...");
        if (updatedItem.priceHistory && updatedItem.priceHistory.length > 0) {
            const history = updatedItem.priceHistory[0];
            console.log(`   ✅ History Found: Changed from $${history.oldCost} to $${history.newCost}`);
        } else {
            console.warn(`   ⚠️ WARNING: No Price History Log Found (Check API Logic)`);
        }

    } catch (error: any) {
        console.error("❌ TEST FAILED:", error.response ? error.response.data : error.message);
        process.exit(1);
    }
}

runTest();
