
import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';

export default async function testSimulationRoutes(fastify: FastifyInstance) {
    fastify.get('/test/simulate-brownie', async (request, reply) => {
        const tenantId = 'enigma_hq';
        const report: string[] = [];
        const log = (msg: string) => report.push(msg);

        log("🍪 STARTING BROWNIE SIMULATION (SERVER-SIDE) 🍪");

        try {
            // 1. SETUP: Find Items
            const batchName = 'Bandeja Brownie';
            const productName = 'Brownie';

            const batchItem = await prisma.supplyItem.findFirst({
                where: { name: { contains: batchName, mode: 'insensitive' }, isProduction: true },
                include: { ingredients: { include: { component: true } } }
            });

            if (!batchItem) return reply.send({ error: `Batch Item '${batchName}' not found` });
            log(`✅ Found Batch: ${batchItem.name} (ID: ${batchItem.id})`);
            log(`   - Current Stock: ${batchItem.stockQuantity} ${batchItem.yieldUnit || 'units'}`);

            const product = await prisma.product.findFirst({
                where: { name: { contains: productName, mode: 'insensitive' } },
                include: { recipes: { include: { supplyItem: true } } }
            });

            if (!product) return reply.send({ error: `Product '${productName}' not found` });
            log(`✅ Found Product: ${product.name} (ID: ${product.id})`);

            // 2. SIMULATE PRODUCTION (1 Batch)
            log("\n🏭 STEP 1: EXECUTING PRODUCTION (1 BATCH)...");

            const batchYield = batchItem.yieldQuantity || 1;

            // 2a. Check Ingredients
            log("   - Ingredients to Deduct:");
            for (const ing of batchItem.ingredients) {
                const current = await prisma.supplyItem.findUnique({ where: { id: ing.supplyItemId } });
                log(`     * ${ing.component.name}: Current ${current?.stockQuantity} -> Deduct ${ing.quantity}`);
            }

            // 2b. Add Batch Stock (Simulation - we won't actually commit unless requested, but here we will mock-execute or actually execute?)
            // User said "Simula", implies "Show me what happens". But typically we want to see it happen.
            // Let's actually execute it to verify the full DB trigger flow? 
            // Better to NOT mutate production data permanently if possible, BUT user asked to "generate a batch".
            // I will execute it and then optionally rollback? No, Prisma doesn't support easy transactions across request/response easily without complexity.
            // I will execute it. The user effectively asked to "generate a batch".

            // ACTUALLY, I will just LOG what would happen to be safe, OR create a 'dry-run' flag?
            // "Simula la generacion... y revisa..." -> "Simulate the generation... and review...".
            // I'll perform a DRY RUN calculation.

            log(`   -> WOULD UPDATE Batch Stock: ${batchItem.stockQuantity} + ${batchYield} = ${batchItem.stockQuantity + batchYield}`);

            // 3. SIMULATE SALE
            log("\n💰 STEP 2: SIMULATING SALE (1 BROWNIE)...");
            const recipeLine = product.recipes.find(r => r.supplyItemId === batchItem.id);

            if (recipeLine) {
                log(`   - Recipe found: Uses ${recipeLine.quantity} ${recipeLine.unit} of Batch`);
                log(`   -> WOULD DEDUCT Batch Stock: ${batchItem.stockQuantity + batchYield} - ${recipeLine.quantity} = ${batchItem.stockQuantity + batchYield - recipeLine.quantity}`);

                const cost = batchItem.currentCost || 0;
                log(`   -> NEW STOCK VALUE: ${(batchItem.stockQuantity + batchYield - recipeLine.quantity)} * $${cost} = $${((batchItem.stockQuantity + batchYield - recipeLine.quantity) * cost).toFixed(2)}`);
            } else {
                log("❌ ERROR: Product does not have a recipe linking to the Batch Item!");
            }

            return { success: true, logs: report };

        } catch (e: any) {
            return { error: e.message, stack: e.stack };
        }
    });
}
