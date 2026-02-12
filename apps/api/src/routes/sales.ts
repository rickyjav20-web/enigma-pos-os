
import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { z } from 'zod';

export default async function salesRoutes(fastify: FastifyInstance) {

    const salesSchema = z.object({
        sessionId: z.string(),
        items: z.array(z.object({
            productId: z.string(),
            quantity: z.number().int().positive(),
            price: z.number().min(0) // Override price if needed
        })),
        paymentMethod: z.enum(['cash', 'card', 'transfer', 'other']),
        notes: z.string().optional()
    });

    fastify.post('/sales', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const { sessionId, items, paymentMethod, notes } = salesSchema.parse(request.body);

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
                status: 'completed',
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

        // 4. Create Cash Transaction (Only if Cash)
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

        // 5. INVENTORY DEDUCTION LOGIC
        // For each item sold, find its recipe and deduct ingredients
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

                    // Deduct Stock
                    await prisma.supplyItem.update({
                        where: { id: recipe.supplyItemId },
                        data: {
                            stockQuantity: { decrement: quantityToDeduct }
                        }
                    });

                    // Log It
                    await prisma.inventoryLog.create({
                        data: {
                            tenantId,
                            supplyItemId: recipe.supplyItemId,
                            previousStock: 0, // Optimization: skip fetching old stock to save query
                            newStock: 0,      // Optimization: skip fetching new stock
                            changeAmount: -quantityToDeduct,
                            reason: 'sale',
                            notes: `Sold ${item.quantity}x ${product.name}`
                        }
                    });
                }
            }
        }

        return order;
    });
}
