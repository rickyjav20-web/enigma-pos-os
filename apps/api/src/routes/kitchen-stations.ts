import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { z } from 'zod';

export default async function kitchenStationsRoutes(fastify: FastifyInstance) {

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

        // Auto-update Product.kdsStation for products matching these categories
        if (body.categories && body.categories.length > 0) {
            await prisma.product.updateMany({
                where: { tenantId, categoryId: { in: body.categories }, isActive: true },
                data: { kdsStation: body.name },
            });
        }
        if (body.productIds && body.productIds.length > 0) {
            await prisma.product.updateMany({
                where: { tenantId, id: { in: body.productIds }, isActive: true },
                data: { kdsStation: body.name },
            });
        }

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

        // Re-sync Product.kdsStation
        const stationName = body.name || existing.name;
        // Clear old assignments for this station
        await prisma.product.updateMany({
            where: { tenantId, kdsStation: existing.name },
            data: { kdsStation: null },
        });
        // Set new assignments
        const cats = (body.categories ?? existing.categories) as string[] | null;
        const pids = (body.productIds ?? existing.productIds) as string[] | null;
        if (cats && cats.length > 0) {
            await prisma.product.updateMany({
                where: { tenantId, categoryId: { in: cats }, isActive: true },
                data: { kdsStation: stationName },
            });
        }
        if (pids && pids.length > 0) {
            await prisma.product.updateMany({
                where: { tenantId, id: { in: pids }, isActive: true },
                data: { kdsStation: stationName },
            });
        }

        return reply.send({ success: true, data: station });
    });

    // DELETE /kitchen-stations/:id
    fastify.delete('/kitchen-stations/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const tenantId = request.tenantId || 'enigma_hq';

        const station = await prisma.kitchenStation.findUnique({ where: { id } });
        if (!station) return reply.status(404).send({ success: false, message: 'Station not found' });

        // Clear Product.kdsStation for products assigned to this station
        await prisma.product.updateMany({
            where: { tenantId, kdsStation: station.name },
            data: { kdsStation: null },
        });

        await prisma.kitchenStation.delete({ where: { id } });
        return reply.send({ success: true });
    });

    // POST /kitchen-stations/sync — re-sync all Product.kdsStation from station configs
    fastify.post('/kitchen-stations/sync', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';

        // Clear all kdsStation assignments
        await prisma.product.updateMany({
            where: { tenantId },
            data: { kdsStation: null },
        });

        const stations = await prisma.kitchenStation.findMany({
            where: { tenantId, isActive: true },
            orderBy: { sortOrder: 'asc' },
        });

        let updated = 0;
        for (const station of stations) {
            const cats = station.categories as string[] | null;
            const pids = station.productIds as string[] | null;
            if (cats && cats.length > 0) {
                const r = await prisma.product.updateMany({
                    where: { tenantId, categoryId: { in: cats }, isActive: true },
                    data: { kdsStation: station.name },
                });
                updated += r.count;
            }
            if (pids && pids.length > 0) {
                const r = await prisma.product.updateMany({
                    where: { tenantId, id: { in: pids }, isActive: true },
                    data: { kdsStation: station.name },
                });
                updated += r.count;
            }
        }

        return reply.send({ success: true, stationsProcessed: stations.length, productsUpdated: updated });
    });
}
