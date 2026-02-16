
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma';

export default async function authRoutes(fastify: FastifyInstance) {

    // Schema for PIN Verification
    const verifyPinSchema = z.object({
        pin: z.string().min(4).max(8) // max length for security
    });

    fastify.post('/auth/employee-login', async (request, reply) => {
        const tenantId = request.tenantId;
        if (!tenantId) return reply.status(400).send({ error: 'Tenant ID required' });

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
            return reply.status(401).send({ error: 'Invalid PIN' });
        }

        // Look up role permissions from SystemRole
        let permissions = {
            canAccessOps: false,
            canAccessHq: false,
            canAccessKiosk: true,
            canAccessKitchen: false
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
                    canAccessKitchen: systemRole.canAccessKitchen
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
