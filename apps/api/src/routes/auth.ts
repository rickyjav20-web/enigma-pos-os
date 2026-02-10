
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
            activeSession
        };
    });
}
