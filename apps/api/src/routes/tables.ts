
import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { z } from 'zod';

// Table status: libre → preparando → servida → revisar → sobremesa (cycle)
// Computed from open SalesOrders + KDS activity logs + TABLE_CHECK logs
type TableStatus = 'libre' | 'preparando' | 'servida' | 'revisar' | 'sobremesa' | 'ocupada_sin_kds';

// Defaults (overridden by TableFlowConfig)
const DEFAULT_REVIEW_THRESHOLD_MIN = 3;
const DEFAULT_SOBREMESA_MIN = 15;
const DEFAULT_DELIVERY_BUFFER_MIN = 1;

export default async function tablesRoutes(fastify: FastifyInstance) {

    // GET /tables — list all tables with live KDS-aware status
    fastify.get('/tables', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';

        // Load tenant flow config for thresholds
        const flowConfig = await prisma.tableFlowConfig.findUnique({ where: { tenantId } });
        const reviewThresholdMs = (flowConfig?.reviewThresholdMin ?? DEFAULT_REVIEW_THRESHOLD_MIN) * 60 * 1000;
        const sobremesaMs = (flowConfig?.sobremesaMin ?? DEFAULT_SOBREMESA_MIN) * 60 * 1000;
        const deliveryBufferMs = (flowConfig?.deliveryBufferMin ?? DEFAULT_DELIVERY_BUFFER_MIN) * 60 * 1000;

        const tables = await prisma.diningTable.findMany({
            where: { tenantId, isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            include: {
                salesOrders: {
                    where: { status: 'open' },
                    select: { id: true, ticketName: true, totalAmount: true, createdAt: true, guestCount: true, items: { select: { id: true } } },
                    take: 5,
                }
            }
        });

        // Batch-fetch today's KDS done items & orders for all open orders
        const openOrderIds = tables.flatMap(t => t.salesOrders.map(o => o.id));
        const allItemIds = tables.flatMap(t => t.salesOrders.flatMap(o => o.items.map(i => i.id)));

        let doneOrderIds = new Set<string>();
        let doneItemIds = new Set<string>();
        let doneTimestamps: Record<string, Date> = {};
        let tableCheckTimestamps: Record<string, Date> = {};

        const tableIds = tables.map(t => t.id);

        if (openOrderIds.length > 0 || tableIds.length > 0) {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const [orderDoneLogs, itemDoneLogs, tableCheckLogs] = await Promise.all([
                openOrderIds.length > 0 ? prisma.kitchenActivityLog.findMany({
                    where: { tenantId, action: 'ORDER_DONE', entityId: { in: openOrderIds }, createdAt: { gte: todayStart } },
                    select: { entityId: true, createdAt: true },
                }) : [],
                openOrderIds.length > 0 ? prisma.kitchenActivityLog.findMany({
                    where: { tenantId, action: 'ITEM_DONE', entityId: { in: allItemIds }, createdAt: { gte: todayStart } },
                    select: { entityId: true, createdAt: true },
                }) : [],
                // Fetch TABLE_CHECK logs to know when tables were last reviewed
                prisma.kitchenActivityLog.findMany({
                    where: { tenantId, action: 'TABLE_CHECK', entityType: 'DiningTable', entityId: { in: tableIds }, createdAt: { gte: todayStart } },
                    select: { entityId: true, createdAt: true },
                }),
            ]);

            doneOrderIds = new Set(orderDoneLogs.map(l => l.entityId!).filter(Boolean));
            doneItemIds = new Set(itemDoneLogs.map(l => l.entityId!).filter(Boolean));

            // Track when order was marked done (for review threshold)
            for (const log of orderDoneLogs) {
                if (log.entityId) doneTimestamps[log.entityId] = log.createdAt;
            }

            // Track latest TABLE_CHECK per table (resets review timer)
            for (const log of tableCheckLogs) {
                if (log.entityId) {
                    const prev = tableCheckTimestamps[log.entityId];
                    if (!prev || log.createdAt > prev) {
                        tableCheckTimestamps[log.entityId] = log.createdAt;
                    }
                }
            }
        }

        const now = Date.now();

        const result = tables.map(t => {
            const openOrders = t.salesOrders;
            const hasOpenOrder = openOrders.length > 0;

            if (!hasOpenOrder) {
                return {
                    id: t.id, name: t.name, zone: t.zone, capacity: t.capacity, sortOrder: t.sortOrder,
                    status: 'libre' as TableStatus, isOccupied: false, currentTicket: null,
                    itemsDone: 0, itemsTotal: 0, guestCount: null,
                };
            }

            const mainOrder = openOrders[0];
            const allItems = openOrders.flatMap(o => o.items);
            const totalItems = allItems.length;
            const doneItems = allItems.filter(i => doneItemIds.has(i.id)).length;

            // Determine status using intelligent flow:
            // libre → preparando → servida → [reviewThreshold] → revisar
            //   → [Revisada click] → sobremesa → [sobremesaMin] → revisar (cycle)
            // Auto-breaks: new items added → preparando | payment → libre
            let status: TableStatus;
            const allOrdersDone = openOrders.every(o => doneOrderIds.has(o.id));
            const allItemsDone = totalItems > 0 && doneItems === totalItems;
            const anyItemDone = doneItems > 0;

            if (totalItems === 0) {
                // Order exists but no items
                status = 'ocupada_sin_kds';
            } else if (!allItemsDone && !allOrdersDone) {
                // Not all items done — kitchen is working (includes new dessert round)
                status = anyItemDone ? 'preparando' : 'preparando';
            } else {
                // All items done — determine where we are in the post-serve flow
                const doneAt = openOrders.map(o => doneTimestamps[o.id]).filter(Boolean);
                const latestDone = doneAt.length > 0 ? Math.max(...doneAt.map(d => d.getTime())) : now;
                const elapsedSinceDone = now - latestDone;

                // Delivery buffer: food is in transit from kitchen to table
                if (deliveryBufferMs > 0 && elapsedSinceDone < deliveryBufferMs) {
                    status = 'preparando'; // still "in transit"
                } else {
                    const lastCheck = tableCheckTimestamps[t.id];
                    const hasBeenChecked = lastCheck && lastCheck.getTime() > latestDone;

                    if (hasBeenChecked) {
                        // Table was reviewed after serving — SOBREMESA or re-REVISAR
                        const elapsedSinceCheck = now - lastCheck.getTime();
                        status = elapsedSinceCheck > sobremesaMs ? 'revisar' : 'sobremesa';
                    } else {
                        // First serve, no check yet — SERVIDA or REVISAR
                        status = elapsedSinceDone > (deliveryBufferMs + reviewThresholdMs) ? 'revisar' : 'servida';
                    }
                }
            }

            // Sum guest counts across all open orders for this table
            const totalGuests = openOrders.reduce((sum, o) => sum + ((o as any).guestCount || 0), 0);
            // Total amount across all open orders
            const tableTotalAmount = openOrders.reduce((sum, o) => sum + o.totalAmount, 0);

            return {
                id: t.id, name: t.name, zone: t.zone, capacity: t.capacity, sortOrder: t.sortOrder,
                status,
                isOccupied: true,
                currentTicket: { id: mainOrder.id, ticketName: mainOrder.ticketName, totalAmount: mainOrder.totalAmount, createdAt: mainOrder.createdAt },
                itemsDone: doneItems,
                itemsTotal: totalItems,
                guestCount: totalGuests || null,
                totalAmount: tableTotalAmount,
            };
        });

        return reply.send({ success: true, data: result });
    });

    // POST /tables/:id/check — mark table as "reviewed" (clears revisar state)
    fastify.post('/tables/:id/check', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const { id } = request.params as { id: string };
        const { employeeId, employeeName } = request.body as { employeeId?: string; employeeName?: string };

        // Log the check action in kitchen activity
        await prisma.kitchenActivityLog.create({
            data: {
                tenantId,
                employeeId: employeeId || 'system',
                employeeName: employeeName || 'OPS',
                action: 'TABLE_CHECK',
                entityType: 'DiningTable',
                entityId: id,
                entityName: '',
            },
        });

        return reply.send({ success: true });
    });

    // POST /tables/:id/free — void open tickets and free a table
    fastify.post('/tables/:id/free', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const { id } = request.params as { id: string };
        const { employeeId, employeeName } = request.body as { employeeId?: string; employeeName?: string };

        // Find all open orders for this table
        const openOrders = await prisma.salesOrder.findMany({
            where: { tenantId, tableId: id, status: 'open' },
            select: { id: true },
        });

        if (openOrders.length === 0) {
            return reply.send({ success: true, message: 'Mesa ya estaba libre', voided: 0 });
        }

        // Void each open order (delete items + order)
        for (const order of openOrders) {
            await prisma.salesItem.deleteMany({ where: { salesOrderId: order.id } });
            await prisma.salesOrder.delete({ where: { id: order.id } });
        }

        // Log the action
        await prisma.kitchenActivityLog.create({
            data: {
                tenantId,
                employeeId: employeeId || 'system',
                employeeName: employeeName || 'OPS',
                action: 'TABLE_FREE',
                entityType: 'DiningTable',
                entityId: id,
                entityName: `Freed ${openOrders.length} ticket(s)`,
            },
        });

        return reply.send({ success: true, voided: openOrders.length });
    });

    // GET /tables/:id/detail — full table detail with order items
    fastify.get('/tables/:id/detail', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const { id } = request.params as { id: string };

        const table = await prisma.diningTable.findFirst({
            where: { id, tenantId, isActive: true },
        });

        if (!table) return reply.status(404).send({ success: false, message: 'Mesa no encontrada' });

        const ordersWithItems = await prisma.salesOrder.findMany({
            where: { tenantId, tableId: id, status: 'open' },
            orderBy: { createdAt: 'desc' },
            include: {
                items: {
                    select: {
                        id: true,
                        productNameSnapshot: true,
                        quantity: true,
                        unitPrice: true,
                        totalPrice: true,
                    },
                },
            },
        });

        return reply.send({
            success: true,
            data: {
                ...table,
                orders: ordersWithItems.map(o => ({
                    id: o.id,
                    ticketName: o.ticketName,
                    tableName: o.tableName,
                    totalAmount: o.totalAmount,
                    createdAt: o.createdAt,
                    employeeId: o.employeeId,
                    notes: o.notes,
                    items: o.items,
                })),
                totalAmount: ordersWithItems.reduce((sum, o) => sum + o.totalAmount, 0),
                totalItems: ordersWithItems.reduce((sum, o) => sum + o.items.length, 0),
            },
        });
    });

    // POST /tables — create table
    const createSchema = z.object({
        name: z.string().min(1),
        zone: z.string().nullable().optional(),
        capacity: z.number().int().positive().nullable().optional(),
        sortOrder: z.number().int().nullable().optional(),
    });

    fastify.post('/tables', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const { name, zone, capacity, sortOrder } = createSchema.parse(request.body);

        // Reactivate soft-deleted table if same name exists
        const existing = await prisma.diningTable.findUnique({
            where: { tenantId_name: { tenantId, name } },
        });

        if (existing && !existing.isActive) {
            const table = await prisma.diningTable.update({
                where: { id: existing.id },
                data: { isActive: true, zone: zone || null, capacity: capacity || null, sortOrder: sortOrder || 0 },
            });
            return reply.status(200).send({ success: true, data: table });
        }

        if (existing) {
            return reply.status(409).send({ success: false, message: `Ya existe una mesa con el nombre "${name}"` });
        }

        const table = await prisma.diningTable.create({
            data: { tenantId, name, zone: zone || null, capacity: capacity || null, sortOrder: sortOrder || 0 },
        });

        return reply.status(201).send({ success: true, data: table });
    });

    // PUT /tables/:id — update table
    fastify.put('/tables/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const tenantId = request.tenantId || 'enigma_hq';
        const body = request.body as any;

        // Verify table belongs to tenant
        const existing = await prisma.diningTable.findFirst({ where: { id, tenantId } });
        if (!existing) return reply.status(404).send({ success: false, message: 'Mesa no encontrada' });

        const table = await prisma.diningTable.update({
            where: { id },
            data: {
                name: body.name,
                zone: body.zone,
                capacity: body.capacity,
                sortOrder: body.sortOrder,
                isActive: body.isActive,
            },
        });

        return reply.send({ success: true, data: table });
    });

    // DELETE /tables/:id — soft delete
    fastify.delete('/tables/:id', async (request, reply) => {
        const { id } = request.params as { id: string };

        await prisma.diningTable.update({
            where: { id },
            data: { isActive: false },
        });

        return reply.send({ success: true });
    });

    // POST /tables/seed — seed default tables for a tenant
    fastify.post('/tables/seed', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';

        const defaults = [
            { name: 'Mesa 1', zone: 'Interior', capacity: 4, sortOrder: 1 },
            { name: 'Mesa 2', zone: 'Interior', capacity: 4, sortOrder: 2 },
            { name: 'Mesa 3', zone: 'Interior', capacity: 2, sortOrder: 3 },
            { name: 'Mesa 4', zone: 'Interior', capacity: 6, sortOrder: 4 },
            { name: 'Mesa 5', zone: 'Interior', capacity: 4, sortOrder: 5 },
            { name: 'Bar 1', zone: 'Bar', capacity: 2, sortOrder: 10 },
            { name: 'Bar 2', zone: 'Bar', capacity: 2, sortOrder: 11 },
            { name: 'Terraza 1', zone: 'Terraza', capacity: 4, sortOrder: 20 },
            { name: 'Terraza 2', zone: 'Terraza', capacity: 4, sortOrder: 21 },
            { name: 'Para Llevar', zone: 'Takeaway', capacity: null, sortOrder: 99 },
        ];

        const created = [];
        for (const d of defaults) {
            try {
                const table = await prisma.diningTable.create({
                    data: { tenantId, ...d },
                });
                created.push(table);
            } catch {
                // Skip duplicates (unique constraint)
            }
        }

        return reply.send({ success: true, count: created.length, data: created });
    });
}
