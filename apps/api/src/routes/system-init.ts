
import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';

export default async function systemInitRoutes(fastify: FastifyInstance) {
    fastify.post('/system/init-sales-tables', async (request, reply) => {
        try {
            console.log("Initializing Sales Tables...");

            // 1. Create SaleBatch Table
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS "SaleBatch" (
                    "id" TEXT NOT NULL,
                    "tenantId" TEXT NOT NULL,
                    "status" TEXT NOT NULL DEFAULT 'PENDING',
                    "fileName" TEXT,
                    "source" TEXT,
                    "totalSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
                    "totalItems" DOUBLE PRECISION NOT NULL DEFAULT 0,
                    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "processedAt" TIMESTAMP(3),
                    CONSTRAINT "SaleBatch_pkey" PRIMARY KEY ("id")
                );
            `);

            // 2. Create SaleEvent Table
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS "SaleEvent" (
                    "id" TEXT NOT NULL,
                    "tenantId" TEXT NOT NULL,
                    "batchId" TEXT NOT NULL,
                    "sku" TEXT,
                    "productName" TEXT NOT NULL,
                    "quantity" DOUBLE PRECISION NOT NULL,
                    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
                    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
                    "externalId" TEXT,
                    "timestamp" TIMESTAMP(3) NOT NULL,
                    "status" TEXT NOT NULL DEFAULT 'PENDING',
                    "errorLog" TEXT,
                    
                    CONSTRAINT "SaleEvent_pkey" PRIMARY KEY ("id")
                );
            `);

            // 3. Add Foreign Key if it doesn't exist (This is tricky in raw SQL if not checking constraints, 
            // but we can try adding it and ignore error if exists, or just rely on application-level integrity for now 
            // to avoid complex migration logic manually).
            // Better to attempt it inside a try-catch for the constraint specifically.

            try {
                await prisma.$executeRawUnsafe(`
                    ALTER TABLE "SaleEvent" 
                    ADD CONSTRAINT "SaleEvent_batchId_fkey" 
                    FOREIGN KEY ("batchId") REFERENCES "SaleBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
                `);
            } catch (e) {
                console.log("Constraint might already exist, skipping.");
            }

            // 4. Update Tenant relations? No, that's virtual. 
            // ensure Tenant table exists? It should.

            return { success: true, message: "Sales tables initialized successfully." };

        } catch (e: any) {
            console.error("Init Error", e);
            return reply.status(500).send({ error: "Failed to init tables", message: e.message });
        }
    });
}
