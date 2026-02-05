/**
 * verify_recipe_api.ts
 * 
 * Tests the HTTP endpoints exposed by `product-recipes.ts`.
 * Validates that the Frontend can actually fetch and manipulate recipes.
 */
// @ts-nocheck
import axios from 'axios';

const API_URL = 'http://localhost:4000/api/v1';

async function verifyApi() {
    console.log("📡 STARTING API VERIFICATION: RECIPES");

    // 1. Get a Product ID (Panini)
    // We need a real ID, lets try to fetch products first to find one
    try {
        // Enigma Main Query - Use tenant_id (snake_case)
        const prodRes = await axios.get(`${API_URL}/products?limit=100&tenant_id=enigma_hq`);
        const products = prodRes.data.data || prodRes.data;

        let targetProduct = products.find((p: any) => p.name.includes("Panini"));
        if (!targetProduct && products.length > 0) targetProduct = products[0];

        if (!targetProduct) {
            console.log("   ⚠️ No products found. Seeding 'Verification Sandwich'...");
            const seedRes = await axios.post(`${API_URL}/products`, {
                name: 'Verification Sandwich',
                price: 5.00,
                cost: 2.00,
                tenant_id: 'enigma_hq',
                categoryId: 'verification'
            });
            if (seedRes.status === 200 || seedRes.status === 201) {
                targetProduct = seedRes.data;
                console.log(`   ✅ Seeding Success: ${targetProduct.name} (${targetProduct.id})`);
            } else {
                console.error("❌ Seeding Failed:", seedRes.data);
                return;
            }
        }

        console.log(`   Selected Product: ${targetProduct.name} (${targetProduct.id})`);

        // 2. FETCH RECIPE (GET)
        console.log(`   GET /recipes/${targetProduct.id}`);
        // Note: Route is /recipes/:productId (as per view_file)
        const recipeRes = await axios.get(`${API_URL}/recipes/${targetProduct.id}?tenant_id=enigma_hq`);

        if (recipeRes.status === 200) {
            console.log(`   ✅ GET Success. Ingredients: ${recipeRes.data.length}`);
        }

        // 3. ADD INGREDIENT (POST)
        // Find a supply item to add
        const supplyRes = await axios.get(`${API_URL}/supply-items?limit=5&tenant_id=enigma_hq`);
        const ingredient = supplyRes.data.data?.[0] || supplyRes.data?.[0];

        if (ingredient) {
            console.log(`   POST /recipes/${targetProduct.id} -> Adding ${ingredient.name}`);

            const linkUrl = `${API_URL}/recipes/${targetProduct.id}`;
            console.log("   🔗 Calling URL:", linkUrl);
            console.log("   📦 Payload:", JSON.stringify({ supplyItemId: ingredient.id, quantity: 1.5, unit: 'und', tenant_id: 'enigma_hq' }));

            const linkRes = await axios.post(linkUrl, {
                supplyItemId: ingredient.id,
                quantity: 1.5,
                unit: 'und',
                tenant_id: 'enigma_hq'
            });

            if (linkRes.status === 200) {
                console.log(`   ✅ POST Link Success.`);
            } else {
                console.error(`   ❌ POST Link Failed:`, linkRes.data);
            }
        }

        // 4. VERIFY UPDATE
        // Fetch again to see if it's there
        const verifyRes = await axios.get(`${API_URL}/recipes/${targetProduct.id}?tenant_id=enigma_hq`);
        const hasIngredient = verifyRes.data.find((r: any) => r.supplyItem.id === ingredient.id);

        if (hasIngredient && hasIngredient.quantity === 1.5) {
            console.log(`   ✅ Verification: Ingredient found in recipe with correct quantity.`);
        } else {
            console.error(`   ❌ Verification Failed: Ingredient not found or quantity mismatch.`);
        }

    } catch (e: any) {
        console.error("❌ API Test Failed:", e.response?.data || e.message);
        process.exit(1);
    }
}

verifyApi();
