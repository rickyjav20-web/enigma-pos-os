
import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { z } from 'zod';
import { detectSessionSmart, getLocalDateStr } from '../lib/detectSession';

/** Get local today for a tenant */
async function getTenantToday(tenantId: string): Promise<string> {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
    return getLocalDateStr(tenant?.timezone || 'America/Caracas');
}

export default async function goalsRoutes(fastify: FastifyInstance) {

    // POST /goals — create daily goal with session support
    const createSchema = z.object({
        employeeId: z.string(), // empty string = ALL employees
        date: z.string().optional(), // defaults to today
        session: z.enum(['MORNING', 'AFTERNOON', 'ALL_DAY']).optional().default('ALL_DAY'),
        sessionId: z.string().optional(), // LEGACY: RegisterSession ID
        type: z.enum(['PRODUCT', 'CATEGORY', 'REVENUE', 'MIXED']),
        targetId: z.string().optional(), // single productId or category
        targetIds: z.array(z.string()).optional(), // multiple productIds for MIXED
        targetName: z.string(),
        targetQty: z.number().positive(),
        rewardType: z.enum(['POINTS', 'BONUS', 'BADGE']).optional(),
        rewardValue: z.number().optional(),
        rewardNote: z.string().optional(),
    });

    fastify.post('/goals', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const body = createSchema.parse(request.body);
        const date = body.date || await getTenantToday(tenantId);

        const goal = await prisma.dailyGoal.create({
            data: {
                tenantId,
                employeeId: body.employeeId,
                date,
                session: body.session || 'ALL_DAY',
                sessionId: body.sessionId || null,
                type: body.type,
                targetId: body.targetId,
                targetIds: body.targetIds ?? Prisma.JsonNull,
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

    // GET /goals — list goals with filters + auto-session detection
    fastify.get('/goals', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const { date, employeeId, status, sessionId, session, autoSession } = request.query as {
            date?: string;
            employeeId?: string;
            status?: string;
            sessionId?: string;
            session?: string; // MORNING | AFTERNOON | ALL_DAY
            autoSession?: string; // "true" = auto-detect and filter
        };

        const where: any = { tenantId };
        if (date) where.date = date;
        if (employeeId) where.employeeId = employeeId;
        if (status) where.status = status;
        if (sessionId) where.sessionId = sessionId;
        if (session) where.session = session;

        // Default to today (tenant-local) if no date specified
        if (!date) {
            where.date = await getTenantToday(tenantId);
        }

        const goals = await prisma.dailyGoal.findMany({
            where,
            orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        });

        // If autoSession=true, filter to current session + ALL_DAY
        if (autoSession === 'true' && !session) {
            const currentSession = await detectSessionSmart(tenantId);
            const filtered = goals.filter(g =>
                g.session === 'ALL_DAY' || g.session === currentSession
            );
            // Also include goals assigned to ALL employees (employeeId = "")
            // if filtering by a specific employee
            if (employeeId) {
                const allEmployeeGoals = await prisma.dailyGoal.findMany({
                    where: {
                        tenantId,
                        employeeId: '',
                        date: where.date,
                        ...(status ? { status } : {}),
                    },
                    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
                });
                const allFiltered = allEmployeeGoals.filter(g =>
                    g.session === 'ALL_DAY' || g.session === currentSession
                );
                return reply.send({
                    success: true,
                    data: [...filtered, ...allFiltered],
                    currentSession,
                });
            }
            return reply.send({ success: true, data: filtered, currentSession });
        }

        return reply.send({ success: true, data: goals });
    });

    // GET /goals/session — detect current session (smart: based on register sessions)
    fastify.get('/goals/session', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const currentSession = await detectSessionSmart(tenantId);
        return reply.send({
            success: true,
            data: {
                currentSession,
                serverTime: new Date().toISOString(),
            },
        });
    });

    // GET /goals/leaderboard — all employees progress for a date
    fastify.get('/goals/leaderboard', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const { date, sessionId, session } = request.query as { date?: string; sessionId?: string; session?: string };
        const targetDate = date || await getTenantToday(tenantId);

        const where: any = { tenantId, date: targetDate };
        if (sessionId) where.sessionId = sessionId;

        const goals = await prisma.dailyGoal.findMany({
            where,
            orderBy: { currentQty: 'desc' },
        });

        // Filter by session: 'ALL' = show everything, otherwise filter to specific or auto-detected
        const currentSession = session || await detectSessionSmart(tenantId);
        const filteredGoals = session === 'ALL'
            ? goals
            : goals.filter(g => g.session === 'ALL_DAY' || g.session === currentSession);

        // Group by employee
        const byEmployee: Record<string, { employeeId: string; goals: typeof filteredGoals; completed: number; total: number }> = {};
        for (const g of filteredGoals) {
            const empKey = g.employeeId || '__ALL__';
            if (!byEmployee[empKey]) {
                byEmployee[empKey] = { employeeId: g.employeeId, goals: [], completed: 0, total: 0 };
            }
            byEmployee[empKey].goals.push(g);
            byEmployee[empKey].total++;
            if (g.isCompleted) byEmployee[empKey].completed++;
        }

        // Get employee names
        const employeeIds = Object.keys(byEmployee).filter(id => id && id !== '__ALL__');
        const employees = employeeIds.length > 0 ? await prisma.employee.findMany({
            where: { id: { in: employeeIds } },
            select: { id: true, fullName: true },
        }) : [];
        const nameMap: Record<string, string> = {};
        employees.forEach(e => { nameMap[e.id] = e.fullName; });

        const leaderboard = Object.values(byEmployee).map(e => ({
            ...e,
            employeeName: e.employeeId ? (nameMap[e.employeeId] || 'Unknown') : 'Todo el equipo',
            completionRate: e.total > 0 ? Math.round((e.completed / e.total) * 100) : 0,
        })).sort((a, b) => b.completionRate - a.completionRate);

        return reply.send({ success: true, data: leaderboard, currentSession });
    });

    // GET /goals/history — completed goals + accumulated rewards for an employee
    fastify.get('/goals/history', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const { employeeId, limit } = request.query as { employeeId?: string; limit?: string };

        const goals = await prisma.dailyGoal.findMany({
            where: {
                tenantId,
                ...(employeeId ? { employeeId } : {}),
                status: 'COMPLETED',
            },
            orderBy: { completedAt: 'desc' },
            take: parseInt(limit || '50'),
        });

        const totalRewards = goals.reduce((sum, g) => sum + (g.rewardValue || 0), 0);
        const totalCompleted = goals.length;

        return reply.send({
            success: true,
            data: { goals, totalRewards, totalCompleted },
        });
    });

    // PUT /goals/:id — update goal
    fastify.put('/goals/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as any;

        // Fetch current goal to check targetQty
        const current = await prisma.dailyGoal.findUnique({ where: { id } });
        if (!current) return reply.status(404).send({ success: false, message: 'Goal not found' });

        const updateData: any = {};
        if (body.targetQty !== undefined) updateData.targetQty = body.targetQty;
        if (body.rewardType) updateData.rewardType = body.rewardType;
        if (body.rewardValue !== undefined) updateData.rewardValue = body.rewardValue;
        if (body.rewardNote !== undefined) updateData.rewardNote = body.rewardNote;
        if (body.status) updateData.status = body.status;
        if (body.session) updateData.session = body.session;
        if (body.targetIds !== undefined) updateData.targetIds = body.targetIds;
        if (body.currentQty !== undefined) {
            updateData.currentQty = body.currentQty;
            const effectiveTarget = body.targetQty ?? current.targetQty;
            if (body.currentQty >= effectiveTarget) {
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
        const date = await getTenantToday(tenantId);

        const created = [];
        for (const g of goals) {
            const goal = await prisma.dailyGoal.create({
                data: {
                    tenantId,
                    employeeId: g.employeeId || '',
                    date: g.date || date,
                    session: g.session || 'ALL_DAY',
                    sessionId: g.sessionId || null,
                    type: g.type,
                    targetId: g.targetId,
                    targetIds: g.targetIds ?? Prisma.JsonNull,
                    targetName: g.targetName,
                    targetQty: g.targetQty,
                    rewardType: g.rewardType || 'BONUS',
                    rewardValue: g.rewardValue || 1.5,
                    rewardNote: g.rewardNote || 'Bono por meta',
                    createdBy: g.createdBy,
                },
            });
            created.push(goal);
        }

        return reply.status(201).send({ success: true, count: created.length, data: created });
    });

    // POST /goals/duplicate — copy goals from one date to another
    fastify.post('/goals/duplicate', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const { fromDate, toDate } = request.body as { fromDate: string; toDate?: string };
        const targetDate = toDate || await getTenantToday(tenantId);

        const sourceGoals = await prisma.dailyGoal.findMany({
            where: { tenantId, date: fromDate },
        });

        if (sourceGoals.length === 0) {
            return reply.status(404).send({ success: false, message: 'No goals found for source date' });
        }

        const created = [];
        for (const g of sourceGoals) {
            const goal = await prisma.dailyGoal.create({
                data: {
                    tenantId,
                    employeeId: g.employeeId,
                    date: targetDate,
                    session: g.session,
                    type: g.type,
                    targetId: g.targetId,
                    targetIds: g.targetIds ?? Prisma.JsonNull,
                    targetName: g.targetName,
                    targetQty: g.targetQty,
                    rewardType: g.rewardType,
                    rewardValue: g.rewardValue,
                    rewardNote: g.rewardNote,
                    createdBy: g.createdBy,
                },
            });
            created.push(goal);
        }

        return reply.status(201).send({ success: true, count: created.length, data: created });
    });
}
