import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';

export default async function roleRoutes(fastify: FastifyInstance) {

    // GET /roles — list all roles for tenant
    fastify.get('/roles', async (request, reply) => {
        try {
            const roles = await prisma.systemRole.findMany({
                where: { tenantId: request.tenantId },
                orderBy: { name: 'asc' }
            });
            return { roles };
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: error.message });
        }
    });

    // POST /roles — create a new role
    fastify.post('/roles', async (request, reply) => {
        try {
            const { name, description, color, canAccessOps, canAccessHq, canAccessKiosk, canAccessKitchen } = request.body as any;

            if (!name || !name.trim()) {
                return reply.status(400).send({ error: 'Role name is required' });
            }

            // Check for duplicate
            const existing = await prisma.systemRole.findUnique({
                where: { tenantId_name: { tenantId: request.tenantId, name: name.trim() } }
            });
            if (existing) {
                return reply.status(409).send({ error: `Role "${name}" already exists` });
            }

            const role = await prisma.systemRole.create({
                data: {
                    tenantId: request.tenantId,
                    name: name.trim(),
                    description: description || null,
                    color: color || '#8b5cf6',
                    canAccessOps: canAccessOps ?? false,
                    canAccessHq: canAccessHq ?? false,
                    canAccessKiosk: canAccessKiosk ?? true,
                    canAccessKitchen: canAccessKitchen ?? false,
                    isSystem: false
                }
            });

            return { role };
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: error.message });
        }
    });

    // PATCH /roles/:id — update a role
    fastify.patch('/roles/:id', async (request, reply) => {
        try {
            const { id } = request.params as any;
            const updates = request.body as any;

            // Don't allow renaming system roles
            const existing = await prisma.systemRole.findUnique({ where: { id } });
            if (!existing) return reply.status(404).send({ error: 'Role not found' });

            // If renaming, check for duplicates
            if (updates.name && updates.name.trim() !== existing.name) {
                const dup = await prisma.systemRole.findUnique({
                    where: { tenantId_name: { tenantId: request.tenantId, name: updates.name.trim() } }
                });
                if (dup) return reply.status(409).send({ error: `Role "${updates.name}" already exists` });
            }

            const role = await prisma.systemRole.update({
                where: { id },
                data: {
                    ...(updates.name !== undefined && { name: updates.name.trim() }),
                    ...(updates.description !== undefined && { description: updates.description }),
                    ...(updates.color !== undefined && { color: updates.color }),
                    ...(updates.canAccessOps !== undefined && { canAccessOps: updates.canAccessOps }),
                    ...(updates.canAccessHq !== undefined && { canAccessHq: updates.canAccessHq }),
                    ...(updates.canAccessKiosk !== undefined && { canAccessKiosk: updates.canAccessKiosk }),
                    ...(updates.canAccessKitchen !== undefined && { canAccessKitchen: updates.canAccessKitchen }),
                }
            });

            return { role };
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: error.message });
        }
    });

    // DELETE /roles/:id — delete a role (blocks system roles)
    fastify.delete('/roles/:id', async (request, reply) => {
        try {
            const { id } = request.params as any;
            const role = await prisma.systemRole.findUnique({ where: { id } });

            if (!role) return reply.status(404).send({ error: 'Role not found' });
            if (role.isSystem) return reply.status(403).send({ error: 'Cannot delete a system role' });

            // Check if employees are using this role
            const usageCount = await prisma.employee.count({
                where: { tenantId: request.tenantId, role: role.name }
            });
            if (usageCount > 0) {
                return reply.status(409).send({
                    error: `Cannot delete: ${usageCount} employee(s) are assigned to "${role.name}". Reassign them first.`
                });
            }

            await prisma.systemRole.delete({ where: { id } });
            return { success: true };
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: error.message });
        }
    });

    // GET /roles/check/:roleName — check permissions for a role by name
    fastify.get('/roles/check/:roleName', async (request, reply) => {
        try {
            const { roleName } = request.params as any;
            const role = await prisma.systemRole.findFirst({
                where: {
                    tenantId: request.tenantId,
                    name: { equals: roleName, mode: 'insensitive' }
                }
            });

            if (!role) {
                // Role not found in DB — deny all by default
                return {
                    found: false,
                    roleName,
                    canAccessOps: false,
                    canAccessHq: false,
                    canAccessKiosk: false
                };
            }

            return {
                found: true,
                roleName: role.name,
                canAccessOps: role.canAccessOps,
                canAccessHq: role.canAccessHq,
                canAccessKiosk: role.canAccessKiosk,
                canAccessKitchen: role.canAccessKitchen
            };
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: error.message });
        }
    });

    // POST /roles/seed — seed default roles for the tenant
    fastify.post('/roles/seed', async (request, reply) => {
        try {
            const defaults = [
                { name: 'ADMIN', description: 'Acceso total a todos los sistemas', color: '#ef4444', canAccessOps: true, canAccessHq: true, canAccessKiosk: true, canAccessKitchen: true, isSystem: true },
                { name: 'Cajero', description: 'Caja registradora y kiosko', color: '#10b981', canAccessOps: true, canAccessHq: false, canAccessKiosk: true, canAccessKitchen: false, isSystem: false },
                { name: 'Gerente', description: 'Acceso administrativo y operativo', color: '#f59e0b', canAccessOps: true, canAccessHq: true, canAccessKiosk: true, canAccessKitchen: true, isSystem: false },
                { name: 'Cocina', description: 'Acceso a cocina y kiosko', color: '#8b5cf6', canAccessOps: false, canAccessHq: false, canAccessKiosk: true, canAccessKitchen: true, isSystem: false },
                { name: 'WAITER', description: 'Solo kiosko (sin acceso a caja)', color: '#3b82f6', canAccessOps: false, canAccessHq: false, canAccessKiosk: true, canAccessKitchen: false, isSystem: false },
                { name: 'Barista', description: 'Acceso a caja y kiosko', color: '#ec4899', canAccessOps: true, canAccessHq: false, canAccessKiosk: true, canAccessKitchen: false, isSystem: false },
            ];

            const results = { created: 0, skipped: 0, roles: [] as string[] };

            for (const def of defaults) {
                const existing = await prisma.systemRole.findUnique({
                    where: { tenantId_name: { tenantId: request.tenantId, name: def.name } }
                });
                if (existing) {
                    results.skipped++;
                    results.roles.push(`${def.name} (exists)`);
                    continue;
                }

                await prisma.systemRole.create({
                    data: { tenantId: request.tenantId, ...def }
                });
                results.created++;
                results.roles.push(`${def.name} (created)`);
            }

            return { success: true, ...results };
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: error.message });
        }
    });
}
