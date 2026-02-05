import { FastifyInstance } from 'fastify';
import { productIngestService } from '../services/ProductIngestService';

interface IngestBody {
    csv_content: string;
    tenant_id: string;
    actor_id: string;
}

export default async function ingestRoutes(fastify: FastifyInstance) {
    fastify.post<{ Body: IngestBody }>('/ingest/products', async (request, reply) => {
        const { csv_content, tenant_id, actor_id } = request.body;

        if (!csv_content || !tenant_id) {
            return reply.status(400).send({ error: 'Missing csv_content or tenant_id' });
        }

        try {
            const result = await productIngestService.ingestLoyverseExport(csv_content, tenant_id);
            return {
                success: true,
                nodes: result.nodes,
                links: result.links,
                message: `Successfully ingested ${result.nodes} items and ${result.links} links for tenant ${tenant_id}`
            };
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Ingestion failed', details: (error as Error).message });
        }
    });
}
