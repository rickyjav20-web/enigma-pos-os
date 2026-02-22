import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma';

export default async function inventoryTasksRoutes(fastify: FastifyInstance) {

    const getTenant = (req: any) => req.tenantId as string;

    // ─────────────────────────────────────────────────────────────────────────
    // SMART INVENTORY ROTATION — which items to count per weekday
    // ─────────────────────────────────────────────────────────────────────────
    function getWeekdayGroup(date: Date): string {
        const day = date.getDay(); // 0=Sun,1=Mon,...,6=Sat
        const map: Record<number, string> = {
            0: 'ALL',          // Sunday — full audit
            1: 'LACTEOS',      // Monday
            2: 'PANADERIA',    // Tuesday
            3: 'BARRA',        // Wednesday — bar supplies
            4: 'ALTA_ROTACION',// Thursday — high-movement
            5: 'VARIANZA',     // Friday — high-variance history
            6: 'RESTO',        // Saturday — remaining pantry
        };
        return map[day] ?? 'RESTO';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /inventory/tasks/generate
    // Generate shift tasks for a given date + shift
    // ─────────────────────────────────────────────────────────────────────────
    const generateSchema = z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),  // "2026-02-22"
        shift: z.enum(['MORNING', 'EVENING'])
    });

    fastify.post('/inventory/tasks/generate', async (request, reply) => {
        const tenantId = getTenant(request);
        const { date, shift } = generateSchema.parse(request.body);

        const targetDate = new Date(date + 'T12:00:00Z');
        const created: any[] = [];

        // ── EVENING SHIFT: generate INVENTORY tasks ──────────────────────────
        if (shift === 'EVENING') {
            const group = getWeekdayGroup(targetDate);
            const isSunday = group === 'ALL';

            // Always count all production batches at every evening shift
            const batches = await prisma.supplyItem.findMany({
                where: { tenantId, isProduction: true, isActive: true }
            });

            // Select rotating ingredient group based on weekday
            let ingredientWhere: any = { tenantId, isActive: true, isProduction: false };

            if (!isSunday) {
                if (group === 'LACTEOS') {
                    ingredientWhere.category = { in: ['Lacteos', 'Lácteos', 'Proteinas', 'Proteínas'] };
                } else if (group === 'PANADERIA') {
                    ingredientWhere.category = { in: ['Panaderia', 'Panadería', 'Vegetales', 'Frutas'] };
                } else if (group === 'BARRA') {
                    ingredientWhere.countZone = 1;
                } else if (group === 'ALTA_ROTACION') {
                    // Items with most inventory log events (high movement)
                    const highMovement = await prisma.inventoryLog.groupBy({
                        by: ['supplyItemId'],
                        where: {
                            tenant: { id: tenantId },
                            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                        },
                        _count: { supplyItemId: true },
                        orderBy: { _count: { supplyItemId: 'desc' } },
                        take: 20
                    });
                    const ids = highMovement.map(h => h.supplyItemId);
                    ingredientWhere.id = { in: ids };
                    ingredientWhere.isProduction = false;
                } else if (group === 'VARIANZA') {
                    // Items with highest historical variance (frequent audit adjustments)
                    const highVariance = await prisma.inventoryCount.groupBy({
                        by: ['supplyItemId'],
                        where: { tenantId, variance: { not: 0 } },
                        _count: { supplyItemId: true },
                        orderBy: { _count: { supplyItemId: 'desc' } },
                        take: 20
                    });
                    const ids = highVariance.map(h => h.supplyItemId);
                    ingredientWhere.id = { in: ids.length > 0 ? ids : ['__none__'] };
                    ingredientWhere.isProduction = false;
                } else {
                    // RESTO — items not counted recently (longest since last count)
                    const recentlyCounted = await prisma.inventoryCount.groupBy({
                        by: ['supplyItemId'],
                        where: { tenantId },
                        _max: { date: true },
                        orderBy: { _max: { date: 'asc' } },
                        take: 20
                    });
                    const ids = recentlyCounted.map(h => h.supplyItemId);
                    ingredientWhere.id = { in: ids.length > 0 ? ids : undefined };
                    ingredientWhere.isProduction = false;
                }
            }
            // isSunday: no extra where filter → all items

            const ingredients = await prisma.supplyItem.findMany({
                where: ingredientWhere,
                take: 25
            });

            const allItems = [
                ...batches.map(i => ({ ...i, taskPriority: 2, taskReason: 'Batch — siempre al cierre' })),
                ...ingredients.filter(i => !batches.find(b => b.id === i.id))
                    .map(i => ({ ...i, taskPriority: 1, taskReason: `Ingrediente — grupo ${group}` }))
            ];

            for (const item of allItems) {
                const task = await prisma.shiftTask.upsert({
                    where: {
                        // Use a composite that doesn't exist yet, so upsert uses create path
                        // We simulate by checking if one already exists
                        id: `${date}-${shift}-${item.id}` // won't match real UUIDs, force create
                    },
                    update: {},  // no-op if exists (idempotent)
                    create: {
                        id: `${date}-${shift}-${item.id}`,
                        tenantId,
                        date,
                        shift,
                        type: 'INVENTORY',
                        supplyItemId: item.id,
                        status: 'PENDING',
                        generatedBy: 'AUTO',
                        priority: item.taskPriority,
                        reason: item.taskReason
                    }
                });
                created.push(task);
            }
        }

        // ── MORNING SHIFT: generate PRODUCTION tasks ──────────────────────────
        if (shift === 'MORNING') {
            // Find all production batches that are below par level
            const batches = await prisma.supplyItem.findMany({
                where: {
                    tenantId,
                    isProduction: true,
                    isActive: true,
                    parLevel: { not: null }
                }
            });

            // Get avg daily usage from last 7 days of InventoryLog (PRODUCTION_INGREDIENT outflows)
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            for (const batch of batches) {
                const currentStock = batch.stockQuantity || 0;
                const par = batch.parLevel || 0;
                if (currentStock >= par) continue;  // stock is healthy, skip

                // Avg usage from production ingredient logs (items consumed producing this batch)
                const usageLogs = await prisma.inventoryLog.findMany({
                    where: {
                        supplyItemId: batch.id,
                        reason: 'PRODUCTION_OUTPUT',
                        createdAt: { gte: sevenDaysAgo }
                    }
                });
                const totalProduced = usageLogs.reduce((sum, l) => sum + Math.abs(l.changeAmount), 0);
                const avgDailyProduction = usageLogs.length > 0 ? totalProduced / 7 : 0;

                const neededByPar = Math.max(0, par - currentStock);
                const neededByVelocity = Math.round(avgDailyProduction * 1.2 * 10) / 10;
                const targetQty = Math.max(neededByPar, neededByVelocity);

                if (targetQty <= 0) continue;

                const priority = currentStock <= (batch.minStock || 0) ? 3 :
                    currentStock < par * 0.5 ? 2 : 1;

                const task = await prisma.shiftTask.upsert({
                    where: { id: `${date}-${shift}-${batch.id}` },
                    update: {},
                    create: {
                        id: `${date}-${shift}-${batch.id}`,
                        tenantId,
                        date,
                        shift,
                        type: 'PRODUCTION',
                        supplyItemId: batch.id,
                        targetQty,
                        status: 'PENDING',
                        generatedBy: 'AUTO',
                        priority,
                        reason: `Stock ${currentStock} ${batch.yieldUnit || batch.defaultUnit} < Par ${par} (avg diario: ${avgDailyProduction.toFixed(1)})`
                    }
                });
                created.push(task);
            }
        }

        return { generated: created.length, tasks: created };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GET /inventory/tasks
    // Query tasks for a shift
    // ─────────────────────────────────────────────────────────────────────────
    fastify.get('/inventory/tasks', async (request, reply) => {
        const tenantId = getTenant(request);
        const { date, shift, type } = request.query as {
            date?: string;
            shift?: string;
            type?: string;
        };

        const today = new Date().toISOString().slice(0, 10);

        const where: any = { tenantId, date: date || today };
        if (shift) where.shift = shift;
        if (type) where.type = type;

        const tasks = await prisma.shiftTask.findMany({
            where,
            include: {
                supplyItem: {
                    select: {
                        id: true,
                        name: true,
                        defaultUnit: true,
                        yieldUnit: true,
                        yieldQuantity: true,
                        stockQuantity: true,
                        parLevel: true,
                        minStock: true,
                        maxStock: true,
                        isProduction: true,
                        category: true,
                        countZone: true,
                        lastCountedAt: true,
                        lastCountedQty: true
                    }
                }
            },
            orderBy: [{ priority: 'desc' }, { type: 'asc' }]
        });

        return tasks;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // POST /inventory/count
    // Submit a physical count for one item
    // ─────────────────────────────────────────────────────────────────────────
    const countSchema = z.object({
        supplyItemId: z.string(),
        countedQty: z.number().min(0),
        shift: z.enum(['MORNING', 'EVENING']),
        notes: z.string().optional(),
        taskId: z.string().optional(),
        userId: z.string(),
        userName: z.string()
    });

    fastify.post('/inventory/count', async (request, reply) => {
        const tenantId = getTenant(request);
        const { supplyItemId, countedQty, shift, notes, taskId, userId, userName } = countSchema.parse(request.body);

        const item = await prisma.supplyItem.findUnique({ where: { id: supplyItemId } });
        if (!item) return reply.status(404).send({ error: 'Supply item not found' });

        const systemQty = item.stockQuantity || 0;
        const variance = countedQty - systemQty;
        const unitCostAtTime = item.averageCost || item.currentCost || 0;

        // 1. Create InventoryCount record
        const count = await prisma.inventoryCount.create({
            data: {
                tenantId,
                supplyItemId,
                countedBy: userId,
                countedByName: userName,
                shift,
                countedQty,
                systemQty,
                variance,
                unitCostAtTime,
                notes
            }
        });

        // 2. If variance: update stock + log
        if (Math.abs(variance) > 0.001) {
            await prisma.supplyItem.update({
                where: { id: supplyItemId },
                data: {
                    stockQuantity: countedQty,
                    lastCountedAt: new Date(),
                    lastCountedQty: countedQty
                }
            });

            await prisma.inventoryLog.create({
                data: {
                    tenantId,
                    supplyItemId,
                    previousStock: systemQty,
                    newStock: countedQty,
                    changeAmount: variance,
                    reason: 'audit',
                    notes: `Conteo físico (${shift}). Varianza: ${variance > 0 ? '+' : ''}${variance.toFixed(3)} ${item.defaultUnit}. Por: ${userName}`
                }
            });
        } else {
            // No variance, just update lastCountedAt
            await prisma.supplyItem.update({
                where: { id: supplyItemId },
                data: { lastCountedAt: new Date(), lastCountedQty: countedQty }
            });
        }

        // 3. Mark task as DONE if provided
        if (taskId) {
            await prisma.shiftTask.update({
                where: { id: taskId },
                data: {
                    status: 'DONE',
                    completedQty: countedQty,
                    completedBy: userId,
                    completedAt: new Date(),
                    notes
                }
            }).catch(() => {}); // non-fatal if task doesn't exist
        }

        // 4. Log KitchenActivityLog
        await prisma.kitchenActivityLog.create({
            data: {
                tenantId,
                employeeId: userId,
                employeeName: userName,
                action: 'INVENTORY_COUNT',
                entityType: 'supply_item',
                entityId: supplyItemId,
                entityName: item.name,
                quantity: countedQty,
                unit: item.defaultUnit,
                metadata: {
                    systemQty,
                    variance,
                    shift,
                    taskId,
                    costVariance: Math.abs(variance) * unitCostAtTime
                }
            }
        }).catch(() => {});

        return {
            count,
            updatedStock: countedQty,
            variance,
            costVariance: Math.abs(variance) * unitCostAtTime
        };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /inventory/tasks/:id
    // Update task status (DONE / SKIPPED)
    // ─────────────────────────────────────────────────────────────────────────
    fastify.patch('/inventory/tasks/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const { status, completedQty, notes, completedBy } = request.body as any;

        const task = await prisma.shiftTask.update({
            where: { id },
            data: {
                status,
                completedQty,
                notes,
                completedBy,
                completedAt: status === 'DONE' ? new Date() : undefined
            },
            include: { supplyItem: { select: { name: true } } }
        });

        return task;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GET /inventory/counts
    // Count history for an item or all items
    // ─────────────────────────────────────────────────────────────────────────
    fastify.get('/inventory/counts', async (request, reply) => {
        const tenantId = getTenant(request);
        const { supplyItemId, from, to, limit } = request.query as {
            supplyItemId?: string;
            from?: string;
            to?: string;
            limit?: string;
        };

        const where: any = { tenantId };
        if (supplyItemId) where.supplyItemId = supplyItemId;
        if (from || to) {
            where.date = {};
            if (from) where.date.gte = new Date(from);
            if (to) where.date.lte = new Date(to + 'T23:59:59Z');
        }

        const counts = await prisma.inventoryCount.findMany({
            where,
            include: {
                supplyItem: { select: { name: true, defaultUnit: true } }
            },
            orderBy: { date: 'desc' },
            take: parseInt(limit || '100')
        });

        return counts;
    });
}
