
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma';

export default async function registerRoutes(fastify: FastifyInstance) {

    // Helper: Get Tenant (uses middleware-resolved UUID, not raw header)
    const getTenant = (req: any) => req.tenantId as string;

    // --- OPEN REGISTER (DUAL: PHYSICAL + ELECTRONIC) ---
    const cashBreakdownSchema = z.object({
        startingCash: z.number().min(0),                 // USD equivalent total
        startingBreakdown: z.record(z.string(), z.any()).optional()  // { USD:20, COP:150000, rates:{COP:4200} }
    });

    const openSchema = z.object({
        employeeId: z.string(),
        physical: cashBreakdownSchema,
        electronic: cashBreakdownSchema
    });

    fastify.post('/register/open', async (request, reply) => {
        const tenantId = getTenant(request);
        const { employeeId, physical, electronic } = openSchema.parse(request.body);

        // Security: Check employee exists and belongs to tenant
        const employee = await prisma.employee.findFirst({
            where: { id: employeeId, tenantId, status: 'active' }
        });
        if (!employee) {
            return reply.status(403).send({ error: 'Employee not found or inactive' });
        }

        // Check if already has any open session (prevent double-open)
        const existing = await prisma.registerSession.findFirst({
            where: { employeeId, status: 'open' }
        });
        if (existing) {
            return reply.status(400).send({ error: 'Register already open for this user' });
        }

        // Validate amounts
        if (physical.startingCash > 100000 || electronic.startingCash > 100000) {
            return reply.status(400).send({ error: 'Starting cash amount exceeds maximum allowed' });
        }

        // Create both sessions atomically
        const [physicalSession, electronicSession] = await prisma.$transaction(async (tx) => {
            const phys = await tx.registerSession.create({
                data: {
                    tenantId,
                    employeeId,
                    registerType: 'PHYSICAL',
                    startingCash: physical.startingCash,
                    startingBreakdown: physical.startingBreakdown ?? undefined,
                    status: 'open'
                }
            });

            const elec = await tx.registerSession.create({
                data: {
                    tenantId,
                    employeeId,
                    registerType: 'ELECTRONIC',
                    startingCash: electronic.startingCash,
                    startingBreakdown: electronic.startingBreakdown ?? undefined,
                    linkedSessionId: phys.id,
                    status: 'open'
                }
            });

            // Link physical -> electronic
            await tx.registerSession.update({
                where: { id: phys.id },
                data: { linkedSessionId: elec.id }
            });

            return [phys, elec];
        });

        return { physicalSession, electronicSession };
    });

    // --- CLOSE REGISTER (one session at a time) ---
    const closeSchema = z.object({
        sessionId: z.string(),
        declaredCash: z.number().min(0),
        declaredCard: z.number().min(0),
        declaredTransfer: z.number().min(0),
        declaredBreakdown: z.record(z.string(), z.any()).optional(), // { USD:{amount,rate,usdEquiv}, COP:{...} }
        notes: z.string().optional()
    });

    fastify.post('/register/close', async (request, reply) => {
        const { sessionId, declaredCash, declaredCard, declaredTransfer, declaredBreakdown, notes } = closeSchema.parse(request.body);

        // Security: Verify session exists and is open
        const existingSession = await prisma.registerSession.findUnique({
            where: { id: sessionId },
            include: { transactions: true }
        });

        if (!existingSession) {
            return reply.status(404).send({ error: 'Session not found' });
        }

        if (existingSession.status === 'closed') {
            return reply.status(400).send({ error: 'Session already closed (cannot close twice)' });
        }

        // Calculate expected cash from transactions
        let expectedCash = existingSession.startingCash;
        for (const tx of existingSession.transactions) {
            expectedCash += tx.amount;
        }

        const difference = declaredCash - expectedCash;

        const session = await prisma.registerSession.update({
            where: { id: sessionId },
            data: {
                declaredCash,
                declaredCard,
                declaredTransfer,
                declaredBreakdown: declaredBreakdown ?? undefined,
                expectedCash,
                notes: notes || (Math.abs(difference) > 0.01
                    ? `Diferencia: $${difference.toFixed(2)}. ${notes || ''}`
                    : notes),
                status: 'closed',
                endedAt: new Date()
            }
        });

        return {
            ...session,
            audit: {
                expectedCash,
                declaredCash,
                difference,
                transactionCount: existingSession.transactions.length
            }
        };
    });

    // --- GET CURRENT STATUS (returns { physical, electronic }) ---
    fastify.get('/register/status/:employeeId', async (request, reply) => {
        const { employeeId } = request.params as { employeeId: string };

        const openSessions = await prisma.registerSession.findMany({
            where: { employeeId, status: 'open' }
        });

        if (openSessions.length === 0) {
            return { physical: null, electronic: null, status: 'closed' };
        }

        const physical = openSessions.find(s => s.registerType === 'PHYSICAL')
            || openSessions[0]; // backwards compat: legacy sessions have no type
        const electronic = openSessions.find(s => s.registerType === 'ELECTRONIC') || null;

        return { physical, electronic, status: 'open' };
    });

    // --- GET SESSION TOTALS ---
    fastify.get('/register/session-totals/:sessionId', async (request, reply) => {
        const { sessionId } = request.params as { sessionId: string };

        const session = await prisma.registerSession.findUnique({
            where: { id: sessionId }
        });

        if (!session) return reply.status(404).send({ error: 'Session not found' });

        // Calculate Purchases by Payment Method linked to this user/session time
        const purchases = await prisma.purchaseOrder.findMany({
            where: {
                registeredById: session.employeeId,
                date: {
                    gte: session.startedAt,
                    lte: session.endedAt || new Date()
                },
                status: 'confirmed'
            },
            select: {
                totalAmount: true,
                paymentMethod: true
            }
        });

        const totalCash = purchases
            .filter(p => p.paymentMethod === 'cash')
            .reduce((sum, p) => sum + p.totalAmount, 0);

        const totalTransfer = purchases
            .filter(p => p.paymentMethod === 'transfer')
            .reduce((sum, p) => sum + p.totalAmount, 0);

        return {
            totalCashPurchases: totalCash,
            totalTransferPurchases: totalTransfer,
            purchaseCount: purchases.length
        };
    });

    // ═══════════════════════════════════════════════════════════
    // ADMIN ENDPOINTS (HQ Back Office)
    // ═══════════════════════════════════════════════════════════

    // --- ALL SESSIONS (Admin View) ---
    fastify.get('/register/sessions', async (request, reply) => {
        const tenantId = getTenant(request);
        const { date, status, employeeId } = request.query as {
            date?: string;
            status?: string;
            employeeId?: string;
        };

        const where: any = { tenantId };

        // Filter by status
        if (status) where.status = status;

        // Filter by employee
        if (employeeId) where.employeeId = employeeId;

        // Filter by date (today by default)
        if (date) {
            const dayStart = new Date(date);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(date);
            dayEnd.setHours(23, 59, 59, 999);
            where.startedAt = { gte: dayStart, lte: dayEnd };
        }

        const sessions = await prisma.registerSession.findMany({
            where,
            include: {
                employee: {
                    select: { id: true, fullName: true, role: true }
                },
                transactions: {
                    select: {
                        id: true,
                        amount: true,
                        type: true,
                        description: true,
                        timestamp: true,
                        // Inventory Link
                        supplyItemId: true,
                        quantity: true,
                        unitCost: true,
                        supplyItem: {
                            select: { name: true, defaultUnit: true }
                        }
                    }
                }
            },
            orderBy: { startedAt: 'desc' }
        });

        return sessions.map(s => {
            const txTotal = s.transactions.reduce((sum, tx) => sum + tx.amount, 0);
            const calculated = s.startingCash + txTotal;
            const difference = s.declaredCash != null ? s.declaredCash - calculated : null;

            // Breakdown by type
            const breakdown = {
                sales: s.transactions.filter(t => t.type === 'SALE').reduce((sum, t) => sum + t.amount, 0),
                purchases: s.transactions.filter(t => t.type === 'PURCHASE').reduce((sum, t) => sum + t.amount, 0),
                expenses: s.transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0),
                deposits: s.transactions.filter(t => t.type === 'DEPOSIT').reduce((sum, t) => sum + t.amount, 0),
            };

            return {
                id: s.id,
                employee: s.employee,
                startedAt: s.startedAt,
                endedAt: s.endedAt,
                status: s.status,
                startingCash: s.startingCash,
                declaredCash: s.declaredCash,
                declaredCard: s.declaredCard,
                declaredTransfer: s.declaredTransfer,
                expectedCash: s.expectedCash ?? calculated,
                difference,
                notes: s.notes,
                breakdown,
                transactionCount: s.transactions.length,
                transactions: s.transactions
            };
        });
    });

    // --- DAILY SUMMARY (aggregate) ---
    fastify.get('/register/sessions/daily-summary', async (request, reply) => {
        const tenantId = getTenant(request);
        const { date } = request.query as { date?: string };

        const targetDate = date ? new Date(date) : new Date();
        const dayStart = new Date(targetDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(targetDate);
        dayEnd.setHours(23, 59, 59, 999);

        const sessions = await prisma.registerSession.findMany({
            where: {
                tenantId,
                startedAt: { gte: dayStart, lte: dayEnd }
            },
            include: {
                employee: { select: { fullName: true } },
                transactions: true
            }
        });

        const closedSessions = sessions.filter(s => s.status === 'closed');
        const openSessions = sessions.filter(s => s.status === 'open');

        let totalSales = 0;
        let totalPurchases = 0;
        let totalExpenses = 0;
        let totalDeposits = 0;
        let totalDifference = 0;
        let totalDeclaredCash = 0;
        let totalExpectedCash = 0;

        for (const s of sessions) {
            for (const tx of s.transactions) {
                if (tx.type === 'SALE') totalSales += tx.amount;
                if (tx.type === 'PURCHASE') totalPurchases += tx.amount;
                if (tx.type === 'EXPENSE') totalExpenses += tx.amount;
                if (tx.type === 'DEPOSIT') totalDeposits += tx.amount;
            }
        }

        for (const s of closedSessions) {
            const txTotal = s.transactions.reduce((sum, tx) => sum + tx.amount, 0);
            const expected = s.startingCash + txTotal;
            totalExpectedCash += expected;
            totalDeclaredCash += s.declaredCash || 0;
            totalDifference += (s.declaredCash || 0) - expected;
        }

        return {
            date: targetDate.toISOString().slice(0, 10),
            totalSessions: sessions.length,
            closedSessions: closedSessions.length,
            openSessions: openSessions.length,
            totalSales,
            totalPurchases,
            totalExpenses,
            totalDeposits,
            totalDeclaredCash,
            totalExpectedCash,
            totalDifference,
            sessions: sessions.map(s => ({
                id: s.id,
                employee: s.employee.fullName,
                status: s.status,
                startedAt: s.startedAt,
                endedAt: s.endedAt
            }))
        };
    });

    // --- CASHIER STATS (error rates, patterns) ---
    fastify.get('/register/cashier-stats', async (request, reply) => {
        const tenantId = getTenant(request);
        const { days } = request.query as { days?: string };
        const lookbackDays = parseInt(days || '30');

        const since = new Date();
        since.setDate(since.getDate() - lookbackDays);

        const closedSessions = await prisma.registerSession.findMany({
            where: {
                tenantId,
                status: 'closed',
                startedAt: { gte: since }
            },
            include: {
                employee: { select: { id: true, fullName: true, role: true } },
                transactions: true
            }
        });

        // Group by employee
        const byEmployee = new Map<string, typeof closedSessions>();
        for (const s of closedSessions) {
            const key = s.employeeId;
            if (!byEmployee.has(key)) byEmployee.set(key, []);
            byEmployee.get(key)!.push(s);
        }

        const stats = Array.from(byEmployee.entries()).map(([empId, sessions]) => {
            let totalDifference = 0;
            let totalAbsDifference = 0;
            let perfectCloses = 0;
            let totalSales = 0;
            let totalTransactions = 0;

            for (const s of sessions) {
                const txTotal = s.transactions.reduce((sum, tx) => sum + tx.amount, 0);
                const expected = s.startingCash + txTotal;
                const diff = (s.declaredCash || 0) - expected;

                totalDifference += diff;
                totalAbsDifference += Math.abs(diff);
                if (Math.abs(diff) < 0.01) perfectCloses++;

                totalSales += s.transactions.filter(t => t.type === 'SALE').reduce((sum, t) => sum + t.amount, 0);
                totalTransactions += s.transactions.length;
            }

            const accuracy = sessions.length > 0
                ? ((perfectCloses / sessions.length) * 100)
                : 0;

            return {
                employee: sessions[0].employee,
                totalSessions: sessions.length,
                perfectCloses,
                accuracy: Math.round(accuracy * 10) / 10,
                avgDifference: sessions.length > 0 ? totalDifference / sessions.length : 0,
                avgAbsDifference: sessions.length > 0 ? totalAbsDifference / sessions.length : 0,
                totalSales,
                totalTransactions,
                lastSession: sessions[0].endedAt
            };
        });

        // Sort by accuracy descending
        stats.sort((a, b) => b.accuracy - a.accuracy);

        return {
            period: `${lookbackDays} days`,
            since: since.toISOString(),
            cashiers: stats
        };
    });

    // --- KEY: TRANSACTION WITH INVENTORY LOGIC ---
    const transactionSchema = z.object({
        sessionId: z.string(),
        amount: z.number(),        // USD equivalent (always)
        type: z.enum(['SALE', 'PURCHASE', 'EXPENSE', 'DEPOSIT', 'WITHDRAWAL']),
        description: z.string(),
        // Multi-currency fields
        currency: z.string().default('USD'),       // 'USD', 'VES', 'COP'
        amountLocal: z.number().optional().nullable(),  // amount in local currency
        exchangeRate: z.number().optional().nullable(), // rate used
        // Inventory linkage
        supplyItemId: z.string().optional(),
        quantity: z.number().optional().nullable(),
        unitCost: z.number().optional().nullable()
    });

    fastify.post('/register/transaction', async (request, reply) => {
        const tenantId = getTenant(request);
        const data = transactionSchema.parse(request.body);

        const session = await prisma.registerSession.findUnique({
            where: { id: data.sessionId }
        });
        if (!session) return reply.status(404).send({ error: 'Session not found' });

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Transaction
            const transaction = await tx.cashTransaction.create({
                data: {
                    sessionId: data.sessionId,
                    amount: data.amount,
                    type: data.type,
                    description: data.description,
                    currency: data.currency || 'USD',
                    amountLocal: data.amountLocal || null,
                    exchangeRate: data.exchangeRate || null,
                    supplyItemId: data.supplyItemId,
                    quantity: data.quantity || null,
                    unitCost: data.unitCost || null,
                }
            });

            // 2. Inventory Logic
            if (data.supplyItemId && data.quantity) {
                const item = await tx.supplyItem.findUnique({ where: { id: data.supplyItemId } });
                if (item) {
                    const newStock = (item.stockQuantity || 0) + data.quantity;

                    // Update Stock & Cost
                    await tx.supplyItem.update({
                        where: { id: data.supplyItemId },
                        data: {
                            stockQuantity: newStock,
                            currentCost: data.unitCost ? data.unitCost : undefined,
                            lastPurchaseDate: new Date()
                        }
                    });

                    // Track Price History for Smart Shopper (if cost is provided)
                    if (data.unitCost && item.currentCost !== data.unitCost) {
                        await tx.priceHistory.create({
                            data: {
                                supplyItemId: data.supplyItemId,
                                oldCost: item.currentCost || 0,
                                newCost: data.unitCost,
                                changeDate: new Date(),
                                supplierId: item.preferredSupplierId
                            }
                        });
                    }

                    // Log
                    console.log(`[Transaction] Creating InventoryLog for ${data.supplyItemId}. Qty: ${data.quantity}`);
                    await tx.inventoryLog.create({
                        data: {
                            tenantId,
                            supplyItemId: data.supplyItemId,
                            previousStock: item.stockQuantity || 0,
                            newStock,
                            changeAmount: data.quantity,
                            reason: 'PURCHASE',
                            notes: `Compra Caja: ${data.description}`
                        }
                    });
                }
            }
            return transaction;
        });

        // 3. Post-Transaction: Recalculate Recipe Costs (Async/Safe)
        if (data.supplyItemId && data.unitCost) {
            try {
                // Import locally to avoid circular dependency issues if any, though likely fine at top
                const { recipeService } = require('../services/RecipeService');
                // We can run this without awaiting if we don't want to block the UI, 
                // but for data integrity usually better to await or use a job queue.
                // Given the scale, awaiting is fine (~50ms).
                await recipeService.recalculateSupplyItemCost(data.supplyItemId);
            } catch (e) {
                console.error("[Register] Failed to recalculate recipe costs", e);
            }
        }

        return result;
    });
}
