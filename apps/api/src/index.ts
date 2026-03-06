import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { alertGroup, ftime } from './services/whatsapp';

dotenv.config();

// Force Reload Trigger (Step 1100) - Retry API Build

const fastify = Fastify({
    logger: true
});

// CORS: Allow known origins + local dev. In production, restrict to your domain.
const ALLOWED_ORIGINS = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
    /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/,    // Local network devices (POS, KDS tablets)
    /^https?:\/\/.*\.enigma\.com$/,                // Production domain
    /^https?:\/\/.*\.vercel\.app$/,                // Vercel deployments
    /^https?:\/\/.*\.railway\.app$/,               // Railway deployments
];

fastify.register(cors, {
    origin: (origin, cb) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) return cb(null, true);
        const allowed = ALLOWED_ORIGINS.some(pattern => pattern.test(origin));
        cb(null, allowed);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
    credentials: true
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
fastify.register(import('./routes/currencies'), { prefix: '/api/v1' });
fastify.register(import('./routes/inventory-tasks'), { prefix: '/api/v1' });
fastify.register(import('./routes/waste-analytics'), { prefix: '/api/v1' });
fastify.register(import('./routes/tables'), { prefix: '/api/v1' });
fastify.register(import('./routes/goals'), { prefix: '/api/v1' });
fastify.register(import('./routes/analytics'), { prefix: '/api/v1' });

fastify.get('/', async (request, reply) => {
    return { hello: 'Enigma POS OS API', status: 'active', timestamp: Date.now() };
});

const start = async () => {
    try {
        const PORT = process.env.PORT || 3000;
        await fastify.listen({ port: Number(PORT), host: '0.0.0.0' });
        console.log(`🚀 API Server running on port ${PORT}`);
        console.log(fastify.printRoutes()); // DEBUG: Dump Routes

        // Startup notification (non-fatal)
        alertGroup(
            `☕ *Enigma Café — Sistema online*\n` +
            `🚀 Servidor iniciado y listo para el servicio\n` +
            `🕐 ${ftime()}\n` +
            `_"El café está listo. Las operaciones también."_`
        ).catch(() => { });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
