
import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { z } from 'zod';

export default async function salesRoutes(fastify: FastifyInstance) {

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Find the best open RegisterSession for a tenant+payment combination.
     *  Cash → PHYSICAL register  |  card/transfer → ELECTRONIC register
     *  Falls back to any open session if type-specific one isn't found. */
    async function resolveSession(
        tenantId: string,
        preferredId: string | undefined,
        paymentMethod: string
    ): Promise<string | null> {
        // 1. Try the explicitly provided sessionId
        if (preferredId) {
            const s = await prisma.registerSession.findUnique({ where: { id: preferredId } });
            if (s && s.status === 'open') return s.id;
        }

        // 2. Find by payment type
        const registerType = paymentMethod === 'cash' ? 'PHYSICAL' : 'ELECTRONIC';
        const byType = await prisma.registerSession.findFirst({
            where: { tenantId, status: 'open', registerType },
            orderBy: { startedAt: 'desc' },
        });
        if (byType) return byType.id;

        // 3. Fallback: any open session for this tenant
        const any = await prisma.registerSession.findFirst({
            where: { tenantId, status: 'open' },
            orderBy: { startedAt: 'desc' },
        });
        return any?.id ?? null;
    }

    /** Run inventory deduction for a set of sold items */
    async function deductInventory(tenantId: string, items: { productId: string; quantity: number; name?: string }[]) {
        for (const item of items) {
            const product = await prisma.product.findUnique({
                where: { id: item.productId },
                include: { recipes: { include: { supplyItem: true } } },
            });
            if (!product || product.recipes.length === 0) continue;
            for (const recipe of product.recipes) {
                const toDeduct = recipe.quantity * item.quantity;
                const current = await prisma.supplyItem.findUnique({ where: { id: recipe.supplyItemId } });
                const prev = current?.stockQuantity ?? 0;
                await prisma.supplyItem.update({
                    where: { id: recipe.supplyItemId },
                    data: { stockQuantity: { decrement: toDeduct } },
                });
                await prisma.inventoryLog.create({
                    data: {
                        tenantId,
                        supplyItemId: recipe.supplyItemId,
                        previousStock: prev,
                        newStock: prev - toDeduct,
                        changeAmount: -toDeduct,
                        reason: 'sale',
                        notes: `Sold ${item.quantity}x ${product.name}`,
                    },
                });
            }
        }
    }

    /** Update daily goals for completed sales */
    async function trackGoals(tenantId: string, employeeId: string, items: { productId: string; quantity: number }[], totalAmount: number) {
        const today = new Date().toISOString().split('T')[0];
        const goals = await prisma.dailyGoal.findMany({
            where: { tenantId, employeeId, date: today, status: 'ACTIVE' },
        });
        for (const goal of goals) {
            let increment = 0;
            if (goal.type === 'PRODUCT') {
                increment = items.filter(i => i.productId === goal.targetId).reduce((s, i) => s + i.quantity, 0);
            } else if (goal.type === 'CATEGORY') {
                for (const item of items) {
                    const p = await prisma.product.findUnique({ where: { id: item.productId }, select: { categoryId: true } });
                    if (p?.categoryId === goal.targetId) increment += item.quantity;
                }
            } else if (goal.type === 'REVENUE') {
                increment = totalAmount;
            }
            if (increment > 0) {
                const newQty = goal.currentQty + increment;
                const completed = newQty >= goal.targetQty;
                await prisma.dailyGoal.update({
                    where: { id: goal.id },
                    data: {
                        currentQty: newQty,
                        isCompleted: completed,
                        completedAt: completed && !goal.isCompleted ? new Date() : goal.completedAt,
                        status: completed ? 'COMPLETED' : 'ACTIVE',
                    },
                });
            }
        }
    }

    // ── Zod schema (sessionId now optional) ──────────────────────────────────
    const salesSchema = z.object({
        sessionId: z.string().optional(),
        items: z.array(z.object({
            productId: z.string(),
            quantity: z.number().int().positive(),
            price: z.number().min(0),
        })),
        paymentMethod: z.enum(['cash', 'card', 'transfer', 'other']),
        status: z.enum(['open', 'completed']).optional().default('completed'),
        tableId: z.string().optional(),
        tableName: z.string().optional(),
        ticketName: z.string().optional(),
        employeeId: z.string().optional(),
        notes: z.string().optional(),
    });

    // ── POST /sales ───────────────────────────────────────────────────────────
    fastify.post('/sales', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const { sessionId, items, paymentMethod, status, tableId, tableName, ticketName, employeeId, notes } = salesSchema.parse(request.body);

        // Resolve a valid session (required for DB FK + cash transactions)
        const resolvedSessionId = await resolveSession(tenantId, sessionId, paymentMethod);
        if (!resolvedSessionId) {
            return reply.status(400).send({
                error: 'No hay caja abierta. Abre la caja desde HQ antes de realizar ventas.',
                code: 'NO_OPEN_SESSION',
            });
        }

        const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

        const order = await prisma.salesOrder.create({
            data: {
                tenantId,
                sessionId: resolvedSessionId,
                totalAmount,
                paymentMethod,
                status: status || 'completed',
                tableId,
                tableName,
                ticketName,
                employeeId,
                notes,
                items: {
                    create: await Promise.all(items.map(async (item) => {
                        const product = await prisma.product.findUnique({ where: { id: item.productId } });
                        return {
                            productId: item.productId,
                            quantity: item.quantity,
                            unitPrice: item.price,
                            totalPrice: item.price * item.quantity,
                            productNameSnapshot: product?.name || 'Unknown Product',
                            kdsStation: product?.kdsStation || null,
                        };
                    })),
                },
            },
            include: { items: true },
        });

        // Completion side effects
        if (status === 'completed') {
            // Cash → physical register | transfer/card → electronic register
            if (paymentMethod === 'cash' || paymentMethod === 'card' || paymentMethod === 'transfer') {
                await prisma.cashTransaction.create({
                    data: {
                        sessionId: resolvedSessionId,
                        amount: totalAmount,
                        type: 'SALE',
                        description: `Venta #${order.id.slice(0, 8)}`,
                        referenceId: order.id,
                    },
                });
            }

            await deductInventory(tenantId, items.map(i => ({ productId: i.productId, quantity: i.quantity })));

            if (employeeId) {
                await trackGoals(tenantId, employeeId, items, totalAmount);
            }
        }

        return reply.send({ success: true, data: order });
    });

    // ── GET /sales/:id ────────────────────────────────────────────────────────
    fastify.get('/sales/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const order = await prisma.salesOrder.findUnique({
            where: { id },
            include: { items: true, table: true },
        });
        if (!order) return reply.status(404).send({ error: 'Order not found' });
        return reply.send({ success: true, data: order });
    });

    // ── GET /sales ────────────────────────────────────────────────────────────
    fastify.get('/sales', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const { status } = request.query as { status?: string };

        const where: any = { tenantId };
        if (status) {
            where.status = status.includes(',')
                ? { in: status.split(',').map((s: string) => s.trim()) }
                : status;
        }

        const sales = await prisma.salesOrder.findMany({
            where,
            include: { items: true, table: true },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        return reply.send({ success: true, data: sales });
    });

    // ── PUT /sales/:id — update or complete open ticket ───────────────────────
    fastify.put('/sales/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as any;
        const tenantId = request.tenantId || 'enigma_hq';

        const existing = await prisma.salesOrder.findUnique({
            where: { id },
            include: { items: true },
        });
        if (!existing) return reply.status(404).send({ error: 'Ticket not found' });

        const updateData: any = {};
        if (body.status) updateData.status = body.status;
        if (body.paymentMethod) updateData.paymentMethod = body.paymentMethod;
        if (body.tableId !== undefined) updateData.tableId = body.tableId;
        if (body.tableName !== undefined) updateData.tableName = body.tableName;
        if (body.ticketName !== undefined) updateData.ticketName = body.ticketName;
        if (body.notes !== undefined) updateData.notes = body.notes;
        if (body.totalAmount !== undefined) updateData.totalAmount = body.totalAmount;
        if (body.employeeId !== undefined) updateData.employeeId = body.employeeId;

        // Replace items if provided
        if (body.items && Array.isArray(body.items) && body.items.length > 0) {
            const itemsWithNames = await Promise.all(body.items.map(async (item: any) => {
                const product = await prisma.product.findUnique({ where: { id: item.productId } });
                return {
                    salesOrderId: id,
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.price,
                    totalPrice: item.price * item.quantity,
                    productNameSnapshot: product?.name || 'Unknown Product',
                    kdsStation: product?.kdsStation || null,
                };
            }));
            await prisma.salesItem.deleteMany({ where: { salesOrderId: id } });
            await prisma.salesItem.createMany({ data: itemsWithNames });
        }

        const updated = await prisma.salesOrder.update({
            where: { id },
            data: updateData,
            include: { items: true, table: true },
        });

        // Completion side effects — only when transitioning open → completed
        if (body.status === 'completed' && existing.status === 'open') {
            const itemsToProcess = (body.items && body.items.length > 0) ? body.items : existing.items.map((i: any) => ({
                productId: i.productId,
                quantity: i.quantity,
                price: i.unitPrice,
            }));
            const totalToRecord = body.totalAmount ?? existing.totalAmount;
            const payMethod = body.paymentMethod || existing.paymentMethod;
            const empId = body.employeeId || existing.employeeId;

            // Find the correct open register session
            const cashSessionId = await resolveSession(tenantId, existing.sessionId || undefined, payMethod);

            if (cashSessionId && (payMethod === 'cash' || payMethod === 'card' || payMethod === 'transfer')) {
                await prisma.cashTransaction.create({
                    data: {
                        sessionId: cashSessionId,
                        amount: totalToRecord,
                        type: 'SALE',
                        description: `Venta #${id.slice(0, 8)}${payMethod !== 'cash' ? ` (${payMethod})` : ''}`,
                        referenceId: id,
                    },
                });
            }

            // Update the order's sessionId to the resolved one (for reporting)
            if (cashSessionId && cashSessionId !== existing.sessionId) {
                await prisma.salesOrder.update({
                    where: { id },
                    data: { sessionId: cashSessionId },
                });
            }

            await deductInventory(tenantId, itemsToProcess.map((i: any) => ({
                productId: i.productId,
                quantity: i.quantity,
            })));

            if (empId) {
                await trackGoals(tenantId, empId, itemsToProcess, totalToRecord);
            }
        }

        return reply.send({ success: true, data: updated });
    });
}
