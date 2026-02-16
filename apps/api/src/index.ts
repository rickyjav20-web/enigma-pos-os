import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';

dotenv.config();

// Force Reload Trigger (Step 1100) - Retry API Build

const fastify = Fastify({
    logger: true
});

fastify.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
    credentials: false
});

fastify.addHook('onRequest', (req, reply, done) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    done();
});

import { tenantMiddleware } from './middleware/tenant';
fastify.addHook('onRequest', tenantMiddleware);

fastify.register(import('./routes/command'), { prefix: '/api/v1' });
fastify.register(import('./routes/ingest'), { prefix: '/api/v1' });
fastify.register(import('./routes/products'), { prefix: '/api/v1' });
fastify.register(import('./routes/staff'), { prefix: '/api/v1' });
fastify.register(import('./routes/purchases'), { prefix: '/api/v1' });
fastify.register(import('./routes/auth'), { prefix: '/api/v1' });
fastify.register(import('./routes/register'), { prefix: '/api/v1' });
fastify.register(import('./routes/transactions'), { prefix: '/api/v1' });
fastify.register(import('./routes/waste'), { prefix: '/api/v1' });

fastify.register(import('./routes/supply-items'), { prefix: '/api/v1' });
fastify.register(import('./routes/production'), { prefix: '/api/v1' });
fastify.register(import('./routes/data'), { prefix: '/api/v1' });
fastify.register(import('./routes/setup'), { prefix: '/api/v1' });
fastify.register(import('./routes/roles'), { prefix: '/api/v1' });
fastify.register(import('./routes/sales-import'), { prefix: '/api/v1' });
fastify.register(import('./routes/sales'), { prefix: '/api/v1' }); // Enable POS Sales
fastify.register(import('./routes/test-simulation'), { prefix: '/api/v1' });
fastify.register(import('./routes/system-init'), { prefix: '/api/v1' });
fastify.register(import('./routes/sales-consumption'), { prefix: '/api/v1' });
fastify.register(import('./routes/maintenance'), { prefix: '/api/v1' });
fastify.register(import('./routes/kitchen-activity'), { prefix: '/api/v1' });

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
