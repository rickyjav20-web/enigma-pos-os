
import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { z } from 'zod';

export default async function goalsRoutes(fastify: FastifyInstance) {

    // POST /goals — create daily goal
    const createSchema = z.object({
        employeeId: z.string(),
        date: z.string().optional(), // defaults to today
        type: z.enum(['PRODUCT', 'CATEGORY', 'REVENUE']),
        targetId: z.string().optional(),
        targetName: z.string(),
        targetQty: z.number().positive(),
        rewardType: z.enum(['POINTS', 'BONUS', 'BADGE']).optional(),
        rewardValue: z.number().optional(),
        rewardNote: z.string().optional(),
    });

    fastify.post('/goals', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const body = createSchema.parse(request.body);
        const date = body.date || new Date().toISOString().split('T')[0];

        const goal = await prisma.dailyGoal.create({
            data: {
                tenantId,
                employeeId: body.employeeId,
                date,
                type: body.type,
                targetId: body.targetId,
                targetName: body.targetName,
                targetQty: body.targetQty,
                rewardType: body.rewardType,
                rewardValue: body.rewardValue,
                rewardNote: body.rewardNote,
                createdBy: (request.body as any)?.createdBy || null,
            },
        });

        return reply.status(201).send({ success: true, data: goal });
    });

    // GET /goals — list goals with filters
    fastify.get('/goals', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const { date, employeeId, status } = request.query as {
            date?: string;
            employeeId?: string;
            status?: string;
        };

        const where: any = { tenantId };
        if (date) where.date = date;
        if (employeeId) where.employeeId = employeeId;
        if (status) where.status = status;

        // Default to today if no date specified
        if (!date && !employeeId) {
            where.date = new Date().toISOString().split('T')[0];
        }

        const goals = await prisma.dailyGoal.findMany({
            where,
            orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        });

        return reply.send({ success: true, data: goals });
    });

    // GET /goals/leaderboard — all employees progress for a date
    fastify.get('/goals/leaderboard', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const { date } = request.query as { date?: string };
        const targetDate = date || new Date().toISOString().split('T')[0];

        const goals = await prisma.dailyGoal.findMany({
            where: { tenantId, date: targetDate },
            orderBy: { currentQty: 'desc' },
        });

        // Group by employee
        const byEmployee: Record<string, { employeeId: string; goals: typeof goals; completed: number; total: number }> = {};
        for (const g of goals) {
            if (!byEmployee[g.employeeId]) {
                byEmployee[g.employeeId] = { employeeId: g.employeeId, goals: [], completed: 0, total: 0 };
            }
            byEmployee[g.employeeId].goals.push(g);
            byEmployee[g.employeeId].total++;
            if (g.isCompleted) byEmployee[g.employeeId].completed++;
        }

        // Get employee names
        const employeeIds = Object.keys(byEmployee);
        const employees = await prisma.employee.findMany({
            where: { id: { in: employeeIds } },
            select: { id: true, fullName: true },
        });
        const nameMap: Record<string, string> = {};
        employees.forEach(e => { nameMap[e.id] = e.fullName; });

        const leaderboard = Object.values(byEmployee).map(e => ({
            ...e,
            employeeName: nameMap[e.employeeId] || 'Unknown',
            completionRate: e.total > 0 ? Math.round((e.completed / e.total) * 100) : 0,
        })).sort((a, b) => b.completionRate - a.completionRate);

        return reply.send({ success: true, data: leaderboard });
    });

    // PUT /goals/:id — update goal
    fastify.put('/goals/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as any;

        const updateData: any = {};
        if (body.targetQty !== undefined) updateData.targetQty = body.targetQty;
        if (body.rewardType) updateData.rewardType = body.rewardType;
        if (body.rewardValue !== undefined) updateData.rewardValue = body.rewardValue;
        if (body.rewardNote !== undefined) updateData.rewardNote = body.rewardNote;
        if (body.status) updateData.status = body.status;
        if (body.currentQty !== undefined) {
            updateData.currentQty = body.currentQty;
            if (body.currentQty >= (body.targetQty || 0)) {
                updateData.isCompleted = true;
                updateData.completedAt = new Date();
                updateData.status = 'COMPLETED';
            }
        }

        const goal = await prisma.dailyGoal.update({
            where: { id },
            data: updateData,
        });

        return reply.send({ success: true, data: goal });
    });

    // DELETE /goals/:id
    fastify.delete('/goals/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        await prisma.dailyGoal.delete({ where: { id } });
        return reply.send({ success: true });
    });

    // POST /goals/batch — create multiple goals at once (for daily assignment)
    fastify.post('/goals/batch', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const { goals } = request.body as { goals: any[] };
        const date = new Date().toISOString().split('T')[0];

        const created = [];
        for (const g of goals) {
            const goal = await prisma.dailyGoal.create({
                data: {
                    tenantId,
                    employeeId: g.employeeId,
                    date: g.date || date,
                    type: g.type,
                    targetId: g.targetId,
                    targetName: g.targetName,
                    targetQty: g.targetQty,
                    rewardType: g.rewardType || 'POINTS',
                    rewardValue: g.rewardValue || 10,
                    rewardNote: g.rewardNote || '🎯 Meta cumplida',
                    createdBy: g.createdBy,
                },
            });
            created.push(goal);
        }

        return reply.status(201).send({ success: true, count: created.length, data: created });
    });
}
