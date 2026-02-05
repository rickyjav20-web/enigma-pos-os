
const axios = require('axios');

const API_URL = 'http://localhost:4000/api/v1';

async function verifyProduction() {
    try {
        console.log("🔍 Starting Production Verification...");

        // 1. Find or Create Ingredient 'Tomates'
        let tomates;
        const itemsRes = await axios.get(`${API_URL}/supply-items`);
        const items = itemsRes.data.data;

        tomates = items.find(i => i.name === 'Tomates');
        if (!tomates) {
            console.log("Creating Tomates...");
            const res = await axios.post(`${API_URL}/supply-items`, {
                name: 'Tomates', category: 'Vegetales', defaultUnit: 'kg', currentCost: 2.0, stockQuantity: 20
            });
            tomates = res.data;
        }
        console.log(`✅ Ingredient: ${tomates.name} (ID: ${tomates.id}), Stock: ${tomates.stockQuantity}`);
        const initialStock = tomates.stockQuantity || 0;

        // 2. Find or Create Batch 'Salsa de Tomate'
        let salsa = items.find(i => i.name === 'Salsa de Tomate');
        if (!salsa) {
            console.log("Creating Salsa de Tomate Batch...");
            // Create Salsa with Recipe (2kg Tomates -> 5L Salsa)
            const res = await axios.post(`${API_URL}/supply-items`, {
                name: 'Salsa de Tomate', category: 'Preparados', defaultUnit: 'und',
                isProduction: true, yieldQuantity: 5, yieldUnit: 'L',
                ingredients: [
                    { id: tomates.id, quantity: 2, unit: 'kg' }
                ]
            });
            salsa = res.data;
        } else {
            console.log("Checking Salsa Recipe...");
            // Ensure recipe exists if item exists but was created without it
            // For simplicity, we assume if it exists we use it, but might fail if no recipe.
            // Let's FORCE update recipe just in case.
            await axios.put(`${API_URL}/supply-items/${salsa.id}`, {
                ingredients: [{ id: tomates.id, quantity: 2, unit: 'kg' }]
            });
        }
        console.log(`✅ Batch: ${salsa.name} (ID: ${salsa.id})`);

        // 3. Execute Production (produce 10L = 2 Batches)
        // 1 Batch = 5L. 10L / 5L = 2 Scale.
        // Needs 2 * 2kg = 4kg Tomates.
        console.log("🍳 Executing Production (10L)...");
        const prodRes = await axios.post(`${API_URL}/production`, {
            supplyItemId: salsa.id,
            quantity: 10,
            unit: 'L'
        });

        console.log("🎉 Production Result:", prodRes.data);

        // 4. Verify Stock
        const finalTomatesRes = await axios.get(`${API_URL}/supply-items`);
        const finalTomates = finalTomatesRes.data.data.find(i => i.id === tomates.id);

        const expectedStock = initialStock - 4;
        console.log(`📊 Stock Check: Start ${initialStock} -> End ${finalTomates.stockQuantity} (Expected: ${expectedStock})`);

        if (Math.abs(finalTomates.stockQuantity - expectedStock) < 0.01) {
            console.log("SUCCESS: Stock updated correctly.");
        } else {
            console.error("FAILURE: Stock mismatch.");
        }

    } catch (e) {
        console.error("❌ Error:", e.response ? e.response.data : e.message);
    }
}

verifyProduction();
