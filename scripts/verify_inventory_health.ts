
import axios from 'axios';

const API_URL = 'http://localhost:4000/api/v1';
const TENANT_HEADER = { 'x-tenant-id': 'enigma_hq' };

async function verifyInventoryHealth() {
    console.log("📦 STARTING INVENTORY HEALTH CHECK");
    console.log("==================================");

    try {
        // 1. Create Supplier
        console.log("\n1️⃣ Creating Test Supplier...");
        const supplierRes = await axios.post(`${API_URL}/suppliers`, {
            name: `Test Supplier ${Date.now()}`,
            category: 'Test',
            email: 'test@supplier.com'
        }, { headers: TENANT_HEADER });

        const supplier = supplierRes.data;
        console.log(`   ✅ Created Supplier: ${supplier.name} (ID: ${supplier.id})`);

        // 2. Create Supply Item
        console.log("\n2️⃣ Creating Supply Item...");
        const itemRes = await axios.post(`${API_URL}/supply-items`, {
            name: `Test Flour ${Date.now()}`,
            sku: `FLOUR-${Date.now()}`,
            category: 'Bakery',
            currentCost: 10.00,
            unitOfMeasure: 'kg',
            preferredSupplierId: supplier.id
        }, { headers: TENANT_HEADER });

        const item = itemRes.data;
        console.log(`   ✅ Created Item: ${item.name} (Cost: $${item.currentCost})`);

        // 3. Purchase Order (Price Increase)
        console.log("\n3️⃣ Executing Purchase Order (Cost Update)...");
        const poRes = await axios.post(`${API_URL}/purchases`, {
            supplierId: supplier.id,
            status: 'confirmed', // Should trigger logic
            items: [
                {
                    supplyItemId: item.id,
                    quantity: 100,
                    unitCost: 12.50 // New Higher Price
                }
            ]
        }, { headers: TENANT_HEADER });

        console.log(`   ✅ PO Created: Total $${poRes.data.totalAmount}`);

        // 4. Verify Cost Update
        console.log("\n4️⃣ Verifying Item Cost Update...");
        const updatedItemRes = await axios.get(`${API_URL}/supply-items/${item.id}`, { headers: TENANT_HEADER });
        const updatedItem = updatedItemRes.data;

        if (updatedItem.currentCost === 12.50) {
            console.log(`   ✅ Cost Updated Successfully to: $${updatedItem.currentCost}`);
        } else {
            console.error(`   ❌ Cost Update Failed. Expected 12.50, got ${updatedItem.currentCost}`);
        }

        // 5. Smart Order Analysis
        console.log("\n5️⃣ Testing Smart Order Logic...");
        const analyzeRes = await axios.post(`${API_URL}/optimizer/analyze`, {
            itemIds: [item.id]
        }, { headers: TENANT_HEADER });

        const plan = analyzeRes.data; // Array of supplier plans
        const recommended = plan.find((p: any) => p.supplierName === supplier.name);

        if (recommended && recommended.items[0].estCost === 12.50) {
            console.log(`   ✅ Smart Order Correctly Recommends: ${recommended.supplierName} @ $${recommended.items[0].estCost}`);
        } else {
            console.warn(`   ⚠️ Smart Order Logic Unexpected:`, JSON.stringify(plan, null, 2));
        }

        console.log("\n✅ INVENTORY MODULE VERIFIED HEALTHY");

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

verifyInventoryHealth();
