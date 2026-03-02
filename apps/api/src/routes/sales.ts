
import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { z } from 'zod';

export default async function salesRoutes(fastify: FastifyInstance) {

    const salesSchema = z.object({
        sessionId: z.string(),
        items: z.array(z.object({
            productId: z.string(),
            quantity: z.number().int().positive(),
            price: z.number().min(0)
        })),
        paymentMethod: z.enum(['cash', 'card', 'transfer', 'other']),
        status: z.enum(['open', 'completed']).optional().default('completed'),
        tableId: z.string().optional(),
        tableName: z.string().optional(),
        ticketName: z.string().optional(),
        employeeId: z.string().optional(),
        notes: z.string().optional()
    });

    // POST /sales — create order or open ticket
    fastify.post('/sales', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const { sessionId, items, paymentMethod, status, tableId, tableName, ticketName, employeeId, notes } = salesSchema.parse(request.body);

        // 1. Verify Session
        const session = await prisma.registerSession.findUnique({
            where: { id: sessionId }
        });

        if (!session || session.status !== 'open') {
            return reply.status(400).send({ error: "Register session is closed or invalid" });
        }

        // 2. Calculate Total
        const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // 3. Create Sales Order
        const order = await prisma.salesOrder.create({
            data: {
                tenantId,
                sessionId,
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
                            productNameSnapshot: product?.name || 'Unknown Product'
                        }
                    }))
                }
            },
            include: { items: true }
        });

        // 4. Only for COMPLETED sales: cash transaction + inventory + goals
        if (status === 'completed') {
            // Cash transaction
            if (paymentMethod === 'cash') {
                await prisma.cashTransaction.create({
                    data: {
                        sessionId,
                        amount: totalAmount,
                        type: 'SALE',
                        description: `Venta #${order.id.slice(0, 8)}`,
                        referenceId: order.id
                    }
                });
            }

            // Inventory deduction
            for (const item of items) {
                const product = await prisma.product.findUnique({
                    where: { id: item.productId },
                    include: {
                        recipes: {
                            include: { supplyItem: true }
                        }
                    }
                });

                if (product && product.recipes.length > 0) {
                    for (const recipe of product.recipes) {
                        const quantityToDeduct = recipe.quantity * item.quantity;
                        await prisma.supplyItem.update({
                            where: { id: recipe.supplyItemId },
                            data: { stockQuantity: { decrement: quantityToDeduct } }
                        });
                        await prisma.inventoryLog.create({
                            data: {
                                tenantId,
                                supplyItemId: recipe.supplyItemId,
                                previousStock: 0,
                                newStock: 0,
                                changeAmount: -quantityToDeduct,
                                reason: 'sale',
                                notes: `Sold ${item.quantity}x ${product.name}`
                            }
                        });
                    }
                }
            }

            // 🎯 GOAL AUTO-DETECTION
            if (employeeId) {
                const today = new Date().toISOString().split('T')[0];
                const activeGoals = await prisma.dailyGoal.findMany({
                    where: {
                        tenantId,
                        employeeId,
                        date: today,
                        status: 'ACTIVE',
                    },
                });

                for (const goal of activeGoals) {
                    let increment = 0;

                    if (goal.type === 'PRODUCT') {
                        // Count sold quantity of the specific product
                        const matchingItems = items.filter(i => i.productId === goal.targetId);
                        increment = matchingItems.reduce((sum, i) => sum + i.quantity, 0);
                    } else if (goal.type === 'CATEGORY') {
                        // Count sold quantity of any product in the target category
                        for (const item of items) {
                            const product = await prisma.product.findUnique({
                                where: { id: item.productId },
                                select: { categoryId: true },
                            });
                            if (product && product.categoryId === goal.targetId) {
                                increment += item.quantity;
                            }
                        }
                    } else if (goal.type === 'REVENUE') {
                        // Add total sale amount
                        increment = totalAmount;
                    }

                    if (increment > 0) {
                        const newQty = goal.currentQty + increment;
                        const isCompleted = newQty >= goal.targetQty;
                        await prisma.dailyGoal.update({
                            where: { id: goal.id },
                            data: {
                                currentQty: newQty,
                                isCompleted,
                                completedAt: isCompleted && !goal.isCompleted ? new Date() : goal.completedAt,
                                status: isCompleted ? 'COMPLETED' : 'ACTIVE',
                            },
                        });
                    }
                }
            }
        }

        return order;
    });

    // GET /sales — list sales with optional status filter
    fastify.get('/sales', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const { status } = request.query as { status?: string };

        const where: any = { tenantId };
        if (status) where.status = status;

        const sales = await prisma.salesOrder.findMany({
            where,
            include: {
                items: true,
                table: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        return reply.send({ success: true, data: sales });
    });

    // PUT /sales/:id — update open ticket
    fastify.put('/sales/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as any;

        const existing = await prisma.salesOrder.findUnique({
            where: { id },
            include: { items: true },
        });

        if (!existing) {
            return reply.status(404).send({ error: 'Ticket not found' });
        }

        const updateData: any = {};
        if (body.status) updateData.status = body.status;
        if (body.tableId !== undefined) updateData.tableId = body.tableId;
        if (body.tableName !== undefined) updateData.tableName = body.tableName;
        if (body.ticketName !== undefined) updateData.ticketName = body.ticketName;
        if (body.notes !== undefined) updateData.notes = body.notes;
        if (body.totalAmount !== undefined) updateData.totalAmount = body.totalAmount;
        if (body.employeeId !== undefined) updateData.employeeId = body.employeeId;

        const updated = await prisma.salesOrder.update({
            where: { id },
            data: updateData,
            include: { items: true, table: true },
        });

        return reply.send({ success: true, data: updated });
    });
}
