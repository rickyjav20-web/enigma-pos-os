"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Force Reload Trigger (Step 1100) - Retry API Build
const fastify = (0, fastify_1.default)({
    logger: true
});
fastify.register(cors_1.default, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
    credentials: false
});
fastify.addHook('onRequest', (req, reply, done) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    done();
});
const tenant_1 = require("./middleware/tenant");
fastify.addHook('onRequest', tenant_1.tenantMiddleware);
fastify.register(Promise.resolve().then(() => __importStar(require('./routes/command'))), { prefix: '/api/v1' });
fastify.register(Promise.resolve().then(() => __importStar(require('./routes/ingest'))), { prefix: '/api/v1' });
fastify.register(Promise.resolve().then(() => __importStar(require('./routes/products'))), { prefix: '/api/v1' });
fastify.register(Promise.resolve().then(() => __importStar(require('./routes/staff'))), { prefix: '/api/v1' });
fastify.register(Promise.resolve().then(() => __importStar(require('./routes/purchases'))), { prefix: '/api/v1' });
fastify.register(Promise.resolve().then(() => __importStar(require('./routes/auth'))), { prefix: '/api/v1' });
fastify.register(Promise.resolve().then(() => __importStar(require('./routes/register'))), { prefix: '/api/v1' });
fastify.register(Promise.resolve().then(() => __importStar(require('./routes/transactions'))), { prefix: '/api/v1' });
fastify.register(Promise.resolve().then(() => __importStar(require('./routes/supply-items'))), { prefix: '/api/v1' });
fastify.register(Promise.resolve().then(() => __importStar(require('./routes/production'))), { prefix: '/api/v1' });
fastify.register(Promise.resolve().then(() => __importStar(require('./routes/data'))), { prefix: '/api/v1' });
fastify.register(Promise.resolve().then(() => __importStar(require('./routes/setup'))), { prefix: '/api/v1' });
fastify.register(Promise.resolve().then(() => __importStar(require('./routes/roles'))), { prefix: '/api/v1' });
fastify.register(Promise.resolve().then(() => __importStar(require('./routes/sales-import'))), { prefix: '/api/v1' });
fastify.register(Promise.resolve().then(() => __importStar(require('./routes/test-simulation'))), { prefix: '/api/v1' });
fastify.register(Promise.resolve().then(() => __importStar(require('./routes/system-init'))), { prefix: '/api/v1' });
fastify.register(Promise.resolve().then(() => __importStar(require('./routes/sales-consumption'))), { prefix: '/api/v1' });
fastify.register(Promise.resolve().then(() => __importStar(require('./routes/maintenance'))), { prefix: '/api/v1' });
fastify.get('/', async (request, reply) => {
    return { hello: 'Enigma POS OS API', status: 'active', timestamp: Date.now() };
});
const start = async () => {
    try {
        const PORT = process.env.PORT || 3000;
        await fastify.listen({ port: Number(PORT), host: '0.0.0.0' });
        console.log(`🚀 API Server running on port ${PORT}`);
        console.log(fastify.printRoutes()); // DEBUG: Dump Routes
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
