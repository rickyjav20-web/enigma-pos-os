
import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { z } from 'zod';

export default async function tablesRoutes(fastify: FastifyInstance) {

    // GET /tables — list all tables for tenant
    fastify.get('/tables', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';

        const tables = await prisma.diningTable.findMany({
            where: { tenantId, isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            include: {
                salesOrders: {
                    where: { status: 'open' },
                    select: { id: true, ticketName: true, totalAmount: true, createdAt: true },
                    take: 1,
                }
            }
        });

        // Map to include occupancy status
        const result = tables.map(t => ({
            id: t.id,
            name: t.name,
            zone: t.zone,
            capacity: t.capacity,
            sortOrder: t.sortOrder,
            isOccupied: t.salesOrders.length > 0,
            currentTicket: t.salesOrders[0] || null,
        }));

        return reply.send({ success: true, data: result });
    });

    // POST /tables — create table
    const createSchema = z.object({
        name: z.string().min(1),
        zone: z.string().optional(),
        capacity: z.number().int().positive().optional(),
        sortOrder: z.number().int().optional(),
    });

    fastify.post('/tables', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const { name, zone, capacity, sortOrder } = createSchema.parse(request.body);

        const table = await prisma.diningTable.create({
            data: { tenantId, name, zone, capacity, sortOrder: sortOrder || 0 },
        });

        return reply.status(201).send({ success: true, data: table });
    });

    // PUT /tables/:id — update table
    fastify.put('/tables/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const tenantId = request.tenantId || 'enigma_hq';
        const body = request.body as any;

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
