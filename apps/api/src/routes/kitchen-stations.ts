import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { z } from 'zod';

export default async function kitchenStationsRoutes(fastify: FastifyInstance) {
    async function syncStationAssignments(tenantId: string) {
        await prisma.product.updateMany({
            where: { tenantId },
            data: { kdsStation: null },
        });

        const stations = await prisma.kitchenStation.findMany({
            where: { tenantId, isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        });

        let updated = 0;

        // Apply category routing first.
        for (const station of stations) {
            const categories = station.categories as string[] | null;
            if (!categories || categories.length === 0) continue;

            const result = await prisma.product.updateMany({
                where: { tenantId, categoryId: { in: categories }, isActive: true },
                data: { kdsStation: station.name },
            });
            updated += result.count;
        }

        // Apply per-product routing last so manual overrides win over category defaults.
        for (const station of stations) {
            const productIds = station.productIds as string[] | null;
            if (!productIds || productIds.length === 0) continue;

            const result = await prisma.product.updateMany({
                where: { tenantId, id: { in: productIds }, isActive: true },
                data: { kdsStation: station.name },
            });
            updated += result.count;
        }

        return { stationsProcessed: stations.length, productsUpdated: updated };
    }

    // GET /kitchen-stations — list all stations
    fastify.get('/kitchen-stations', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';

        const stations = await prisma.kitchenStation.findMany({
            where: { tenantId },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        });

        return reply.send({ success: true, data: stations });
    });

    // POST /kitchen-stations — create station
    const createSchema = z.object({
        name: z.string().min(1),
        color: z.string().optional(),
        categories: z.array(z.string()).optional(),
        productIds: z.array(z.string()).optional(),
        sortOrder: z.number().int().optional(),
    });

    fastify.post('/kitchen-stations', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const body = createSchema.parse(request.body);

        const station = await prisma.kitchenStation.create({
            data: {
                tenantId,
                name: body.name,
                color: body.color || '#93B59D',
                categories: body.categories || [],
                productIds: body.productIds || [],
                sortOrder: body.sortOrder ?? 0,
            },
        });

        await syncStationAssignments(tenantId);

        return reply.status(201).send({ success: true, data: station });
    });

    // PUT /kitchen-stations/:id — update station
    fastify.put('/kitchen-stations/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const tenantId = request.tenantId || 'enigma_hq';
        const body = request.body as any;

        const existing = await prisma.kitchenStation.findUnique({ where: { id } });
        if (!existing) return reply.status(404).send({ success: false, message: 'Station not found' });

        const updateData: any = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.color !== undefined) updateData.color = body.color;
        if (body.isActive !== undefined) updateData.isActive = body.isActive;
        if (body.categories !== undefined) updateData.categories = body.categories;
        if (body.productIds !== undefined) updateData.productIds = body.productIds;
        if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

        const station = await prisma.kitchenStation.update({
            where: { id },
            data: updateData,
        });

        await syncStationAssignments(tenantId);

        return reply.send({ success: true, data: station });
    });

    // DELETE /kitchen-stations/:id
    fastify.delete('/kitchen-stations/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const tenantId = request.tenantId || 'enigma_hq';

        const station = await prisma.kitchenStation.findUnique({ where: { id } });
        if (!station) return reply.status(404).send({ success: false, message: 'Station not found' });

        await prisma.kitchenStation.delete({ where: { id } });
        await syncStationAssignments(tenantId);
        return reply.send({ success: true });
    });

    // POST /kitchen-stations/sync — re-sync all Product.kdsStation from station configs
    fastify.post('/kitchen-stations/sync', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';

        const result = await syncStationAssignments(tenantId);

        return reply.send({ success: true, ...result });
    });
}
