import { FastifyInstance } from 'fastify';
import { productIngestService } from '../services/ProductIngestService';

interface IngestBody {
    csv_content: string;
    tenant_id: string;
    actor_id: string;
}

export default async function ingestRoutes(fastify: FastifyInstance) {
    fastify.post<{ Body: IngestBody }>('/ingest/products', { bodyLimit: 10485760 }, async (request, reply) => {
        const { csv_content, tenant_id: bodyTenantId, actor_id } = request.body;

        // Prioritize Auth Context Tenant, fallback to body
        const activeTenant = request.tenantId || bodyTenantId;

        if (!csv_content || !activeTenant) {
            return reply.status(400).send({ error: 'Missing csv_content or tenant_id resolution failed' });
        }

        try {
            const result = await productIngestService.ingestLoyverseExport(csv_content, activeTenant);
            return {
                success: true,
                nodes: result.nodes,
                totalParsed: result.totalParsed,
                links: result.links,
                errors: result.errors,
                message: `Successfully processed for tenant ${activeTenant}`
            };
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Ingestion failed', details: (error as Error).message });
        }
    });
}
