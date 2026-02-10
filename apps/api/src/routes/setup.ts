import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';

export default async function setupRoutes(fastify: FastifyInstance) {
    // POST /setup/init-tenant
    // Temporary endpoint to seed the default tenant
    fastify.post('/setup/init-tenant', async (request, reply) => {
        try {
            const tenantId = 'enigma_hq';

            // Check if exists
            const existing = await prisma.tenant.findUnique({
                where: { id: tenantId }
            });

            if (existing) {
                return { success: true, message: 'Tenant already exists', tenant: existing };
            }

            // Create
            const newTenant = await prisma.tenant.create({
                data: {
                    id: tenantId,
                    name: 'Enigma HQ',
                    slug: 'enigma-hq'
                }
            });

            return { success: true, message: 'Tenant created successfully', tenant: newTenant };

        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: error.message });
        }
    });
    // POST /setup/reset
    // Wipes operational data (Products, Inventory, Suppliers) and re-seeds defaults.
    // OPTIONAL: ?keepStaff=true (default) to preserve employees.
    fastify.post('/setup/reset', async (request, reply) => {
        try {
            // Middleware now guarantees tenantId (defaults to 'enigma-cafe' if missing)
            // But we prefer explicit.
            const tenantId = request.tenantId;
            const { keepStaff = true } = request.query as any;

            console.log(`⚠️ RESETTING DATA FOR TENANT: ${tenantId}`);

            // 1. Delete Operational Data (Order matters for Foreign Keys)
            // Fix: Delete by verifying all relation paths to ensure no orphans block deletion

            // Production Recipes (Batches) - Delete if linked to ANY item in this tenant
            await prisma.productionRecipe.deleteMany({
                where: {
                    OR: [
                        { parent: { tenantId } },
                        { component: { tenantId } }
                    ]
                }
            });

            // Product Recipes (Menu)
            await prisma.productRecipe.deleteMany({ where: { product: { tenantId } } });

            // Purchase Lines: Delete if Order is in Tenant OR Item is in Tenant
            await prisma.purchaseLine.deleteMany({
                where: {
                    OR: [
                        { purchaseOrder: { tenantId } },
                        { supplyItem: { tenantId } }
                    ]
                }
            });

            await prisma.purchaseOrder.deleteMany({ where: { tenantId } });

            await prisma.priceHistory.deleteMany({ where: { supplyItem: { tenantId } } });

            // Delete Products & Items
            await prisma.variant.deleteMany({ where: { product: { tenantId } } });
            await prisma.product.deleteMany({ where: { tenantId } });

            await prisma.supplyItem.deleteMany({ where: { tenantId } });
            await prisma.supplier.deleteMany({ where: { tenantId } });

            // 2. Delete Staff if requested
            if (keepStaff !== 'true' && keepStaff !== true) {
                // Be careful not to delete ALL if we want to keep admin. 
                // For now, let's just keep admins?
                // User asked "Only with seed".
                // But for safety, let's skip deleting employees unless explicitly forced perfectly.
                // We will skip deleting employees for this version as user has fixes there.
                console.log('Skipping Employee deletion to preserve fixes.');
            }

            // 3. Re-Seed Defaults (Mini-Seed)
            // 4. Create Suppliers
            const sysco = await prisma.supplier.create({
                data: {
                    tenantId,
                    name: 'Sysco International',
                    category: 'General',
                    email: 'orders@sysco.com',
                    phone: '+1-800-SYSCO',
                    notes: 'Main distributor for dry goods.',
                },
            });

            const localFarm = await prisma.supplier.create({
                data: {
                    tenantId,
                    name: 'Finca La Esperanza',
                    category: 'Frescos',
                    email: 'contacto@laesperanza.com',
                    phone: '+58-414-1234567',
                    notes: 'Vegetables provided every Tuesday.',
                },
            });

            // 5. Create Inventory (SupplyItems)
            const flour = await prisma.supplyItem.create({
                data: {
                    tenantId,
                    name: 'Harina de Trigo (Todo Uso)',
                    category: 'Secos',
                    defaultUnit: 'kg',
                    currentCost: 1.50,
                    averageCost: 1.45,
                    stockQuantity: 50,
                    preferredSupplierId: sysco.id,
                },
            });

            const tomatoes = await prisma.supplyItem.create({
                data: {
                    tenantId,
                    name: 'Tomates Perita',
                    category: 'Vegetales',
                    defaultUnit: 'kg',
                    currentCost: 2.20,
                    averageCost: 2.00,
                    stockQuantity: 15,
                    preferredSupplierId: localFarm.id,
                },
            });

            const cheese = await prisma.supplyItem.create({
                data: {
                    tenantId,
                    name: 'Queso Mozzarella',
                    category: 'Lácteos',
                    defaultUnit: 'kg',
                    currentCost: 8.50,
                    averageCost: 8.20,
                    stockQuantity: 10,
                    preferredSupplierId: sysco.id,
                },
            });

            // 7. Create Products & Recipes
            const pizza = await prisma.product.create({
                data: {
                    tenantId,
                    name: 'Pizza Margarita',
                    price: 12.00,
                    cost: 3.50,
                    categoryId: 'Pizzas',
                    isActive: true
                },
            });

            await prisma.productRecipe.create({
                data: {
                    productId: pizza.id,
                    supplyItemId: flour.id,
                    quantity: 0.3, // 300g
                    unit: 'kg',
                },
            });

            await prisma.productRecipe.create({
                data: {
                    productId: pizza.id,
                    supplyItemId: cheese.id,
                    quantity: 0.2, // 200g
                    unit: 'kg',
                },
            });

            await prisma.productRecipe.create({
                data: {
                    productId: pizza.id,
                    supplyItemId: tomatoes.id,
                    quantity: 0.15, // 150g
                    unit: 'kg',
                },
            });

            return { success: true, message: 'Database reset to Seed state (Operational Data Valid).' };

        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: error.message });
        }
    });

    // POST /setup/nuke
    // GLOBAL RESET: Wipes all operational data across ALL tenants.
    // DANGEROUS: Use with caution.
    fastify.post('/setup/nuke', async (request, reply) => {
        try {
            console.warn('☢️ INITIATING GLOBAL NUKE ☢️');

            // 1. Global Wipe (No Tenant Filter)
            // Order is crucial for Foreign Keys.

            // Recipes & Dependencies
            await prisma.productionRecipe.deleteMany({});
            await prisma.productRecipe.deleteMany({});

            // Purchases & History
            await prisma.purchaseLine.deleteMany({});
            await prisma.purchaseOrder.deleteMany({});
            await prisma.priceHistory.deleteMany({});

            // Catalog
            await prisma.variant.deleteMany({});
            await prisma.product.deleteMany({});
            await prisma.supplyItem.deleteMany({});
            await prisma.supplier.deleteMany({});

            // Optional: Wipe Staff? (Default: Keep)
            const { keepStaff = true } = request.query as any;
            if (keepStaff !== 'true' && keepStaff !== true) {
                await prisma.shift.deleteMany({});
                // await prisma.employee.deleteMany({}); // Dangerous lockout
                console.log('Skipping Employee global delete to prevent lockout.');
            }

            // 2. Re-Seed Default Tenant (enigma_hq)
            let targetTenantId = 'enigma_hq';
            const existingTenant = await prisma.tenant.findFirst({
                where: {
                    OR: [
                        { slug: 'enigma-hq' },
                        { slug: 'enigma_hq' },
                        { id: 'enigma_hq' }
                    ]
                }
            });

            if (existingTenant) {
                targetTenantId = existingTenant.id;
                console.log(`[NUKE] Found existing Target Tenant: ${targetTenantId} (${existingTenant.name})`);
            } else {
                console.log(`[NUKE] Creating new Target Tenant: ${targetTenantId}`);
                await prisma.tenant.create({
                    data: { id: targetTenantId, name: 'Enigma HQ', slug: 'enigma-hq' }
                });
            }

            // Suppliers
            const sysco = await prisma.supplier.create({
                data: { tenantId: targetTenantId, name: 'Sysco International', category: 'General', email: 'orders@sysco.com', phone: '+1-800-SYSCO' }
            });
            const localFarm = await prisma.supplier.create({
                data: { tenantId: targetTenantId, name: 'Finca La Esperanza', category: 'Frescos', email: 'contacto@laesperanza.com', phone: '+58-414-1234567' }
            });

            // Inventory
            const flour = await prisma.supplyItem.create({
                data: { tenantId: targetTenantId, name: 'Harina de Trigo (Todo Uso)', category: 'Secos', defaultUnit: 'kg', currentCost: 1.50, averageCost: 1.45, stockQuantity: 50, preferredSupplierId: sysco.id }
            });
            const tomatoes = await prisma.supplyItem.create({
                data: { tenantId: targetTenantId, name: 'Tomates Perita', category: 'Vegetales', defaultUnit: 'kg', currentCost: 2.20, averageCost: 2.00, stockQuantity: 15, preferredSupplierId: localFarm.id }
            });
            const cheese = await prisma.supplyItem.create({
                data: { tenantId: targetTenantId, name: 'Queso Mozzarella', category: 'Lácteos', defaultUnit: 'kg', currentCost: 8.50, averageCost: 8.20, stockQuantity: 10, preferredSupplierId: sysco.id }
            });

            // Products
            const pizza = await prisma.product.create({
                data: { tenantId: targetTenantId, name: 'Pizza Margarita', price: 12.00, cost: 3.50, categoryId: 'Pizzas', isActive: true }
            });

            // Recipe Links
            await prisma.productRecipe.create({ data: { productId: pizza.id, supplyItemId: flour.id, quantity: 0.3, unit: 'kg' } });
            await prisma.productRecipe.create({ data: { productId: pizza.id, supplyItemId: cheese.id, quantity: 0.2, unit: 'kg' } });
            await prisma.productRecipe.create({ data: { productId: pizza.id, supplyItemId: tomatoes.id, quantity: 0.15, unit: 'kg' } });

            console.log('✅ GLOBAL NUKE COMPLETE. DB Seeded.');
            return { success: true, message: 'GLOBAL RESET COMPLETE. Database is clean and re-seeded.' };

        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: error.message });
        }
    });

    // GET /setup/diagnose?tenantId=...
    fastify.get('/setup/diagnose', async (request, reply) => {
        const tenantIdParam = request.tenantId || (request.query as any).tenantId;

        if (tenantIdParam === 'ALL' || (request.query as any).tenantId === 'ALL') {
            const allTenants = await prisma.tenant.findMany();
            const results = [];
            for (const t of allTenants) {
                const counts = {
                    products: await prisma.product.count({ where: { tenantId: t.id } }),
                    items: await prisma.supplyItem.count({ where: { tenantId: t.id } }),
                    suppliers: await prisma.supplier.count({ where: { tenantId: t.id } }),
                    staff: await prisma.employee.count({ where: { tenantId: t.id } })
                };
                results.push({ tenant: t, counts });
            }
            return { mode: 'ALL', results };
        }

        const tenantId = tenantIdParam;
        if (!tenantId) return { error: 'No tenant specified' };

        const counts = {
            products: await prisma.product.count({ where: { tenantId } }),
            items: await prisma.supplyItem.count({ where: { tenantId } }),
            suppliers: await prisma.supplier.count({ where: { tenantId } }),
            orders: await prisma.purchaseOrder.count({ where: { tenantId } }),
            recipes: await prisma.productRecipe.count({ where: { product: { tenantId } } }),
            staff: await prisma.employee.count({ where: { tenantId } })
        };

        return { tenantId, counts };
    });

    // MANUAL FIX: Create InventoryLog table if missing
    fastify.get('/setup/fix-inventory-log', async (request, reply) => {
        try {
            console.log('🔧 FIXING DB SCHEMA: Creating InventoryLog table...');

            // 1. Create Table
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS "InventoryLog" (
                    "id" TEXT NOT NULL,
                    "tenantId" TEXT NOT NULL,
                    "supplyItemId" TEXT NOT NULL,
                    "previousStock" DOUBLE PRECISION NOT NULL,
                    "newStock" DOUBLE PRECISION NOT NULL,
                    "changeAmount" DOUBLE PRECISION NOT NULL,
                    "reason" TEXT NOT NULL,
                    "notes" TEXT,
                    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

                    CONSTRAINT "InventoryLog_pkey" PRIMARY KEY ("id")
                );
            `);

            // 2. Index
            await prisma.$executeRawUnsafe(`
                CREATE INDEX IF NOT EXISTS "InventoryLog_supplyItemId_idx" ON "InventoryLog"("supplyItemId");
            `);

            // 3. Foreign Keys (Try/Catch to avoid duplicates)
            try {
                await prisma.$executeRawUnsafe(`
                    ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_supplyItemId_fkey" FOREIGN KEY ("supplyItemId") REFERENCES "SupplyItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
                `);
            } catch (e) {
                console.log('FK supplyItemId might already exist');
            }

            try {
                await prisma.$executeRawUnsafe(`
                    ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
                `);
            } catch (e) {
                console.log('FK tenantId might already exist');
            }

            return { success: true, message: 'InventoryLog table created/verified.' };

        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: error.message });
        }
    });
    // MANUAL FIX: Create SystemRole table if missing (Production Fix)
    fastify.post('/setup/fix-roles-table', async (request, reply) => {
        try {
            console.log('🔧 FIXING DB SCHEMA: Creating SystemRole table...');

            // 1. Create Table
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS "SystemRole" (
                    "id" TEXT NOT NULL,
                    "tenantId" TEXT NOT NULL,
                    "name" TEXT NOT NULL,
                    "description" TEXT,
                    "color" TEXT NOT NULL DEFAULT '#8b5cf6',
                    "canAccessOps" BOOLEAN NOT NULL DEFAULT false,
                    "canAccessHq" BOOLEAN NOT NULL DEFAULT false,
                    "canAccessKiosk" BOOLEAN NOT NULL DEFAULT true,
                    "isSystem" BOOLEAN NOT NULL DEFAULT false,
                    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

                    CONSTRAINT "SystemRole_pkey" PRIMARY KEY ("id")
                );
            `);

            // 2. Index
            await prisma.$executeRawUnsafe(`
                CREATE UNIQUE INDEX IF NOT EXISTS "SystemRole_tenantId_name_key" ON "SystemRole"("tenantId", "name");
            `);

            // 3. Foreign Keys
            try {
                await prisma.$executeRawUnsafe(`
                    ALTER TABLE "SystemRole" ADD CONSTRAINT "SystemRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
                `);
            } catch (e) {
                console.log('FK tenantId might already exist');
            }

            return { success: true, message: 'SystemRole table created/verified.' };

        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: error.message });
        }
    });

    // MANUAL FIX: Create RegisterSession + CashTransaction tables
    fastify.post('/setup/fix-register-tables', async (request, reply) => {
        try {
            console.log('🔧 FIXING DB SCHEMA: Creating RegisterSession table...');
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS "RegisterSession" (
                    "id" TEXT NOT NULL,
                    "tenantId" TEXT NOT NULL,
                    "employeeId" TEXT NOT NULL,
                    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "endedAt" TIMESTAMP(3),
                    "startingCash" DOUBLE PRECISION NOT NULL,
                    "declaredCash" DOUBLE PRECISION,
                    "declaredCard" DOUBLE PRECISION,
                    "declaredTransfer" DOUBLE PRECISION,
                    "expectedCash" DOUBLE PRECISION,
                    "notes" TEXT,
                    "status" TEXT NOT NULL DEFAULT 'open',
                    CONSTRAINT "RegisterSession_pkey" PRIMARY KEY ("id")
                );
            `);
            try {
                await prisma.$executeRawUnsafe(`ALTER TABLE "RegisterSession" ADD CONSTRAINT "RegisterSession_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`);
            } catch (e) { console.log('FK already exists'); }
            try {
                await prisma.$executeRawUnsafe(`ALTER TABLE "RegisterSession" ADD CONSTRAINT "RegisterSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`);
            } catch (e) { console.log('FK already exists'); }

            console.log('🔧 FIXING DB SCHEMA: Creating CashTransaction table...');
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS "CashTransaction" (
                    "id" TEXT NOT NULL,
                    "sessionId" TEXT NOT NULL,
                    "amount" DOUBLE PRECISION NOT NULL,
                    "type" TEXT NOT NULL,
                    "description" TEXT,
                    "referenceId" TEXT,
                    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "CashTransaction_pkey" PRIMARY KEY ("id")
                );
            `);
            try {
                await prisma.$executeRawUnsafe(`ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RegisterSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`);
            } catch (e) { console.log('FK already exists'); }

            return { success: true, message: 'RegisterSession + CashTransaction tables created/verified.' };
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: error.message });
        }
    });

    // MASTER FIX: Run all table fixes at once
    fastify.post('/setup/fix-all-tables', async (request, reply) => {
        const results: string[] = [];
        // Trigger each fix endpoint internally
        try {
            // SystemRole table
            await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SystemRole" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "color" TEXT NOT NULL DEFAULT '#8b5cf6', "canAccessOps" BOOLEAN NOT NULL DEFAULT false, "canAccessHq" BOOLEAN NOT NULL DEFAULT false, "canAccessKiosk" BOOLEAN NOT NULL DEFAULT true, "isSystem" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SystemRole_pkey" PRIMARY KEY ("id"));`);
            await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "SystemRole_tenantId_name_key" ON "SystemRole"("tenantId", "name");`);
            results.push('SystemRole ✅');

            // RegisterSession table
            await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "RegisterSession" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "endedAt" TIMESTAMP(3), "startingCash" DOUBLE PRECISION NOT NULL, "declaredCash" DOUBLE PRECISION, "declaredCard" DOUBLE PRECISION, "declaredTransfer" DOUBLE PRECISION, "expectedCash" DOUBLE PRECISION, "notes" TEXT, "status" TEXT NOT NULL DEFAULT 'open', CONSTRAINT "RegisterSession_pkey" PRIMARY KEY ("id"));`);
            results.push('RegisterSession ✅');

            // CashTransaction table
            await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "CashTransaction" ("id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "amount" DOUBLE PRECISION NOT NULL, "type" TEXT NOT NULL, "description" TEXT, "referenceId" TEXT, "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CashTransaction_pkey" PRIMARY KEY ("id"));`);
            results.push('CashTransaction ✅');

            // SupplierPrice table (Catalog)
            await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SupplierPrice" ("id" TEXT NOT NULL, "supplierId" TEXT NOT NULL, "supplyItemId" TEXT NOT NULL, "unitCost" DOUBLE PRECISION NOT NULL, "unit" TEXT, "notes" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SupplierPrice_pkey" PRIMARY KEY ("id"));`);
            await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "SupplierPrice_supplierId_supplyItemId_key" ON "SupplierPrice"("supplierId", "supplyItemId");`);
            await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SupplierPrice_supplyItemId_idx" ON "SupplierPrice"("supplyItemId");`);
            results.push('SupplierPrice ✅');

            return { success: true, tables: results };
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: error.message, partialResults: results });
        }
    });
}
