"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ingestRoutes;
const ProductIngestService_1 = require("../services/ProductIngestService");
async function ingestRoutes(fastify) {
    fastify.post('/ingest/products', async (request, reply) => {
        const { csv_content, tenant_id, actor_id } = request.body;
        if (!csv_content || !tenant_id) {
            return reply.status(400).send({ error: 'Missing csv_content or tenant_id' });
        }
        try {
            const count = await ProductIngestService_1.productIngestService.ingestCsv(csv_content, tenant_id, actor_id || 'system');
            return { success: true, count, message: `Successfully ingested ${count} products for tenant ${tenant_id}` };
        }
        catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Ingestion failed', details: error.message });
        }
    });
}
