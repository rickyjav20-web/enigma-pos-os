
import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';

async function initSalesTables() {
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

    // 3. Add Foreign Key
    try {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "SaleEvent" 
            ADD CONSTRAINT "SaleEvent_batchId_fkey" 
            FOREIGN KEY ("batchId") REFERENCES "SaleBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        `);
    } catch (e) {
        console.log("Constraint might already exist, skipping.");
    }

    return { success: true, message: "Sales tables initialized successfully." };
}

export default async function systemInitRoutes(fastify: FastifyInstance) {
    const handler = async (request: any, reply: any) => {
        try {
            const result = await initSalesTables();
            return result;
        } catch (e: any) {
            console.error("Init Error", e);
            return reply.status(500).send({ error: "Failed to init tables", message: e.message });
        }
    };

    fastify.post('/system/init-sales-tables', handler);
    fastify.get('/system/init-sales-tables', handler);
}
