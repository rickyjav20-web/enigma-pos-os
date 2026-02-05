"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = productRoutes;
const ProductReadModel_1 = require("../projections/ProductReadModel");
async function productRoutes(fastify) {
    fastify.get('/products', async (request, reply) => {
        const { tenant_id } = request.query;
        if (!tenant_id) {
            return reply.status(400).send({ error: 'Missing tenant_id parameter' });
        }
        const products = ProductReadModel_1.productReadModel.getProducts(tenant_id);
        return { success: true, count: products.length, data: products };
    });
}
