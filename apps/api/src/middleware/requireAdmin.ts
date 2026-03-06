import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma';

/**
 * Verify that a PIN in the request (header or body) belongs to an employee
 * with OPS or HQ access. Use as a preHandler on admin endpoints.
 *
 * Checks x-admin-pin header first, then body.pin
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
    const tenantId = request.tenantId;
    const pin = (request.headers['x-admin-pin'] as string) || (request.body as any)?.pin;

    if (!pin) {
        return reply.status(401).send({ error: 'PIN de administrador requerido' });
    }

    const employee = await prisma.employee.findFirst({
        where: { tenantId, pinCode: pin, status: 'active' },
    });

    if (!employee) {
        return reply.status(401).send({ error: 'PIN inválido' });
    }

    // Check if role has OPS or HQ access
    const systemRole = await prisma.systemRole.findFirst({
        where: { tenantId, name: { equals: employee.role, mode: 'insensitive' } },
    });

    const hasAccess = systemRole
        ? (systemRole.canAccessOps || systemRole.canAccessHq)
        : ['admin', 'manager', 'owner', 'gerente', 'administrador'].includes(employee.role.toLowerCase());

    if (!hasAccess) {
        return reply.status(403).send({ error: 'No tienes permisos de administrador' });
    }

    // Attach admin info for audit logging
    (request as any).adminEmployee = { id: employee.id, name: employee.fullName, role: employee.role };
}
