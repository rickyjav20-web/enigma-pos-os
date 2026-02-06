import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';

export default async function setupRoutes(fastify: FastifyInstance) {
    // POST /setup/init-tenant
    // Temporary endpoint to seed the default tenant
    fastify.post('/setup/init-tenant', async (request, reply) => {
        try {
            const tenantId = 'enigma_hq';

            // Check if exists
            const existing = await prisma.tenant.findUnique({
                where: { id: tenantId }
            });

            if (existing) {
                return { success: true, message: 'Tenant already exists', tenant: existing };
            }

            // Create
            const newTenant = await prisma.tenant.create({
                data: {
                    id: tenantId,
                    name: 'Enigma HQ',
                    slug: 'enigma-hq'
                }
            });

            return { success: true, message: 'Tenant created successfully', tenant: newTenant };

        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: error.message });
        }
    });
}
