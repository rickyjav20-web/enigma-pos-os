import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';

dotenv.config();

// Force Reload Trigger (Step 1100)

const fastify = Fastify({
    logger: true
});

fastify.register(cors, {
    origin: '*'
});

import { tenantMiddleware } from './middleware/tenant';
fastify.addHook('onRequest', tenantMiddleware);

fastify.register(import('./routes/command'), { prefix: '/api/v1' });
fastify.register(import('./routes/ingest'), { prefix: '/api/v1' });
fastify.register(import('./routes/products'), { prefix: '/api/v1' });
fastify.register(import('./routes/staff'), { prefix: '/api/v1' });
fastify.register(import('./routes/purchases'), { prefix: '/api/v1' });

fastify.register(import('./routes/supply-items'), { prefix: '/api/v1' });
fastify.register(import('./routes/production'), { prefix: '/api/v1' });
fastify.register(import('./routes/data'), { prefix: '/api/v1' });

fastify.get('/', async (request, reply) => {
    return { hello: 'Enigma POS OS API', status: 'active', timestamp: Date.now() };
});

const start = async () => {
    try {
        const PORT = process.env.PORT || 3000;
        await fastify.listen({ port: Number(PORT), host: '0.0.0.0' });
        console.log(`🚀 API Server running on port ${PORT}`);
        console.log(fastify.printRoutes()); // DEBUG: Dump Routes
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
