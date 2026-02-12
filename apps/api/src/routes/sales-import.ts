
import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { z } from 'zod';
import { parse } from 'csv-parse/sync';

// --- SCHEMAS ---

const PreviewSchema = z.object({
    csvContent: z.string(),
    mapping: z.object({
        sku: z.string().optional(),     // Column name for SKU
        quantity: z.string().optional(), // Column name for Qty
        productName: z.string().optional() // Column name for Name (fallback)
    }).optional()
});

const CommitSchema = z.object({
    fileName: z.string().optional(),
    source: z.string().optional(),
    events: z.array(z.object({
        sku: z.string().optional().nullable(),
        productName: z.string(),
        quantity: z.number(),
        timestamp: z.string().optional(), // ISO string
        uPrice: z.number().optional(),
        total: z.number().optional(),
        externalId: z.string().optional()
    }))
});

export default async function salesImportRoutes(fastify: FastifyInstance) {

    // POST /sales/preview
    // Parses CSV, validates against Products, returns preview data
    fastify.post('/sales/preview', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const result = PreviewSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({ error: "Invalid format", details: (result as any).error.errors });
        }

        const { csvContent } = result.data;

        try {
            // 1. Parse CSV
            const records = parse(csvContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                relax_column_count: true
            });

            if (records.length === 0) {
                return reply.status(400).send({ error: "CSV is empty or could not be parsed." });
            }

            // 2. Identify Columns (Auto-detect if not provided)
            // Loyverse Defaults: "SKU", "Item", "Quantity", "Gross Sales"
            const headers = Object.keys(records[0]);

            const colSku = headers.find(h => /sku/i.test(h)) || 'SKU';
            const colName = headers.find(h => /item|product|name|nombre/i.test(h)) || 'Item';
            const colQty = headers.find(h => /qty|quantity|cantidad/i.test(h)) || 'Quantity';
            const colPrice = headers.find(h => /gross|price|total|venta/i.test(h)) || 'Gross Sales';
            const colTime = headers.find(h => /date|time|fecha/i.test(h)) || 'Date';
            const colRef = headers.find(h => /receipt|ref|ticket/i.test(h)) || 'Receipt number';

            // 3. Process & Validate Rows
            const processedRows = [];
            const unknownSkus = new Set<string>();
            let totalSales = 0;

            // Fetch all products for validation
            const allProducts = await prisma.product.findMany({
                where: { tenantId },
                select: { id: true, sku: true, name: true, price: true }
            });

            // Map for quick lookup
            const productMap = new Map(); // SKU -> Product
            const nameMap = new Map();    // Name -> Product (Fallback)

            allProducts.forEach(p => {
                if (p.sku) productMap.set(p.sku.toLowerCase(), p);
                nameMap.set(p.name.toLowerCase(), p);
            });

            for (const row of records) {
                const rawSku = row[colSku]?.trim();
                const rawName = row[colName]?.trim();
                const qty = parseFloat(row[colQty] || '0');
                const price = parseFloat(row[colPrice] || '0'); // Usually Total Price in Loyverse

                if (!rawName && !rawSku) continue; // Skip empty rows

                let match = null;
                let status = 'VALID';

                // Try SKU Match
                if (rawSku && productMap.has(rawSku.toLowerCase())) {
                    match = productMap.get(rawSku.toLowerCase());
                }
                // Try Name Match
                else if (rawName && nameMap.has(rawName.toLowerCase())) {
                    match = nameMap.get(rawName.toLowerCase());
                }

                if (!match) {
                    status = 'UNKNOWN_PRODUCT';
                    if (rawSku) unknownSkus.add(rawSku);
                    else unknownSkus.add(rawName);
                }

                totalSales += price;

                processedRows.push({
                    sku: match?.sku || rawSku || null,
                    productName: match?.name || rawName,
                    quantity: qty,
                    total: price,
                    uPrice: qty > 0 ? price / qty : 0,
                    externalId: row[colRef] || null,
                    timestamp: row[colTime] ? new Date(row[colTime]).toISOString() : new Date().toISOString(),
                    status,
                    matchedId: match?.id || null
                });
            }

            return {
                validCount: processedRows.filter(r => r.status === 'VALID').length,
                warningCount: processedRows.filter(r => r.status !== 'VALID').length,
                totalSales,
                rows: processedRows, // Send all for now, or slice for pagination if massive
                unknownItems: Array.from(unknownSkus),
                detectedColumns: { colSku, colName, colQty, colPrice }
            };

        } catch (e: any) {
            console.error("CSV Parse Error", e);
            return reply.status(500).send({ error: "Failed to parse CSV", message: e.message });
        }
    });

    // POST /sales/commit
    // Saves the batch and events to DB
    fastify.post('/sales/commit', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const result = CommitSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({ error: "Invalid data", details: (result as any).error.errors });
        }

        const { events, fileName, source } = result.data;

        // Calculate totals
        const totalSales = events.reduce((acc, e) => acc + (e.total || 0), 0);
        const totalItems = events.reduce((acc, e) => acc + (e.quantity || 0), 0);

        try {
            // Transaction: Create Batch + Events
            const batch = await prisma.$transaction(async (tx) => {
                const newBatch = await tx.saleBatch.create({
                    data: {
                        tenantId,
                        fileName: fileName || `Upload ${new Date().toISOString()}`,
                        source: source || 'Import',
                        totalSales,
                        totalItems,
                        status: 'PENDING'
                    }
                });

                // Bulk Insert Events? Prisma createMany is supported.
                if (events.length > 0) {
                    await tx.saleEvent.createMany({
                        data: events.map(e => ({
                            tenantId,
                            batchId: newBatch.id,
                            sku: e.sku,
                            productName: e.productName,
                            quantity: e.quantity,
                            totalPrice: e.total,
                            unitPrice: e.uPrice,
                            externalId: e.externalId,
                            timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
                            status: 'PENDING'
                        }))
                    });
                }

                return newBatch;
            });

            return { success: true, batchId: batch.id, message: "Batch saved successfully. Ready for consumption." };

        } catch (e: any) {
            console.error("Commit Error", e);
            return reply.status(500).send({ error: "Failed to save batch", message: e.message });
        }
    });
}
