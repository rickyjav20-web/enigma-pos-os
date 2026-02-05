
import axios from 'axios';

const API_URL = 'http://localhost:4000/api/v1';
const TENANT_ID = 'enigma_hq';

const api = axios.create({
    baseURL: API_URL,
    headers: { 'x-tenant-id': TENANT_ID }
});

async function run() {
    console.log("🚀 Starting Data Simulation...");

    // 1. Create Supplier
    console.log("\n[1] Creating Supplier...");
    const supplier = (await api.post('/suppliers', {
        name: "Simulated Foods Inc",
        category: "General",
        tenantId: TENANT_ID
    })).data;
    console.log(`✅ Supplier: ${supplier.name} (${supplier.id})`);

    // 2. Create 10 Ingredients
    console.log("\n[2] Creating 10 Ingredients...");
    const ingredients = [];
    const ingData = [
        { name: "Sim Flour", cost: 1.5, unit: 'kg' },
        { name: "Sim Sugar", cost: 2.0, unit: 'kg' },
        { name: "Sim Eggs", cost: 0.2, unit: 'und' },
        { name: "Sim Milk", cost: 1.2, unit: 'lt' },
        { name: "Sim Butter", cost: 5.0, unit: 'kg' },
        { name: "Sim Chocolate", cost: 10.0, unit: 'kg' },
        { name: "Sim Yeast", cost: 8.0, unit: 'kg' },
        { name: "Sim Salt", cost: 0.5, unit: 'kg' },
        { name: "Sim Water", cost: 0.1, unit: 'lt' }, // Filtered
        { name: "Sim Vanilla", cost: 20.0, unit: 'lt' }
    ];

    for (const d of ingData) {
        const item = (await api.post('/supply-items', {
            name: d.name,
            currentCost: d.cost,
            unitOfMeasure: d.unit,
            preferredSupplierId: supplier.id,
            tenantId: TENANT_ID
        })).data;
        ingredients.push(item);
        console.log(`   + Created: ${item.name} ($${item.currentCost})`);
    }

    // 3. Create 2 Batches
    // Batch 1: Cookie Dough (Flour, Sugar, Butter, Eggs, Choc)
    // Batch 2: Bread Dough (Flour, Water, Salt, Yeast)
    console.log("\n[3] Creating 2 Batches...");

    // Cookie Dough
    const cookieDough = (await api.post('/supply-items', {
        name: "Sim Cookie Dough",
        unitOfMeasure: 'kg',
        yieldQuantity: 10, // Produces 10kg
        yieldUnit: 'kg',
        ingredients: [
            { id: ingredients[0].id, quantity: 5, unit: 'kg' }, // Flour
            { id: ingredients[1].id, quantity: 2, unit: 'kg' }, // Sugar
            { id: ingredients[4].id, quantity: 1, unit: 'kg' }, // Butter
            { id: ingredients[2].id, quantity: 10, unit: 'und' }, // Eggs
            { id: ingredients[5].id, quantity: 1, unit: 'kg' } // Choc
        ],
        tenantId: TENANT_ID
    })).data;
    console.log(`✅ Batch 1: ${cookieDough.name}`);

    // Bread Dough
    const breadDough = (await api.post('/supply-items', {
        name: "Sim Bread Dough",
        unitOfMeasure: 'kg',
        yieldQuantity: 20, // Produces 20kg
        yieldUnit: 'kg',
        ingredients: [
            { id: ingredients[0].id, quantity: 15, unit: 'kg' }, // Flour
            { id: ingredients[8].id, quantity: 4, unit: 'lt' }, // Water
            { id: ingredients[7].id, quantity: 0.5, unit: 'kg' }, // Salt
            { id: ingredients[6].id, quantity: 0.1, unit: 'kg' } // Yeast
        ],
        tenantId: TENANT_ID
    })).data;
    console.log(`✅ Batch 2: ${breadDough.name}`);

    // 4. Create 5 Products
    console.log("\n[4] Creating 5 Products...");

    const productsData = [
        {
            name: "Sim Choco Cookie",
            price: 3.50,
            recipes: [
                { id: cookieDough.id, quantity: 0.1, unit: 'kg' } // 100g dough
            ]
        },
        {
            name: "Sim Baguette",
            price: 2.00,
            recipes: [
                { id: breadDough.id, quantity: 0.3, unit: 'kg' } // 300g dough
            ]
        },
        {
            name: "Sim Milkshake",
            price: 5.00,
            recipes: [
                { id: ingredients[3].id, quantity: 0.3, unit: 'lt' }, // Milk
                { id: ingredients[5].id, quantity: 0.05, unit: 'kg' }, // Choc
                { id: ingredients[1].id, quantity: 0.02, unit: 'kg' } // Sugar
            ]
        },
        {
            name: "Sim Basic Bread",
            price: 1.50,
            recipes: [
                { id: breadDough.id, quantity: 0.5, unit: 'kg' }
            ]
        },
        {
            name: "Sim Special Cake",
            price: 25.00,
            recipes: [
                { id: cookieDough.id, quantity: 1, unit: 'kg' }, // Base
                { id: ingredients[9].id, quantity: 0.01, unit: 'lt' } // Vanilla topping
            ]
        }
    ];

    for (const p of productsData) {
        const prod = (await api.post('/products', {
            name: p.name,
            price: p.price,
            tenantId: TENANT_ID,
            recipes: p.recipes
        })).data;
        console.log(`   + Product: ${prod.name} ($${prod.price})`);
    }

    console.log("\n✅ SIMULATION COMPLETE. Refresh Dashboard.");
}

run().catch(console.error);
