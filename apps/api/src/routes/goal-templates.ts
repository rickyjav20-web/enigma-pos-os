
import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { z } from 'zod';

export default async function goalTemplatesRoutes(fastify: FastifyInstance) {

    const templateSchema = z.object({
        session: z.enum(['MORNING', 'AFTERNOON', 'ALL_DAY']).default('ALL_DAY'),
        scope: z.enum(['SESSION', 'EMPLOYEE']).default('SESSION'),
        type: z.enum(['PRODUCT', 'CATEGORY', 'REVENUE', 'MIXED']),
        targetId: z.string().optional(),
        targetIds: z.array(z.string()).optional(),
        targetName: z.string(),
        targetQty: z.number().positive(),
        rewardType: z.enum(['POINTS', 'BONUS', 'BADGE']).default('BONUS'),
        rewardValue: z.number().default(1.5),
        rewardNote: z.string().default('Bono por meta'),
        isActive: z.boolean().default(true),
        sortOrder: z.number().default(0),
    });

    // GET /goal-templates — list all templates for tenant
    fastify.get('/goal-templates', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const { session, active } = request.query as { session?: string; active?: string };

        const where: any = { tenantId };
        if (session && session !== 'ALL') where.session = session;
        if (active === 'true') where.isActive = true;

        const templates = await prisma.goalTemplate.findMany({
            where,
            orderBy: [{ session: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
        });

        return reply.send({ success: true, data: templates });
    });

    // POST /goal-templates — create template
    fastify.post('/goal-templates', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const body = templateSchema.parse(request.body);

        const template = await prisma.goalTemplate.create({
            data: {
                tenantId,
                session: body.session,
                scope: body.scope,
                type: body.type,
                targetId: body.targetId,
                targetIds: body.targetIds ?? Prisma.JsonNull,
                targetName: body.targetName,
                targetQty: body.targetQty,
                rewardType: body.rewardType,
                rewardValue: body.rewardValue,
                rewardNote: body.rewardNote,
                isActive: body.isActive,
                sortOrder: body.sortOrder,
            },
        });

        return reply.status(201).send({ success: true, data: template });
    });

    // PUT /goal-templates/:id — update template
    fastify.put('/goal-templates/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as any;

        const updateData: any = {};
        if (body.session !== undefined) updateData.session = body.session;
        if (body.scope !== undefined) updateData.scope = body.scope;
        if (body.type !== undefined) updateData.type = body.type;
        if (body.targetId !== undefined) updateData.targetId = body.targetId;
        if (body.targetIds !== undefined) updateData.targetIds = body.targetIds ?? Prisma.JsonNull;
        if (body.targetName !== undefined) updateData.targetName = body.targetName;
        if (body.targetQty !== undefined) updateData.targetQty = body.targetQty;
        if (body.rewardType !== undefined) updateData.rewardType = body.rewardType;
        if (body.rewardValue !== undefined) updateData.rewardValue = body.rewardValue;
        if (body.rewardNote !== undefined) updateData.rewardNote = body.rewardNote;
        if (body.isActive !== undefined) updateData.isActive = body.isActive;
        if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

        const template = await prisma.goalTemplate.update({
            where: { id },
            data: updateData,
        });

        return reply.send({ success: true, data: template });
    });

    // DELETE /goal-templates/:id
    fastify.delete('/goal-templates/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        await prisma.goalTemplate.delete({ where: { id } });
        return reply.send({ success: true });
    });

    // POST /goal-templates/:id/toggle — quick toggle active/inactive
    fastify.post('/goal-templates/:id/toggle', async (request, reply) => {
        const { id } = request.params as { id: string };
        const current = await prisma.goalTemplate.findUnique({ where: { id } });
        if (!current) return reply.status(404).send({ success: false, message: 'Template not found' });

        const template = await prisma.goalTemplate.update({
            where: { id },
            data: { isActive: !current.isActive },
        });

        return reply.send({ success: true, data: template });
    });
}
