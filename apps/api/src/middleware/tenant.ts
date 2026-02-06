import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma';

// Extend FastifyRequest to include tenant
declare module 'fastify' {
    interface FastifyRequest {
        tenantId: string;
    }
}

export async function tenantMiddleware(request: FastifyRequest, reply: FastifyReply) {
    const headers = request.headers;
    // Check Header first (Standard)
    if (request.url.includes('/setup/')) {
        console.log('[TENANT-DEBUG] Skipping middleware for setup route');
        return;
    }

    let tenantId = headers['x-tenant-id'] as string;

    // Fallback to Query or Body (Legacy/Dev)
    if (!tenantId) {
        const query = request.query as any;
        const body = request.body as any;
        tenantId = query?.tenant_id || body?.tenant_id;
    }

    // Fallback to default "enigma-cafe" if missing (Logic from Legacy App)
    if (!tenantId) {
        tenantId = 'enigma-cafe';
    }

    // Resolve by ID or Slug
    console.log(`[TENANT-DEBUG] Looking up tenant: '${tenantId}'`);
    const tenant = await prisma.tenant.findFirst({
        where: {
            OR: [
                { id: tenantId },
                { slug: tenantId }
            ]
        }
    });

    if (!tenant) {
        console.error(`[TENANT-DEBUG] FAILED to find tenant: '${tenantId}'`);
        // If default also fails (DB empty?), handle gracefully or return error
        // Ideally we should SEED the DB with the default tenant if it's empty.
        return reply.status(400).send({ error: `Invalid Tenant: ${tenantId}` });
    }
    console.log(`[TENANT-DEBUG] Found tenant: ${tenant.id} (${tenant.name})`);

    request.tenantId = tenant.id;
}
