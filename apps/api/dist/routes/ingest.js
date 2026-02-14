"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ingestRoutes;
const ProductIngestService_1 = require("../services/ProductIngestService");
async function ingestRoutes(fastify) {
    fastify.post('/ingest/products', async (request, reply) => {
        const { csv_content, tenant_id: bodyTenantId, actor_id } = request.body;
        // Prioritize Auth Context Tenant, fallback to body
        const activeTenant = request.tenantId || bodyTenantId;
        if (!csv_content || !activeTenant) {
            return reply.status(400).send({ error: 'Missing csv_content or tenant_id resolution failed' });
        }
        try {
            const result = await ProductIngestService_1.productIngestService.ingestLoyverseExport(csv_content, activeTenant);
            return {
                success: true,
                nodes: result.nodes,
                totalParsed: result.totalParsed,
                links: result.links,
                errors: result.errors,
                message: `Successfully processed for tenant ${activeTenant}`
            };
        }
        catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Ingestion failed', details: error.message });
        }
    });
}
