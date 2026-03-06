
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma';

// Simple in-memory rate limiter for PIN auth (max 5 attempts per IP per 15 min)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (!entry || now > entry.resetAt) {
        loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        return true;
    }
    entry.count++;
    return entry.count <= RATE_LIMIT_MAX;
}

// Cleanup old entries every 10 min
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of loginAttempts) {
        if (now > entry.resetAt) loginAttempts.delete(ip);
    }
}, 10 * 60 * 1000);

export default async function authRoutes(fastify: FastifyInstance) {

    // Schema for PIN Verification
    const verifyPinSchema = z.object({
        pin: z.string().min(4).max(8)
    });

    fastify.post('/auth/employee-login', async (request, reply) => {
        const tenantId = request.tenantId;
        if (!tenantId) return reply.status(400).send({ error: 'Tenant ID required' });

        // Rate limiting
        const clientIp = request.ip || 'unknown';
        if (!checkRateLimit(clientIp)) {
            return reply.status(429).send({ error: 'Demasiados intentos. Espera 15 minutos.' });
        }

        const { pin } = verifyPinSchema.parse(request.body);

        // Find Employee by PIN
        const employee = await prisma.employee.findFirst({
            where: {
                tenantId,
                pinCode: pin,
                status: 'active'
            }
        });

        if (!employee) {
            return reply.status(401).send({ error: 'PIN incorrecto' });
        }

        // Look up role permissions from SystemRole
        let permissions = {
            canAccessOps: false,
            canAccessHq: false,
            canAccessKiosk: true,
            canAccessKitchen: false,
            canAccessPos: true
        };

        try {
            const systemRole = await prisma.systemRole.findFirst({
                where: {
                    tenantId,
                    name: { equals: employee.role, mode: 'insensitive' }
                }
            });

            if (systemRole) {
                permissions = {
                    canAccessOps: systemRole.canAccessOps,
                    canAccessHq: systemRole.canAccessHq,
                    canAccessKiosk: systemRole.canAccessKiosk,
                    canAccessKitchen: systemRole.canAccessKitchen,
                    canAccessPos: (systemRole as any).canAccessPos ?? true
                };
            }
        } catch (e) {
            console.warn('[AUTH] SystemRole lookup failed, using defaults:', (e as any).message);
        }

        // Check for Active Register Session (resilient: table may not exist yet)
        let activeSession: any = null;
        try {
            const session = await prisma.registerSession.findFirst({
                where: {
                    employeeId: employee.id,
                    status: 'open'
                }
            });
            if (session) {
                activeSession = {
                    id: session.id,
                    startedAt: session.startedAt,
                    startingCash: session.startingCash
                };
            }
        } catch (e) {
            console.warn('[AUTH] RegisterSession table not available, skipping session check:', (e as any).code);
        }

        return {
            employee: {
                id: employee.id,
                name: employee.fullName,
                role: employee.role
            },
            permissions,
            activeSession
        };
    });
}
