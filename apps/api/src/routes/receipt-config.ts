import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { z } from 'zod';

const updateSchema = z.object({
    businessName: z.string().min(1).max(100).optional(),
    logoUrl: z.string().max(500).optional(),
    headerLine1: z.string().max(200).optional(),
    headerLine2: z.string().max(200).optional(),
    footerLine1: z.string().max(200).optional(),
    footerLine2: z.string().max(200).optional(),
    showTable: z.boolean().optional(),
    showEmployee: z.boolean().optional(),
    showOrderType: z.boolean().optional(),
    showTicketName: z.boolean().optional(),
    showDateTime: z.boolean().optional(),
    showUSD: z.boolean().optional(),
    showVES: z.boolean().optional(),
    showCOP: z.boolean().optional(),
    paperWidth: z.number().int().min(16).max(80).optional(),
});

const DEFAULTS = {
    businessName: 'Mi Negocio',
    logoUrl: '',
    headerLine1: '',
    headerLine2: '',
    footerLine1: 'Gracias por tu visita!',
    footerLine2: 'Las propinas se agradecen',
    showTable: true,
    showEmployee: true,
    showOrderType: false,
    showTicketName: true,
    showDateTime: true,
    showUSD: true,
    showVES: false,
    showCOP: false,
    paperWidth: 32,
};

export default async function receiptConfigRoutes(fastify: FastifyInstance) {

    // GET /receipt-config — get or create default config
    fastify.get('/receipt-config', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';

        let config = await prisma.receiptConfig.findUnique({ where: { tenantId } });

        if (!config) {
            config = await prisma.receiptConfig.create({
                data: { tenantId, ...DEFAULTS },
            });
        }

        return reply.send({ success: true, data: config });
    });

    // PUT /receipt-config — update config
    fastify.put('/receipt-config', async (request, reply) => {
        const tenantId = request.tenantId || 'enigma_hq';
        const body = updateSchema.parse(request.body);

        const config = await prisma.receiptConfig.upsert({
            where: { tenantId },
            create: { tenantId, ...DEFAULTS, ...body },
            update: body,
        });

        return reply.send({ success: true, data: config });
    });
}
