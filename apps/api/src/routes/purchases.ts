import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { eventBus } from '../events/EventBus';
import { EventType } from '@enigma/types';
import { randomUUID } from 'crypto';

export default async function (fastify: FastifyInstance) {

    // --- SUPPLIERS ---

    fastify.get('/suppliers', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';

        const suppliers = await prisma.supplier.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' }
        });
        return suppliers;
    });

    fastify.post('/suppliers', async (request, reply) => {
        const { name, category, email, phone, address, notes } = request.body as any;
        if (!name || !name.trim()) return reply.status(400).send({ error: 'Supplier name is required' });

        const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const tenantId = request.tenantId || 'enigma_hq';

        // Dedup Check
        const existing = await prisma.supplier.findFirst({
            where: { normalizedName: normalized, tenantId }
        });

        if (existing) return reply.status(409).send({ error: 'A supplier with this name already exists', supplier: existing });

        const supplier = await prisma.supplier.create({
            data: {
                name: name.trim(),
                normalizedName: normalized,
                category: category || 'General',
                email: email || null,
                phone: phone || null,
                address: address || null,
                notes: notes || null,
                tenantId
            }
        });
        return supplier;
    });

    // --- DELETE SUPPLIER ---
    fastify.delete('/suppliers/:id', async (request, reply) => {
        const { id } = request.params as any;
        const existing = await prisma.supplier.findUnique({ where: { id } });
        if (!existing) return reply.status(404).send({ error: 'Supplier not found' });

        // Check if supplier has purchase orders
        const orderCount = await prisma.purchaseOrder.count({ where: { supplierId: id } });
        if (orderCount > 0) {
            return reply.status(400).send({
                error: `Cannot delete supplier with ${orderCount} purchase orders. Remove purchase history first.`
            });
        }

        await prisma.supplier.delete({ where: { id } });
        return { success: true, deleted: id };
    });

    fastify.get('/suppliers/:id', async (request, reply) => {
        const { id } = request.params as any;
        const supplier = await prisma.supplier.findUnique({
            where: { id },
            include: {
                purchaseOrders: {
                    orderBy: { date: 'desc' },
                    take: 10,
                    include: { lines: true }
                }
            }
        });

        if (!supplier) return reply.status(404).send({ error: "Supplier not found" });
        return supplier;
    });

    // --- UPDATE SUPPLIER ---
    fastify.patch('/suppliers/:id', async (request, reply) => {
        const { id } = request.params as any;
        const { name, category, email, phone, address, notes, isPreferred } = request.body as any;

        const existing = await prisma.supplier.findUnique({ where: { id } });
        if (!existing) return reply.status(404).send({ error: "Supplier not found" });

        const updated = await prisma.supplier.update({
            where: { id },
            data: {
                name: name ?? existing.name,
                normalizedName: name ? name.toLowerCase().replace(/[^a-z0-9]/g, '') : existing.normalizedName,
                category: category ?? existing.category,
                email: email ?? existing.email,
                phone: phone ?? existing.phone,
                address: address ?? existing.address,
                notes: notes ?? existing.notes,
            }
        });

        return updated;
    });

    // --- SUPPLIER ANALYTICS ---
    fastify.get('/suppliers/:id/analytics', async (request, reply) => {
        const { id } = request.params as any;

        // Get supplier with purchase orders
        const supplier = await prisma.supplier.findUnique({
            where: { id },
            include: {
                purchaseOrders: {
                    where: { status: 'confirmed' },
                    orderBy: { date: 'desc' },
                    include: {
                        lines: {
                            include: { supplyItem: true }
                        }
                    }
                }
            }
        });

        if (!supplier) return reply.status(404).send({ error: "Supplier not found" });

        const orders = supplier.purchaseOrders || [];

        // Core Metrics
        const totalPurchases = orders.length;
        const totalSpend = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const avgOrderValue = totalPurchases > 0 ? totalSpend / totalPurchases : 0;
        const lastPurchaseDate = orders.length > 0 ? orders[0].date : null;

        // Items analysis
        const itemMap = new Map<string, { name: string, count: number, totalSpent: number }>();
        for (const order of orders) {
            for (const line of order.lines) {
                const itemId = line.supplyItemId;
                const existing = itemMap.get(itemId) || {
                    name: line.supplyItem?.name || 'Unknown',
                    count: 0,
                    totalSpent: 0
                };
                existing.count += 1;
                existing.totalSpent += (line.unitCost * line.quantity);
                itemMap.set(itemId, existing);
            }
        }

        const topItems = Array.from(itemMap.entries())
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, 5);

        // Category breakdown
        const categoryMap = new Map<string, number>();
        for (const order of orders) {
            for (const line of order.lines) {
                const cat = line.supplyItem?.category || 'Other';
                categoryMap.set(cat, (categoryMap.get(cat) || 0) + (line.unitCost * line.quantity));
            }
        }
        const categoryBreakdown = Array.from(categoryMap.entries())
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount);

        // Price history for this supplier's items
        const priceHistory = await prisma.priceHistory.findMany({
            where: { supplierId: id },
            orderBy: { changeDate: 'desc' },
            take: 20,
            include: { supplyItem: { select: { name: true } } }
        });

        // Unique items count
        const uniqueItemsSupplied = itemMap.size;

        return {
            supplierId: id,
            supplierName: supplier.name,
            metrics: {
                totalPurchases,
                totalSpend: Math.round(totalSpend * 100) / 100,
                avgOrderValue: Math.round(avgOrderValue * 100) / 100,
                lastPurchaseDate,
                uniqueItemsSupplied
            },
            topItems,
            categoryBreakdown,
            priceHistory: priceHistory.map(h => ({
                itemName: h.supplyItem?.name,
                oldCost: h.oldCost,
                newCost: h.newCost,
                change: Math.round((h.newCost - h.oldCost) * 100) / 100,
                changePercent: h.oldCost > 0 ? Math.round(((h.newCost - h.oldCost) / h.oldCost) * 10000) / 100 : 0,
                date: h.changeDate
            })),
            recentOrders: orders.slice(0, 5).map(o => ({
                id: o.id,
                date: o.date,
                totalAmount: o.totalAmount,
                itemCount: o.lines.length
            }))
        };
    });

    // --- SUPPLIER PRICE CATALOG ---

    // GET /suppliers/:id/catalog - Get all catalog prices for a supplier
    fastify.get('/suppliers/:id/catalog', async (request, reply) => {
        const { id } = request.params as any;

        // 1. Get explicit catalog prices
        const catalog = await prisma.supplierPrice.findMany({
            where: { supplierId: id, isActive: true },
            include: { supplyItem: { select: { id: true, name: true, sku: true, category: true, defaultUnit: true, currentCost: true } } },
            orderBy: { supplyItem: { name: 'asc' } }
        });

        // 2. Get implicit prices from Purchase History (limit to last 200 items to be safe)
        // We want the LATEST price for each item bought from this supplier
        // FIX: Avoid using 'distinct' with relation orderBy as it can crash the DB driver/server
        const rawHistoryLines = await prisma.purchaseLine.findMany({
            where: {
                purchaseOrder: {
                    supplierId: id,
                    status: 'confirmed'
                }
            },
            orderBy: { purchaseOrder: { date: 'desc' } },
            take: 200,
            include: {
                supplyItem: { select: { id: true, name: true, sku: true, category: true, defaultUnit: true, currentCost: true } }
            }
        });

        // Manual distinct by supplyItemId
        const historyMap = new Map();
        for (const line of rawHistoryLines) {
            if (!historyMap.has(line.supplyItemId)) {
                historyMap.set(line.supplyItemId, line);
            }
        }
        const historyLines = Array.from(historyMap.values());

        // 3. Merge: Catalog takes precedence. If not in catalog, add from history.
        const catalogItemIds = new Set(catalog.map(c => c.supplyItemId));
        const virtualItems = historyLines
            .filter(h => !catalogItemIds.has(h.supplyItemId) && h.supplyItem) // Ensure item exists and not in catalog
            .map(h => ({
                id: `virtual-${h.supplyItemId}`, // Virtual ID
                supplierId: id,
                supplyItemId: h.supplyItemId,
                unitCost: h.unitCost,
                unit: null, // History lines might not have unit stored on line (it's on item), or maybe we should add it?
                notes: 'Derived from purchase history',
                isActive: true,
                isVirtual: true, // Marker for frontend
                updatedAt: new Date(), // Placeholder
                supplyItem: h.supplyItem
            }));

        // Combine and sort by name
        const combined = [...catalog, ...virtualItems].sort((a, b) =>
            (a.supplyItem?.name || '').localeCompare(b.supplyItem?.name || '')
        );

        return combined;
    });

    // POST /suppliers/:id/catalog - Add or update a single catalog price (upsert)
    fastify.post('/suppliers/:id/catalog', async (request, reply) => {
        const { id } = request.params as any;
        const { supplyItemId, unitCost, unit, notes } = request.body as any;

        if (!supplyItemId || unitCost === undefined) {
            return reply.status(400).send({ error: 'supplyItemId and unitCost are required' });
        }

        // Verify supplier and item exist
        const [supplier, item] = await Promise.all([
            prisma.supplier.findUnique({ where: { id } }),
            prisma.supplyItem.findUnique({ where: { id: supplyItemId } })
        ]);
        if (!supplier) return reply.status(404).send({ error: 'Supplier not found' });
        if (!item) return reply.status(404).send({ error: 'Supply item not found' });

        // Upsert: update if exists, create if not
        const price = await prisma.supplierPrice.upsert({
            where: { supplierId_supplyItemId: { supplierId: id, supplyItemId } },
            update: { unitCost: Number(unitCost), unit: unit || null, notes: notes || null, isActive: true },
            create: {
                supplierId: id,
                supplyItemId,
                unitCost: Number(unitCost),
                unit: unit || null,
                notes: notes || null
            },
            include: { supplyItem: { select: { id: true, name: true, sku: true, category: true } } }
        });
        return price;
    });

    // POST /suppliers/:id/catalog/bulk - Bulk import prices
    fastify.post('/suppliers/:id/catalog/bulk', async (request, reply) => {
        const { id } = request.params as any;
        const { items } = request.body as any; // [{supplyItemId, unitCost, unit?, notes?}]

        if (!Array.isArray(items) || items.length === 0) {
            return reply.status(400).send({ error: 'items array is required' });
        }

        const supplier = await prisma.supplier.findUnique({ where: { id } });
        if (!supplier) return reply.status(404).send({ error: 'Supplier not found' });

        const results = { created: 0, updated: 0, errors: [] as string[] };

        for (const entry of items) {
            try {
                if (!entry.supplyItemId || entry.unitCost === undefined) {
                    results.errors.push(`Missing supplyItemId or unitCost`);
                    continue;
                }
                await prisma.supplierPrice.upsert({
                    where: { supplierId_supplyItemId: { supplierId: id, supplyItemId: entry.supplyItemId } },
                    update: { unitCost: Number(entry.unitCost), unit: entry.unit || null, notes: entry.notes || null, isActive: true },
                    create: {
                        supplierId: id,
                        supplyItemId: entry.supplyItemId,
                        unitCost: Number(entry.unitCost),
                        unit: entry.unit || null,
                        notes: entry.notes || null
                    }
                });
                results.created++;
            } catch (e: any) {
                results.errors.push(`Item ${entry.supplyItemId}: ${e.message}`);
            }
        }

        return results;
    });

    // DELETE /suppliers/:id/catalog/:priceId - Remove a catalog price
    fastify.delete('/suppliers/:id/catalog/:priceId', async (request, reply) => {
        const { priceId } = request.params as any;
        try {
            await prisma.supplierPrice.delete({ where: { id: priceId } });
            return { success: true };
        } catch (e: any) {
            return reply.status(404).send({ error: 'Price entry not found' });
        }
    });

    // --- CATALOG / SUPPLY ITEMS ---
    // Moved to routes/supply-items.ts

    // --- INGEST CATALOG ---
    // compatible with Loyverse Export format for Ingredients/Items
    fastify.post('/ingest/catalog', async (request, reply) => {
        const { csv_content, tenantId } = request.body as any;

        if (!csv_content) return reply.status(400).send({ error: "Missing csv_content" });

        const activeTenant = tenantId || 'enigma_hq';

        try {
            // Use the Advanced Service
            const { productIngestService } = await import('../services/ProductIngestService');
            const result = await productIngestService.ingestLoyverseExport(csv_content, activeTenant);

            return {
                success: true,
                nodes_created: result.nodes,
                links_created: result.links,
                message: `Imported ${result.nodes} items and linked ${result.links} dependencies.`
            };
        } catch (e: any) {
            request.log.error(e);
            return reply.status(500).send({ error: "Ingest failed", details: e.message });
        }
    });

    // --- PURCHASE ORDERS ---

    fastify.get('/purchases', async (request, reply) => {
        const purchases = await prisma.purchaseOrder.findMany({
            include: { supplier: true, lines: true },
            orderBy: { date: 'desc' },
            take: 50
        });
        return purchases;
    });

    fastify.post('/purchases', async (request, reply) => {
        const { supplierId, items = [], tenantId, status, paymentMethod, registeredById,
                currency, totalAmountLocal, exchangeRate } = request.body as any;
        // items = [{ supplyItemId, quantity, unitCost }]
        // currency/totalAmountLocal/exchangeRate: optional multi-currency fields

        const totalAmount = items.reduce((acc: number, item: any) => acc + (item.quantity * item.unitCost), 0);

        const purchase = await prisma.purchaseOrder.create({
            data: {
                supplierId,
                tenantId: tenantId || 'enigma_hq',
                status: status || 'draft',
                paymentMethod: paymentMethod || 'cash',
                registeredById,
                totalAmount,
                currency: currency || 'USD',
                totalAmountLocal: totalAmountLocal || null,
                exchangeRate: exchangeRate || null,
                lines: {
                    create: items.map((item: any) => ({
                        supplyItemId: item.supplyItemId,
                        quantity: Number(item.quantity),
                        unitCost: Number(item.unitCost),
                        totalCost: Number(item.quantity) * Number(item.unitCost)
                    }))
                }
            },
            include: { lines: true, supplier: true }
        });

        // Loop for Logic: Update Costs if Confirmed
        if (purchase.status === 'confirmed') {
            for (const line of purchase.lines) {
                const item = await prisma.supplyItem.findUnique({ where: { id: line.supplyItemId } });
                if (item) {
                    // Calculate Weighted Average Cost
                    const currentStock = item.stockQuantity || 0;
                    const purchaseQty = line.quantity;
                    const purchaseCost = line.unitCost;

                    const oldCost = item.currentCost;
                    const newCost = purchaseCost;

                    const oldTotalValue = currentStock * item.averageCost;
                    const newTotalValue = purchaseQty * purchaseCost;
                    const newTotalStock = currentStock + purchaseQty;

                    const newAverageCost = newTotalStock > 0
                        ? (oldTotalValue + newTotalValue) / newTotalStock
                        : purchaseCost;

                    // Update Item: New Cost, Avg Cost, and Increment Stock
                    await prisma.supplyItem.update({
                        where: { id: item.id },
                        data: {
                            currentCost: purchaseCost,
                            averageCost: newAverageCost,
                            stockQuantity: { increment: purchaseQty },
                            lastPurchaseDate: new Date()
                        }
                    });

                    // Log History
                    if (Math.abs(oldCost - newCost) > 0.01) {
                        await prisma.priceHistory.create({
                            data: {
                                supplyItemId: item.id,
                                supplierId: purchase.supplierId,
                                purchaseLineId: line.id,
                                oldCost,
                                newCost
                            }
                        });
                    }
                }
            }

            // FIRE EVENT for RecipeService
            eventBus.publish({
                event_id: randomUUID(),
                tenant_id: purchase.tenantId,
                event_type: EventType.PURCHASE_ORDER_CONFIRMED,
                entity_type: 'purchase_order',
                entity_id: purchase.id,
                timestamp: Date.now(),
                actor_id: 'system', // or current user
                metadata: { purchaseOrderId: purchase.id },
                version: 1
            });

            // AUTOMATED CASH TRANSACTION (If Cash)
            if (purchase.paymentMethod === 'cash' && purchase.registeredById) {
                // Route to the correct register based on currency:
                // VES -> ELECTRONIC session, USD/COP -> PHYSICAL session
                const targetRegisterType = purchase.currency === 'VES' ? 'ELECTRONIC' : 'PHYSICAL';

                const activeSession = await prisma.registerSession.findFirst({
                    where: {
                        employeeId: purchase.registeredById,
                        status: 'open',
                        registerType: targetRegisterType
                    }
                });

                // Fallback: if no typed session found, try any open session
                const fallbackSession = activeSession || await prisma.registerSession.findFirst({
                    where: { employeeId: purchase.registeredById, status: 'open' }
                });

                if (fallbackSession) {
                    await prisma.cashTransaction.create({
                        data: {
                            sessionId: fallbackSession.id,
                            amount: -purchase.totalAmount, // Negative for outflow (USD)
                            type: 'PURCHASE',
                            description: `Compra Proveedor: ${purchase.supplier?.name || 'Desconocido'}`,
                            referenceId: purchase.id,
                            currency: purchase.currency || 'USD',
                            amountLocal: purchase.totalAmountLocal ? -purchase.totalAmountLocal : null,
                            exchangeRate: purchase.exchangeRate || null
                        }
                    });
                }
            }
        }

        return purchase;
    });

    // --- OPTIMIZER (Smart Shopping) ---

    fastify.post('/optimizer/analyze', async (request, reply) => {
        const { itemIds } = request.body as any; // Array of supplyItemId
        if (!itemIds || !Array.isArray(itemIds)) {
            return reply.status(400).send({ error: "Invalid itemIds provided" });
        }

        const plan: any = {}; // { supplierId: { name, items: [], totalEst } }

        for (const itemId of itemIds) {
            // Get Item Details
            const item = await prisma.supplyItem.findUnique({ where: { id: itemId } });
            if (!item) continue;

            // === PRIORITY 1: Check Supplier Price Catalog ===
            // Catalog prices represent current listed prices and take precedence
            const catalogPrices = await prisma.supplierPrice.findMany({
                where: { supplyItemId: itemId, isActive: true },
                include: { supplier: true }
            });

            // === PRIORITY 2: Check Purchase History (fallback) ===
            const lines = await prisma.purchaseLine.findMany({
                where: { supplyItemId: itemId },
                include: {
                    purchaseOrder: { include: { supplier: true } }
                },
                orderBy: { purchaseOrder: { date: 'desc' } },
                take: 20
            });

            // Build unified price map: supplierId -> { price, supplier, source, date }
            const supplierPrices: Record<string, { price: number, supplier: any, source: string, date: Date | null }> = {};

            // Add purchase history prices first (lower priority)
            for (const line of lines) {
                if (!line.purchaseOrder.supplier) continue;
                const sId = line.purchaseOrder.supplierId;
                if (!supplierPrices[sId]) {
                    supplierPrices[sId] = {
                        price: line.unitCost,
                        supplier: line.purchaseOrder.supplier,
                        source: 'purchase',
                        date: line.purchaseOrder.date
                    };
                }
            }

            // Overlay catalog prices (higher priority — overwrites purchase history)
            for (const cp of catalogPrices) {
                supplierPrices[cp.supplierId] = {
                    price: cp.unitCost,
                    supplier: cp.supplier,
                    source: 'catalog',
                    date: cp.updatedAt
                };
            }

            // 3. Select Best Supplier (lowest price)
            let bestSupplier: any = null;
            let bestPrice = Infinity;
            let bestDate: Date | null = null;
            let bestSource = 'fallback';

            const suppliers = Object.values(supplierPrices);

            if (suppliers.length > 0) {
                for (const s of suppliers) {
                    if (s.price < bestPrice) {
                        bestPrice = s.price;
                        bestSupplier = s.supplier;
                        bestDate = s.date;
                        bestSource = s.source;
                    }
                }
                if (bestSupplier) bestSupplier.lastDate = bestDate;

            } else {
                // Fallback: Use Item's current cost + Preferred Supplier (or generic)
                bestPrice = item.currentCost;
                if (item.preferredSupplierId) {
                    bestSupplier = await prisma.supplier.findUnique({ where: { id: item.preferredSupplierId } });
                }
            }

            // 4. Add to Plan
            if (!bestSupplier) {
                // Orphan item mechanism - Valid Fallback
                bestSupplier = {
                    id: 'unknown',
                    name: 'Proveedor General (Estimado)',
                    phone: '',
                    address: '',
                    email: ''
                };
            }

            if (!plan[bestSupplier.id]) {
                plan[bestSupplier.id] = {
                    supplierId: bestSupplier.id,
                    supplierName: bestSupplier.name,
                    supplierPhone: bestSupplier.phone || '',     // Ensure empty string if undefined (e.g. from partial object)
                    supplierAddress: bestSupplier.address || '',
                    supplierEmail: bestSupplier.email || '',
                    items: [],
                    totalEst: 0
                };
            }


            plan[bestSupplier.id].items.push({
                itemId: item.id,
                name: item.name,
                estCost: bestPrice,
                sku: item.sku,
                lastDate: bestSupplier.lastDate,
                averageCost: item.averageCost || 0,
                currentCost: item.currentCost || 0,
                source: bestSource
            });
            plan[bestSupplier.id].totalEst += bestPrice;
        }

        console.log('Optimizer Plan Result:', JSON.stringify(Object.values(plan), null, 2));
        return Object.values(plan);
    });
}
