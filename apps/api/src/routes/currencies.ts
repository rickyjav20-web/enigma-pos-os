import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma';

const SEED_CURRENCIES = [
    { code: 'USD', name: 'Dolar', symbol: '$',   exchangeRate: 1,    isBase: true  },
    { code: 'VES', name: 'Bolivar',symbol: 'Bs.',exchangeRate: 55,   isBase: false },
    { code: 'COP', name: 'Peso Colombiano', symbol: '$', exchangeRate: 4200, isBase: false },
];

export default async function currenciesRoutes(fastify: FastifyInstance) {

    const getTenant = (req: any) => req.tenantId as string;

    // GET /currencies — list active currencies for tenant
    fastify.get('/currencies', async (request, reply) => {
        const tenantId = getTenant(request);
        const currencies = await prisma.currency.findMany({
            where: { tenantId, isActive: true },
            orderBy: { code: 'asc' }
        });
        return currencies;
    });

    // PUT /currencies/:code — update exchange rate (USD is locked)
    const updateSchema = z.object({
        exchangeRate: z.number().positive()
    });

    fastify.put('/currencies/:code', async (request, reply) => {
        const tenantId = getTenant(request);
        const { code } = request.params as { code: string };
        const { exchangeRate } = updateSchema.parse(request.body);

        const currency = await prisma.currency.findUnique({
            where: { tenantId_code: { tenantId, code } }
        });

        if (!currency) {
            return reply.status(404).send({ error: `Currency ${code} not found` });
        }

        if (currency.isBase) {
            return reply.status(400).send({ error: 'Cannot change exchange rate of base currency (USD)' });
        }

        const updated = await prisma.currency.update({
            where: { tenantId_code: { tenantId, code } },
            data: { exchangeRate }
        });

        return updated;
    });

    // POST /currencies/seed — create USD/VES/COP for tenant if they don't exist
    fastify.post('/currencies/seed', async (request, reply) => {
        const tenantId = getTenant(request);

        const results = [];
        for (const c of SEED_CURRENCIES) {
            const existing = await prisma.currency.findUnique({
                where: { tenantId_code: { tenantId, code: c.code } }
            });

            if (!existing) {
                const created = await prisma.currency.create({
                    data: { tenantId, ...c }
                });
                results.push({ action: 'created', ...created });
            } else {
                results.push({ action: 'already_exists', code: c.code });
            }
        }

        return { seeded: results };
    });
}
