import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:4000/api/v1';
const TENANT_ID = 'enigma_hq';

async function runTest() {
    console.log("🧪 Testing Kitchen Module API...");

    // 0. Seed Data
    console.log("\n0. Seeding Test Data...");
    // Create Tenant if not exists
    await prisma.tenant.upsert({
        where: { slug: 'enigma_hq' },
        update: {},
        create: { id: TENANT_ID, name: 'Enigma HQ', slug: 'enigma_hq' }
    });

    // Create Ingredient (Zone 3)
    const flour = await prisma.supplyItem.upsert({
        where: { tenantId_sku: { tenantId: TENANT_ID, sku: 'TEST_FLOUR' } },
        update: { stockQuantity: 100 },
        create: {
            tenantId: TENANT_ID,
            name: 'Test Flour',
            sku: 'TEST_FLOUR',
            category: 'Pantry',
            defaultUnit: 'kg',
            stockQuantity: 100,
            currentCost: 1.5
        }
    });

    // Create Batch (Zone 2)
    const dough = await prisma.supplyItem.upsert({
        where: { tenantId_sku: { tenantId: TENANT_ID, sku: 'TEST_DOUGH' } },
        update: { isProduction: true, yieldQuantity: 5, yieldUnit: 'kg' },
        create: {
            tenantId: TENANT_ID,
            name: 'Test Pizza Dough',
            sku: 'TEST_DOUGH',
            category: 'Kitchen',
            defaultUnit: 'kg',
            stockQuantity: 0,
            isProduction: true,
            yieldQuantity: 5,
            yieldUnit: 'kg'
        }
    });

    // Link Recipe
    const existingRecipe = await prisma.productionRecipe.findFirst({ where: { parentItemId: dough.id, supplyItemId: flour.id } });
    if (!existingRecipe) {
        await prisma.productionRecipe.create({
            data: {
                parentItemId: dough.id,
                supplyItemId: flour.id,
                quantity: 3, // 3kg flour for 5kg dough
                unit: 'kg'
            }
        });
    }

    console.log("   ✅ Seeded: Flour & Pizza Dough with Recipe.");


    // 2. Fetch Items
    try {
        console.log("\n1. Fetching Supply Items...");
        const res = await axios.get(`${API_URL}/supply-items`, { headers: { 'x-tenant-id': TENANT_ID } });
        const items = res.data.data;
        console.log(`   Found ${items.length} items.`);

        const batchItem = items.find((i: any) => i.sku === 'TEST_DOUGH');
        const supplyItem = items.find((i: any) => i.sku === 'TEST_FLOUR');

        if (!batchItem) {
            console.warn("⚠️ Batch Item not found via API.");
        } else {
            // 3. Test Production
            console.log(`\n2. Testing Production for ${batchItem.name}...`);
            const prodRes = await axios.post(`${API_URL}/production`, {
                supplyItemId: batchItem.id,
                quantity: 1, // 1 Batch (Yields 5kg)
                unit: batchItem.yieldUnit,
                reason: 'Integration Test Run',
                userId: 'test-user-id'
            }, { headers: { 'x-tenant-id': TENANT_ID } });

            if (prodRes.data.success) {
                console.log("   ✅ Production Success:", prodRes.data.message);
                console.log("   New Stock:", prodRes.data.newStock); // Should be 5
            } else {
                console.error("   ❌ Production Failed:", prodRes.data);
            }
        }

        if (!supplyItem) {
            console.warn("⚠️ Supply Item not found via API.");
        } else {
            // 4. Test Waste
            console.log(`\n3. Testing Waste for ${supplyItem.name}...`);
            const wasteRes = await axios.post(`${API_URL}/waste`, {
                itemId: supplyItem.id,
                quantity: 2,
                unit: supplyItem.defaultUnit,
                type: 'OPERATIONAL',
                reason: 'Test Waste Report',
                userId: 'test-user-id'
            }, { headers: { 'x-tenant-id': TENANT_ID } });

            if (wasteRes.data.success) {
                console.log("   ✅ Waste Reported:", wasteRes.data.message);
                console.log("   New Stock:", wasteRes.data.newStock); // Should be lower
            } else {
                console.error("   ❌ Waste Reporting Failed:", wasteRes.data);
            }
        }

    } catch (e: any) {
        console.error("❌ API Test Failed:", e.message);
        if (e.response) console.error("   Data:", e.response.data);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
