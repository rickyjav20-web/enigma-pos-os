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
    // Check Header first (Standard)
    // if (request.url.includes('/setup/')) {
    //    console.log('[TENANT-DEBUG] Skipping middleware for setup route');
    //    return;
    // }

    let tenantId = headers['x-tenant-id'] as string;

    // Fallback to Query or Body (Legacy/Dev)
    if (!tenantId) {
        const query = request.query as any;
        const body = request.body as any;
        tenantId = query?.tenantId || query?.tenant_id || body?.tenantId || body?.tenant_id;
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
        console.log(`[TENANT-DEBUG] Tenant '${tenantId}' not found. Auto-creating for MVP...`);
        const newTenant = await prisma.tenant.create({
            data: {
                id: tenantId,
                name: tenantId === 'enigma_hq' ? 'Enigma HQ' : 'New Tenant',
                slug: tenantId
            }
        });
        request.tenantId = newTenant.id;
        return;
    }
    console.log(`[TENANT-DEBUG] Found tenant: ${tenant.id} (${tenant.name})`);

    request.tenantId = tenant.id;
}
