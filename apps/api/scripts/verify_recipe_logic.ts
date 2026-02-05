import axios from 'axios';
import { randomUUID } from 'crypto';

const API_URL = 'http://localhost:4000/api/v1';

async function verifyRecipeEngine() {
    console.log("🧪 STARTING RECIPE ENGINE VERIFICATION");
    const tenantId = 'enigma_hq';

    // 1. Create a Test Product (Burger) - Cost should be 0 initially
    console.log("1️⃣ Creating Test Product (Burger)...");
    const product = (await axios.post(`${API_URL}/products`, {
        name: `Test Burger ${Date.now()}`,
        price: 15.0,
        cost: 0,
        tenantId
    })).data;
    console.log(`   -> Product Created: ${product.name} (ID: ${product.id}) Cost: $${product.cost}`);

    // 2. Create Test Ingredients (Meat, Bun)
    console.log("2️⃣ Creating Test Ingredients...");
    const meat = (await axios.post(`${API_URL}/supply-items`, {
        name: `Test Meat ${Date.now()}`,
        currentCost: 10.0, // $10 per kg
        unitOfMeasure: 'kg',
        tenantId
    })).data;
    console.log(`   -> Meat Created: ${meat.name} (ID: ${meat.id}) Cost: $${meat.currentCost}/kg`);

    const bun = (await axios.post(`${API_URL}/supply-items`, {
        name: `Test Bun ${Date.now()}`,
        currentCost: 0.50, // $0.50 per unit
        unitOfMeasure: 'und',
        tenantId
    })).data;
    console.log(`   -> Bun Created: ${bun.name} (ID: ${bun.id}) Cost: $${bun.currentCost}/und`);

    // 3. Link Ingredients (Recipe)
    // Recipe: 0.2kg Meat + 1 Bun
    // Expected Cost: (0.2 * 10) + (1 * 0.5) = 2.0 + 0.5 = $2.50
    console.log("3️⃣ Creating Recipe (Linking Ingredients)...");
    await axios.post(`${API_URL}/recipes/${product.id}`, {
        supplyItemId: meat.id,
        quantity: 0.2,
        unit: 'kg'
    });
    await axios.post(`${API_URL}/recipes/${product.id}`, {
        supplyItemId: bun.id,
        quantity: 1,
        unit: 'und'
    });
    console.log("   -> Recipe Linked.");

    // 4. Verify Initial Cost Calculation
    // Wait for async calculation? Or is it awaited? RecipeLink is awaited in controller.
    const productInitial = (await axios.get(`${API_URL}/products/${product.id}`)).data;
    console.log(`   -> Product Cost after Recipe: $${productInitial.cost}`);

    if (Math.abs(productInitial.cost - 2.50) < 0.01) {
        console.log("   ✅ SUCCESS: Initial Cost Calculation Correct ($2.50)");
    } else {
        console.error(`   ❌ FAILURE: Expected $2.50, got $${productInitial.cost}`);
    }

    // 5. Simulate INFLATION (Purchase Meat at Higher Price)
    // New Price: $20.00/kg
    // Expected New Burger Cost: (0.2 * 20) + 0.5 = 4.0 + 0.5 = $4.50
    console.log("4️⃣ Simulating INFLATION (Buying Meat @ $20.00/kg)...");

    // Create Supplier
    const supplier = (await axios.post(`${API_URL}/suppliers`, { name: 'InflationInc', tenantId })).data;

    // Create Purchase Order
    const po = (await axios.post(`${API_URL}/purchases`, {
        supplierId: supplier.id,
        tenantId,
        status: 'confirmed', // Immediate confirmation to trigger event
        items: [
            { supplyItemId: meat.id, quantity: 10, unitCost: 20.00 }
        ]
    })).data;
    console.log(`   -> PO Confirmed (ID: ${po.id}).`);

    // 6. Wait for Event Propagation (RecipeService listens to event)
    console.log("   -> Waiting 2 seconds for event propagation...");
    await new Promise(r => setTimeout(r, 2000));

    // 7. Verify New Product Cost
    const productFinal = (await axios.get(`${API_URL}/products/${product.id}`)).data;
    console.log(`   -> Product Cost after Inflation: $${productFinal.cost}`);

    if (Math.abs(productFinal.cost - 4.50) < 0.01) {
        console.log("   ✅ SUCCESS: Cost Ripple Effect Worked! ($4.50)");
    } else {
        console.error(`   ❌ FAILURE: Expected $4.50, got $${productFinal.cost}`);
    }
}

verifyRecipeEngine().catch(console.error);
