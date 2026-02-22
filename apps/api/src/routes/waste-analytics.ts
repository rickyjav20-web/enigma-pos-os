import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';

export default async function wasteAnalyticsRoutes(fastify: FastifyInstance) {

    const getTenant = (req: any) => req.tenantId as string;

    // Zone classification helpers
    const getZone = (item: { isProduction: boolean; countZone?: number | null }): number => {
        if (item.countZone) return item.countZone;
        return item.isProduction ? 2 : 3;
    };

    const ZONE_LABELS: Record<number, string> = {
        1: 'Zona 1 — Barra/Caja',
        2: 'Zona 2 — Cocina/Producción',
        3: 'Zona 3 — Almacén/Prep'
    };

    const WASTE_TYPE_LABELS: Record<string, string> = {
        'WRONG_ORDER':          'Pedido Erróneo',
        'DAMAGED':              'Accidente / Daño',
        'LOST':                 'Pérdida / Faltante',
        'EXPIRED':              'Caducado / Vencido',
        'PRODUCTION_FAILURE':   'Fallo de Producción',
        'INVENTORY_CORRECTION': 'Corrección de Inventario'
    };

    // ─────────────────────────────────────────────────────────────────────────
    // GET /waste/dashboard
    // Comprehensive waste analytics for HQ dashboard
    // ─────────────────────────────────────────────────────────────────────────
    fastify.get('/waste/dashboard', async (request, reply) => {
        const tenantId = getTenant(request);
        const { from, to, zone } = request.query as {
            from?: string;
            to?: string;
            zone?: string;
        };

        const now = new Date();
        const fromDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
        const toDate = to ? new Date(to + 'T23:59:59Z') : now;

        // Parse zone filter (comma-separated: "1,2,3")
        const zoneFilter = zone ? zone.split(',').map(Number).filter(Boolean) : null;

        // ── Fetch all waste logs in period ─────────────────────────────────────
        const wasteLogs = await prisma.kitchenActivityLog.findMany({
            where: {
                tenantId,
                action: 'WASTE',
                createdAt: { gte: fromDate, lte: toDate }
            },
            orderBy: { createdAt: 'desc' }
        });

        // ── Get supply item details for cost calculation ───────────────────────
        const supplyItemIds = [...new Set(
            wasteLogs
                .filter(l => l.entityType === 'supply_item' && l.entityId)
                .map(l => l.entityId!)
        )];

        const supplyItems = supplyItemIds.length > 0
            ? await prisma.supplyItem.findMany({
                where: { id: { in: supplyItemIds } },
                select: { id: true, name: true, currentCost: true, averageCost: true, defaultUnit: true, isProduction: true, category: true, countZone: true }
            })
            : [];

        const itemMap = new Map(supplyItems.map(i => [i.id, i]));

        // ── Calculate cost for each log entry ─────────────────────────────────
        interface EnrichedLog {
            id: string;
            entityId: string | null;
            entityName: string | null;
            entityType: string | null;
            employeeId: string;
            employeeName: string;
            quantity: number;
            unit: string | null;
            wasteType: string;
            costLost: number;
            zone: number;
            date: Date;
        }

        const enriched: EnrichedLog[] = [];

        for (const log of wasteLogs) {
            const item = log.entityId ? itemMap.get(log.entityId) : null;
            const unitCost = item ? (item.averageCost || item.currentCost || 0) : 0;
            const qty = log.quantity || 0;
            const costLost = qty * unitCost;
            const zone = item ? getZone(item) : (log.entityType === 'product' ? 1 : 3);

            if (zoneFilter && !zoneFilter.includes(zone)) continue;

            const meta = (log.metadata || {}) as Record<string, any>;
            const wasteType = (meta.wasteType || 'UNKNOWN') as string;

            enriched.push({
                id: log.id,
                entityId: log.entityId,
                entityName: log.entityName,
                entityType: log.entityType,
                employeeId: log.employeeId,
                employeeName: log.employeeName,
                quantity: qty,
                unit: log.unit,
                wasteType,
                costLost,
                zone,
                date: log.createdAt
            });
        }

        const totalCost = enriched.reduce((s, l) => s + l.costLost, 0);
        const totalQtyLost = enriched.reduce((s, l) => s + l.quantity, 0);

        // ── By Item ───────────────────────────────────────────────────────────
        const byItemMap = new Map<string, { itemId: string; name: string; zone: number; qty: number; costLost: number; events: number; unit: string }>();

        for (const l of enriched) {
            const key = l.entityId || l.entityName || 'unknown';
            if (!byItemMap.has(key)) {
                byItemMap.set(key, { itemId: key, name: l.entityName || 'Desconocido', zone: l.zone, qty: 0, costLost: 0, events: 0, unit: l.unit || 'und' });
            }
            const entry = byItemMap.get(key)!;
            entry.qty += l.quantity;
            entry.costLost += l.costLost;
            entry.events += 1;
        }

        const byItem = Array.from(byItemMap.values()).sort((a, b) => b.costLost - a.costLost);
        const worstItem = byItem[0] || null;

        // ── By Type ───────────────────────────────────────────────────────────
        const byTypeMap = new Map<string, { type: string; label: string; count: number; costLost: number }>();

        for (const l of enriched) {
            if (!byTypeMap.has(l.wasteType)) {
                byTypeMap.set(l.wasteType, { type: l.wasteType, label: WASTE_TYPE_LABELS[l.wasteType] || l.wasteType, count: 0, costLost: 0 });
            }
            const e = byTypeMap.get(l.wasteType)!;
            e.count++;
            e.costLost += l.costLost;
        }

        const byType = Array.from(byTypeMap.values())
            .map(t => ({ ...t, pct: enriched.length > 0 ? Math.round((t.count / enriched.length) * 100) : 0 }))
            .sort((a, b) => b.costLost - a.costLost);

        // ── By Zone ───────────────────────────────────────────────────────────
        const byZoneMap = new Map<number, { zone: number; label: string; count: number; costLost: number }>();

        for (const l of enriched) {
            if (!byZoneMap.has(l.zone)) {
                byZoneMap.set(l.zone, { zone: l.zone, label: ZONE_LABELS[l.zone] || `Zona ${l.zone}`, count: 0, costLost: 0 });
            }
            const e = byZoneMap.get(l.zone)!;
            e.count++;
            e.costLost += l.costLost;
        }

        const byZone = Array.from(byZoneMap.values()).sort((a, b) => a.zone - b.zone);

        // ── By Employee ───────────────────────────────────────────────────────
        const byEmpMap = new Map<string, { employeeId: string; name: string; count: number; costLost: number }>();

        for (const l of enriched) {
            if (!byEmpMap.has(l.employeeId)) {
                byEmpMap.set(l.employeeId, { employeeId: l.employeeId, name: l.employeeName, count: 0, costLost: 0 });
            }
            const e = byEmpMap.get(l.employeeId)!;
            e.count++;
            e.costLost += l.costLost;
        }

        const byEmployee = Array.from(byEmpMap.values()).sort((a, b) => b.costLost - a.costLost);

        // ── Timeline (by day) ─────────────────────────────────────────────────
        const timelineMap = new Map<string, { date: string; count: number; costLost: number }>();

        for (const l of enriched) {
            const day = l.date.toISOString().slice(0, 10);
            if (!timelineMap.has(day)) {
                timelineMap.set(day, { date: day, count: 0, costLost: 0 });
            }
            const e = timelineMap.get(day)!;
            e.count++;
            e.costLost += l.costLost;
        }

        const timeline = Array.from(timelineMap.values()).sort((a, b) => a.date.localeCompare(b.date));

        // ── Trend vs previous period ──────────────────────────────────────────
        const periodMs = toDate.getTime() - fromDate.getTime();
        const prevFrom = new Date(fromDate.getTime() - periodMs);
        const prevTo = new Date(fromDate.getTime() - 1);

        const prevLogs = await prisma.kitchenActivityLog.findMany({
            where: { tenantId, action: 'WASTE', createdAt: { gte: prevFrom, lte: prevTo } }
        });

        const prevCost = prevLogs.reduce((s, l) => {
            const item = l.entityId ? itemMap.get(l.entityId) : null;
            const unitCost = item ? (item.averageCost || item.currentCost || 0) : 0;
            return s + (l.quantity || 0) * unitCost;
        }, 0);

        const trendPct = prevCost > 0 ? Math.round(((totalCost - prevCost) / prevCost) * 100) : null;

        // ── Alerts — items with spike vs previous period ───────────────────────
        const alerts: { itemId: string; name: string; message: string; severity: string }[] = [];
        for (const item of byItem.slice(0, 5)) {
            if (item.costLost > 20) {
                alerts.push({
                    itemId: item.itemId,
                    name: item.name,
                    message: `Merma de $${item.costLost.toFixed(2)} en el período — ${item.events} evento${item.events > 1 ? 's' : ''}`,
                    severity: item.costLost > 50 ? 'high' : 'medium'
                });
            }
        }

        return {
            period: {
                from: fromDate.toISOString().slice(0, 10),
                to: toDate.toISOString().slice(0, 10)
            },
            kpis: {
                totalCost: Math.round(totalCost * 100) / 100,
                totalEvents: enriched.length,
                totalQtyLost: Math.round(totalQtyLost * 100) / 100,
                worstItem: worstItem ? { name: worstItem.name, costLost: Math.round(worstItem.costLost * 100) / 100 } : null,
                trendPct
            },
            byItem: byItem.map(i => ({ ...i, costLost: Math.round(i.costLost * 100) / 100, qty: Math.round(i.qty * 1000) / 1000 })),
            byType,
            byZone,
            byEmployee: byEmployee.map(e => ({ ...e, costLost: Math.round(e.costLost * 100) / 100 })),
            timeline: timeline.map(t => ({ ...t, costLost: Math.round(t.costLost * 100) / 100 })),
            alerts
        };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GET /waste/items/:id/history
    // Detailed waste history for a single item across any timeframe
    // ─────────────────────────────────────────────────────────────────────────
    fastify.get('/waste/items/:id/history', async (request, reply) => {
        const tenantId = getTenant(request);
        const { id } = request.params as { id: string };
        const { from, to, limit } = request.query as { from?: string; to?: string; limit?: string };

        const item = await prisma.supplyItem.findUnique({ where: { id }, select: { name: true, defaultUnit: true, currentCost: true, averageCost: true } });
        if (!item) return reply.status(404).send({ error: 'Item not found' });

        const where: any = { tenantId, action: 'WASTE', entityId: id };
        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from);
            if (to) where.createdAt.lte = new Date(to + 'T23:59:59Z');
        }

        const logs = await prisma.kitchenActivityLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit || '200')
        });

        const unitCost = item.averageCost || item.currentCost || 0;
        const events = logs.map(l => ({
            id: l.id,
            date: l.createdAt,
            employeeName: l.employeeName,
            quantity: l.quantity,
            unit: l.unit,
            costLost: Math.round((l.quantity || 0) * unitCost * 100) / 100,
            wasteType: (l.metadata as any)?.wasteType || 'UNKNOWN',
            reason: (l.metadata as any)?.reason || null
        }));

        const totalCost = events.reduce((s, e) => s + e.costLost, 0);

        return {
            item: { id, name: item.name, unit: item.defaultUnit, unitCost },
            totalEvents: events.length,
            totalCost: Math.round(totalCost * 100) / 100,
            events
        };
    });
}
