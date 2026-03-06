import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';

export default async function kitchenActivityRoutes(fastify: FastifyInstance) {

    // POST /kitchen/activity — log a kitchen action
    fastify.post('/kitchen/activity', async (request, reply) => {
        try {
            const { employeeId, employeeName, action, entityType, entityId, entityName, quantity, unit, metadata } = request.body as any;
            const tenantId = request.tenantId || 'enigma_hq';

            if (!employeeId || !action) {
                return reply.status(400).send({ error: 'employeeId and action are required' });
            }

            // For ITEM_DONE: enrich with per-item prep time
            let enrichedMetadata = metadata || null;
            if (action === 'ITEM_DONE' && entityId && entityType === 'SalesItem') {
                try {
                    const item = await prisma.salesItem.findUnique({
                        where: { id: entityId },
                        include: { salesOrder: { select: { createdAt: true } } },
                    });
                    if (item?.salesOrder) {
                        const prepMs = Date.now() - new Date(item.salesOrder.createdAt).getTime();
                        enrichedMetadata = {
                            ...(metadata || {}),
                            orderCreatedAt: item.salesOrder.createdAt.toISOString(),
                            itemPrepTimeMs: prepMs,
                            itemPrepTimeMins: Math.round(prepMs / 60000),
                            productId: item.productId,
                        };
                    }
                } catch { /* non-critical */ }
            }

            // For ORDER_DONE: enrich metadata with prep time calculation
            if (action === 'ORDER_DONE' && entityId && entityType === 'SalesOrder') {
                try {
                    const order = await prisma.salesOrder.findUnique({
                        where: { id: entityId },
                        select: { createdAt: true, tableName: true, ticketName: true, items: { select: { productNameSnapshot: true, quantity: true } } },
                    });
                    if (order) {
                        const prepMs = Date.now() - new Date(order.createdAt).getTime();
                        const prepMins = Math.round(prepMs / 60000);
                        enrichedMetadata = {
                            ...(metadata || {}),
                            orderCreatedAt: order.createdAt.toISOString(),
                            prepTimeMs: prepMs,
                            prepTimeMins: prepMins,
                            itemCount: order.items.reduce((s: number, i: any) => s + i.quantity, 0),
                            itemNames: order.items.map((i: any) => i.productNameSnapshot),
                        };
                    }
                } catch { /* non-critical */ }
            }

            const log = await prisma.kitchenActivityLog.create({
                data: {
                    tenantId,
                    employeeId,
                    employeeName: employeeName || 'Unknown',
                    action,
                    entityType: entityType || null,
                    entityId: entityId || null,
                    entityName: entityName || null,
                    quantity: quantity ? Number(quantity) : null,
                    unit: unit || null,
                    metadata: enrichedMetadata,
                }
            });

            return { success: true, logId: log.id };
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: error.message });
        }
    });

    // GET /kitchen/activity — query activity logs
    fastify.get<{ Querystring: { employeeId?: string; action?: string; from?: string; to?: string; limit?: string } }>('/kitchen/activity', async (request, reply) => {
        try {
            const { employeeId, action, from, to, limit } = request.query;
            const tenantId = request.tenantId || 'enigma_hq';
            const take = limit ? parseInt(limit) : 100;

            const where: any = { tenantId };
            if (employeeId) where.employeeId = employeeId;
            if (action) where.action = action;
            if (from || to) {
                where.createdAt = {};
                if (from) where.createdAt.gte = new Date(from);
                if (to) where.createdAt.lte = new Date(to);
            }

            const logs = await prisma.kitchenActivityLog.findMany({
                where,
                take,
                orderBy: { createdAt: 'desc' }
            });

            return { success: true, count: logs.length, data: logs };
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: error.message });
        }
    });

    // GET /kitchen/analytics — aggregated metrics
    fastify.get<{ Querystring: { from?: string; to?: string } }>('/kitchen/analytics', async (request, reply) => {
        try {
            const { from, to } = request.query;
            const tenantId = request.tenantId || 'enigma_hq';

            const dateFilter: any = {};
            if (from) dateFilter.gte = new Date(from);
            if (to) dateFilter.lte = new Date(to);

            const baseWhere: any = { tenantId };
            if (from || to) baseWhere.createdAt = dateFilter;

            // 1. Total counts by action
            const actionCounts = await prisma.kitchenActivityLog.groupBy({
                by: ['action'],
                where: baseWhere,
                _count: { id: true }
            });

            // 2. Activity per employee
            const employeeActivity = await prisma.kitchenActivityLog.groupBy({
                by: ['employeeId', 'employeeName', 'action'],
                where: baseWhere,
                _count: { id: true },
                _sum: { quantity: true }
            });

            // 3. Most produced items
            const topProduced = await prisma.kitchenActivityLog.groupBy({
                by: ['entityId', 'entityName'],
                where: { ...baseWhere, action: 'PRODUCTION' },
                _count: { id: true },
                _sum: { quantity: true },
                orderBy: { _count: { id: 'desc' } },
                take: 10
            });

            // 4. Most wasted items
            const topWasted = await prisma.kitchenActivityLog.groupBy({
                by: ['entityId', 'entityName'],
                where: { ...baseWhere, action: 'WASTE' },
                _count: { id: true },
                _sum: { quantity: true },
                orderBy: { _count: { id: 'desc' } },
                take: 10
            });

            // 5. Login count per employee (attendance)
            const loginFrequency = await prisma.kitchenActivityLog.groupBy({
                by: ['employeeId', 'employeeName'],
                where: { ...baseWhere, action: 'LOGIN' },
                _count: { id: true }
            });

            // 6. Build employee scoreboard
            const employeeMap: Record<string, any> = {};
            for (const entry of employeeActivity) {
                const key = entry.employeeId;
                if (!employeeMap[key]) {
                    employeeMap[key] = {
                        employeeId: key,
                        employeeName: entry.employeeName,
                        productions: 0,
                        productionQuantity: 0,
                        wastes: 0,
                        wasteQuantity: 0,
                        logins: 0
                    };
                }
                if (entry.action === 'PRODUCTION') {
                    employeeMap[key].productions = entry._count.id;
                    employeeMap[key].productionQuantity = entry._sum.quantity || 0;
                } else if (entry.action === 'WASTE') {
                    employeeMap[key].wastes = entry._count.id;
                    employeeMap[key].wasteQuantity = entry._sum.quantity || 0;
                } else if (entry.action === 'LOGIN') {
                    employeeMap[key].logins = entry._count.id;
                }
            }

            // Add login data
            for (const login of loginFrequency) {
                const key = login.employeeId;
                if (employeeMap[key]) {
                    employeeMap[key].logins = login._count.id;
                }
            }

            // Calculate efficiency ratio
            const scoreboard = Object.values(employeeMap).map((e: any) => ({
                ...e,
                efficiencyRatio: e.wastes > 0 ? (e.productions / e.wastes).toFixed(2) : e.productions > 0 ? '∞' : '0'
            }));

            return {
                success: true,
                summary: {
                    totalActions: actionCounts.reduce((sum: number, a: any) => sum + a._count.id, 0),
                    byAction: actionCounts.map((a: any) => ({ action: a.action, count: a._count.id }))
                },
                topProduced: topProduced.map((p: any) => ({
                    entityId: p.entityId,
                    entityName: p.entityName,
                    count: p._count.id,
                    totalQuantity: p._sum.quantity
                })),
                topWasted: topWasted.map((w: any) => ({
                    entityId: w.entityId,
                    entityName: w.entityName,
                    count: w._count.id,
                    totalQuantity: w._sum.quantity
                })),
                employeeScoreboard: scoreboard
            };
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: error.message });
        }
    });

    // GET /kitchen/prep-times — avg prep time per item and per order
    fastify.get<{ Querystring: { from?: string; to?: string; days?: string } }>('/kitchen/prep-times', async (request, reply) => {
        try {
            const tenantId = request.tenantId || 'enigma_hq';
            const days = parseInt(request.query.days || '7');
            const from = request.query.from
                ? new Date(request.query.from)
                : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

            // Fetch all ORDER_DONE logs with prepTime in metadata
            const logs = await prisma.kitchenActivityLog.findMany({
                where: {
                    tenantId,
                    action: 'ORDER_DONE',
                    createdAt: { gte: from },
                },
                orderBy: { createdAt: 'desc' },
                take: 500,
            });

            const withPrepTime = logs.filter((l: any) => l.metadata && (l.metadata as any).prepTimeMins !== undefined);

            if (withPrepTime.length === 0) {
                return reply.send({ success: true, data: { avgPrepMins: null, totalOrders: 0, byItem: [], byHour: [] } });
            }

            const prepTimes = withPrepTime.map((l: any) => (l.metadata as any).prepTimeMins as number);
            const avgPrepMins = Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length);
            const minPrepMins = Math.min(...prepTimes);
            const maxPrepMins = Math.max(...prepTimes);

            // Breakdown by item name (from itemNames array in metadata)
            const itemTimes: Record<string, number[]> = {};
            for (const log of withPrepTime) {
                const meta = log.metadata as any;
                const mins = meta.prepTimeMins as number;
                const names: string[] = meta.itemNames || [];
                for (const name of names) {
                    if (!itemTimes[name]) itemTimes[name] = [];
                    itemTimes[name].push(mins);
                }
            }
            const byItem = Object.entries(itemTimes)
                .map(([name, times]) => ({
                    name,
                    avgPrepMins: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
                    orderCount: times.length,
                }))
                .sort((a, b) => b.avgPrepMins - a.avgPrepMins);

            // Breakdown by hour of day (when order was done)
            const byHour: Record<number, number[]> = {};
            for (const log of withPrepTime) {
                const h = new Date(log.createdAt).getHours();
                if (!byHour[h]) byHour[h] = [];
                byHour[h].push((log.metadata as any).prepTimeMins as number);
            }
            const byHourArr = Object.entries(byHour).map(([h, times]) => ({
                hour: parseInt(h),
                avgPrepMins: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
                count: times.length,
            })).sort((a, b) => a.hour - b.hour);

            return reply.send({
                success: true,
                data: {
                    avgPrepMins,
                    minPrepMins,
                    maxPrepMins,
                    totalOrders: withPrepTime.length,
                    byItem,
                    byHour: byHourArr,
                },
            });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: error.message });
        }
    });
}
