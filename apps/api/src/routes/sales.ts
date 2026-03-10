
import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { z } from 'zod';
import { logAudit } from '../lib/audit';
import { detectSessionSmart, getLocalDateStr } from '../lib/detectSession';

export default async function salesRoutes(fastify: FastifyInstance) {

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Find the best open RegisterSession for a tenant+payment combination.
     *  Cash → PHYSICAL register  |  card/transfer → ELECTRONIC register
     *  The preferredId is only used if it matches the expected register type.
     *  Falls back to any open session if type-specific one isn't found. */
    async function resolveSession(
        tenantId: string,
        preferredId: string | undefined,
        paymentMethod: string
    ): Promise<string | null> {
        const expectedType = paymentMethod === 'cash' ? 'PHYSICAL' : 'ELECTRONIC';

        // 1. Try the explicitly provided sessionId ONLY if it matches the expected type
        if (preferredId) {
            const s = await prisma.registerSession.findUnique({ where: { id: preferredId } });
            if (s && s.status === 'open' && s.registerType === expectedType) return s.id;
        }

        // 2. Find open session by payment type
        const byType = await prisma.registerSession.findFirst({
            where: { tenantId, status: 'open', registerType: expectedType },
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

    /** Run inventory deduction for a set of sold items (atomic transaction) */
    async function deductInventory(tenantId: string, items: { productId: string; quantity: number; name?: string }[]) {
        await prisma.$transaction(async (tx) => {
            for (const item of items) {
                const product = await tx.product.findUnique({
                    where: { id: item.productId },
                    include: { recipes: { include: { supplyItem: true } } },
                });
                if (!product || product.recipes.length === 0) continue;
                for (const recipe of product.recipes) {
                    const toDeduct = recipe.quantity * item.quantity;
                    const current = await tx.supplyItem.findUnique({ where: { id: recipe.supplyItemId } });
                    const prev = current?.stockQuantity ?? 0;
                    await tx.supplyItem.update({
                        where: { id: recipe.supplyItemId },
                        data: { stockQuantity: { decrement: toDeduct } },
                    });
                    await tx.inventoryLog.create({
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
        });
    }

    /** Update daily goals for completed sales */
    async function trackGoals(tenantId: string, employeeId: string, items: { productId: string; quantity: number }[], totalAmount: number, sessionId?: string) {
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
        const today = getLocalDateStr(tenant?.timezone || 'America/Caracas');
        const currentSession = await detectSessionSmart(tenantId);

        // Fetch goals for this employee + goals assigned to ALL employees (employeeId = "")
        const goals = await prisma.dailyGoal.findMany({
            where: {
                tenantId,
                employeeId: { in: [employeeId, ''] },
                date: today,
                status: 'ACTIVE',
            },
        });

        for (const goal of goals) {
            // Session filter: skip goals that don't match current session
            if (goal.session !== 'ALL_DAY' && goal.session !== currentSession) continue;
            // Legacy session ID filter
            if (goal.sessionId && goal.sessionId !== sessionId) continue;

            let increment = 0;
            if (goal.type === 'PRODUCT') {
                increment = items.filter(i => i.productId === goal.targetId).reduce((s, i) => s + i.quantity, 0);
            } else if (goal.type === 'MIXED') {
                // Mixed: match any of the targetIds array
                const targetIds = (goal.targetIds as string[] | null) || [];
                increment = items.filter(i => targetIds.includes(i.productId)).reduce((s, i) => s + i.quantity, 0);
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

        // Server-side price verification: use DB prices, not client-provided ones
        const verifiedItems = await Promise.all(items.map(async (item) => {
            const product = await prisma.product.findUnique({ where: { id: item.productId } });
            if (!product) throw new Error(`Product ${item.productId} not found`);
            return {
                productId: item.productId,
                quantity: item.quantity,
                price: product.price, // Use DB price, not client price
                name: product.name,
                kdsStation: product.kdsStation || null,
            };
        }));

        const totalAmount = verifiedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

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
                    create: verifiedItems.map(item => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.price,
                        totalPrice: item.price * item.quantity,
                        productNameSnapshot: item.name,
                        kdsStation: item.kdsStation,
                    })),
                },
            },
            include: { items: true },
        });

        // Completion side effects (atomic)
        if (status === 'completed') {
            await prisma.$transaction(async (tx) => {
                if (paymentMethod === 'cash' || paymentMethod === 'card' || paymentMethod === 'transfer') {
                    await tx.cashTransaction.create({
                        data: {
                            sessionId: resolvedSessionId,
                            amount: totalAmount,
                            type: 'SALE',
                            description: `Venta #${order.id.slice(0, 8)}`,
                            referenceId: order.id,
                        },
                    });
                }
            });

            await deductInventory(tenantId, verifiedItems.map(i => ({ productId: i.productId, quantity: i.quantity })));

            if (employeeId) {
                await trackGoals(tenantId, employeeId, verifiedItems, totalAmount, resolvedSessionId);
            }

            logAudit({
                tenantId, action: 'SALE_COMPLETED', entityType: 'SalesOrder', entityId: order.id,
                employeeId, amount: totalAmount, ipAddress: request.ip,
                metadata: { paymentMethod, itemCount: verifiedItems.length },
            });
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
        const { status, from } = request.query as { status?: string; from?: string };

        const where: any = { tenantId };
        if (status) {
            where.status = status.includes(',')
                ? { in: status.split(',').map((s: string) => s.trim()) }
                : status;
        }
        if (from) {
            const fromDate = new Date(from);
            if (!isNaN(fromDate.getTime())) {
                where.createdAt = { gte: fromDate };
            }
        }

        const sales = await prisma.salesOrder.findMany({
            where,
            include: { items: true, table: true },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        return reply.send({ success: true, data: sales });
    });

    // ── POST /sales/:id/split — split items into a new ticket ─────────────────
    fastify.post('/sales/:id/split', async (request, reply) => {
        const { id } = request.params as { id: string };
        const tenantId = request.tenantId || 'enigma_hq';
        const body = request.body as { items: { productId: string; quantity: number }[] };

        if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
            return reply.status(400).send({ error: 'Items to split are required' });
        }

        const original = await prisma.salesOrder.findUnique({
            where: { id },
            include: { items: true },
        });
        if (!original) return reply.status(404).send({ error: 'Ticket not found' });
        if (original.status !== 'open') {
            return reply.status(400).send({ error: 'Only open tickets can be split' });
        }

        // Validate each split item exists with sufficient quantity
        for (const splitItem of body.items) {
            const origItem = original.items.find(i => i.productId === splitItem.productId);
            if (!origItem) {
                return reply.status(400).send({ error: `Product ${splitItem.productId} not found in ticket` });
            }
            if (splitItem.quantity > origItem.quantity) {
                return reply.status(400).send({ error: `Insufficient quantity for ${origItem.productNameSnapshot}` });
            }
        }

        // Transaction: create new ticket + update original
        const result = await prisma.$transaction(async (tx) => {
            // Build split items with product info
            const splitItemsData = await Promise.all(body.items.map(async (si) => {
                const origItem = original.items.find(i => i.productId === si.productId)!;
                return {
                    productId: si.productId,
                    quantity: si.quantity,
                    unitPrice: origItem.unitPrice,
                    totalPrice: origItem.unitPrice * si.quantity,
                    productNameSnapshot: origItem.productNameSnapshot,
                    kdsStation: origItem.kdsStation,
                };
            }));

            const splitTotal = splitItemsData.reduce((s, i) => s + i.totalPrice, 0);

            // Create the new split ticket
            const baseName = original.ticketName || original.tableName || 'Ticket';
            const newTicket = await tx.salesOrder.create({
                data: {
                    tenantId,
                    sessionId: original.sessionId,
                    totalAmount: splitTotal,
                    paymentMethod: original.paymentMethod,
                    status: 'open',
                    tableId: original.tableId,
                    tableName: original.tableName,
                    ticketName: `${baseName} (2)`,
                    employeeId: original.employeeId,
                    notes: original.notes,
                    items: { create: splitItemsData },
                },
                include: { items: true },
            });

            // Update original: reduce/remove items
            for (const splitItem of body.items) {
                const origItem = original.items.find(i => i.productId === splitItem.productId)!;
                const remaining = origItem.quantity - splitItem.quantity;
                if (remaining <= 0) {
                    await tx.salesItem.delete({ where: { id: origItem.id } });
                } else {
                    await tx.salesItem.update({
                        where: { id: origItem.id },
                        data: {
                            quantity: remaining,
                            totalPrice: origItem.unitPrice * remaining,
                        },
                    });
                }
            }

            // Recalculate original total
            const updatedOriginal = await tx.salesOrder.update({
                where: { id },
                data: { totalAmount: original.totalAmount - splitTotal },
                include: { items: true },
            });

            return { original: updatedOriginal, split: newTicket };
        });

        logAudit({
            tenantId, action: 'TICKET_SPLIT', entityType: 'SalesOrder', entityId: id,
            amount: result.split.totalAmount, ipAddress: request.ip,
            metadata: { newTicketId: result.split.id, itemsMoved: body.items.length },
        });

        return reply.send({
            success: true,
            original: { id: result.original.id, totalAmount: result.original.totalAmount, items: result.original.items },
            split: { id: result.split.id, ticketName: result.split.ticketName, totalAmount: result.split.totalAmount, items: result.split.items },
        });
    });

    // ── DELETE /sales/:id — void an open ticket ───────────────────────────────
    fastify.delete('/sales/:id', async (request, reply) => {
        const { id } = request.params as { id: string };

        const existing = await prisma.salesOrder.findUnique({ where: { id } });
        if (!existing) return reply.status(404).send({ error: 'Ticket not found' });
        if (existing.status !== 'open') {
            return reply.status(400).send({ error: 'Only open tickets can be voided' });
        }

        // Delete items first (FK constraint), then the order
        await prisma.salesItem.deleteMany({ where: { salesOrderId: id } });
        await prisma.salesOrder.delete({ where: { id } });

        logAudit({
            tenantId: existing.tenantId, action: 'SALE_VOIDED', entityType: 'SalesOrder', entityId: id,
            amount: existing.totalAmount, ipAddress: request.ip,
            metadata: { ticketName: existing.ticketName, tableName: existing.tableName },
        });

        return reply.send({ success: true });
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

        // Lock completed sales — only allow transitioning open→completed, never modifying completed
        if (existing.status === 'completed') {
            return reply.status(400).send({ error: 'Completed sales cannot be modified' });
        }

        const updateData: any = {};
        if (body.status) updateData.status = body.status;
        if (body.paymentMethod) updateData.paymentMethod = body.paymentMethod;
        if (body.tableId !== undefined) updateData.tableId = body.tableId;
        if (body.tableName !== undefined) updateData.tableName = body.tableName;
        if (body.ticketName !== undefined) updateData.ticketName = body.ticketName;
        if (body.notes !== undefined) updateData.notes = body.notes;
        if (body.employeeId !== undefined) updateData.employeeId = body.employeeId;

        // Replace items if provided — use DB prices to prevent manipulation
        if (body.items && Array.isArray(body.items) && body.items.length > 0) {
            const itemsWithNames = await Promise.all(body.items.map(async (item: any) => {
                const product = await prisma.product.findUnique({ where: { id: item.productId } });
                const verifiedPrice = product?.price ?? item.price;
                return {
                    salesOrderId: id,
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: verifiedPrice,
                    totalPrice: verifiedPrice * item.quantity,
                    productNameSnapshot: product?.name || 'Unknown Product',
                    kdsStation: product?.kdsStation || null,
                };
            }));
            // Recalculate total from verified prices
            updateData.totalAmount = itemsWithNames.reduce((s, i) => s + i.totalPrice, 0);
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
            // Re-fetch updated order to get verified items/total
            const finalOrder = await prisma.salesOrder.findUnique({
                where: { id },
                include: { items: true },
            });
            const itemsToProcess = (finalOrder?.items || existing.items).map((i: any) => ({
                productId: i.productId,
                quantity: i.quantity,
                price: i.unitPrice,
            }));
            const totalToRecord = finalOrder?.totalAmount ?? existing.totalAmount;
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
                await trackGoals(tenantId, empId, itemsToProcess, totalToRecord, cashSessionId || undefined);
            }

            logAudit({
                tenantId, action: 'SALE_COMPLETED', entityType: 'SalesOrder', entityId: id,
                employeeId: empId, amount: totalToRecord, ipAddress: request.ip,
                metadata: { paymentMethod: payMethod, fromTicket: true },
            });
        } else if (body.items) {
            logAudit({
                tenantId, action: 'SALE_MODIFIED', entityType: 'SalesOrder', entityId: id,
                amount: updated.totalAmount, ipAddress: request.ip,
                metadata: { itemCount: body.items.length },
            });
        }

        return reply.send({ success: true, data: updated });
    });
}
