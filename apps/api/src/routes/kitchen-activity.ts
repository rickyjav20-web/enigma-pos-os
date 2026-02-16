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
                    metadata: metadata || null
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
}
