/**
 * analytics.ts — Business Intelligence API for Enigma HQ Dashboard
 *
 * All endpoints aggregate from existing models (no schema changes needed).
 * Prefix: /api/v1
 *
 * Endpoints:
 *   GET /analytics/summary/today        — real-time ops overview
 *   GET /analytics/revenue/daily        — daily trend (date range)
 *   GET /analytics/revenue/hourly       — hourly breakdown for one day
 *   GET /analytics/revenue/by-method    — cash/card/transfer split
 *   GET /analytics/products/velocity    — top products by units+revenue
 *   GET /analytics/products/profitability — margin analysis
 *   GET /analytics/categories/performance — category revenue mix
 *   GET /analytics/tables/performance   — table efficiency + zone view
 *   GET /analytics/tables/occupancy     — hourly occupancy for one day
 *   GET /analytics/staff/sales          — employee revenue leaderboard
 *   GET /analytics/staff/goals          — goal completion leaderboard
 *   GET /analytics/cash/accuracy        — cashier variance report
 *   GET /analytics/kitchen/production   — kitchen production by employee
 *   GET /analytics/waste/digest         — waste cost + top offenders (complement to /waste/dashboard)
 *   GET /analytics/inventory/health     — stock level snapshot
 */
import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma';
import { getEffectiveRecipeUnitCost } from '../lib/inventory-math';
import { getOperationalUnit } from '../lib/units';

export default async function analyticsRoutes(fastify: FastifyInstance) {

    const getTenant = (req: any): string => req.tenantId || 'enigma_hq';
    type ImportedAnalyticsEvent = {
        id: string;
        day: string;
        hour: number;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        externalId: string | null;
        productId: string | null;
        productName: string;
        categoryId: string | null;
    };

    // ── helpers ──────────────────────────────────────────────────────────────
    function dateRange(from?: string, to?: string): { gte: Date; lte: Date } {
        const now = new Date();
        const start = from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0));
        const end = to ? new Date(to) : new Date(new Date().setHours(23, 59, 59, 999));
        return { gte: start, lte: end };
    }

    function todayRange() {
        const now = new Date();
        return {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
            lte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
        };
    }

    function dayKey(date: Date | string): string {
        return new Date(date).toISOString().split('T')[0];
    }

    async function getLiveOrderDays(tenantId: string, range: { gte: Date; lte: Date }) {
        const orders = await prisma.salesOrder.findMany({
            where: { tenantId, status: 'completed', createdAt: range },
            select: { createdAt: true },
        });

        return new Set(orders.map((order) => dayKey(order.createdAt)));
    }

    async function getImportedEventsForAnalytics(
        tenantId: string,
        range: { gte: Date; lte: Date },
        skipDays = new Set<string>()
    ): Promise<ImportedAnalyticsEvent[]> {
        const [events, products] = await Promise.all([
            prisma.saleEvent.findMany({
                where: {
                    tenantId,
                    timestamp: range,
                    status: { in: ['PROCESSED', 'CONSUMED'] },
                    saleBatch: {
                        is: {
                            status: { in: ['COMPLETED', 'PROCESSED'] },
                        },
                    },
                },
                select: {
                    id: true,
                    sku: true,
                    productName: true,
                    quantity: true,
                    unitPrice: true,
                    totalPrice: true,
                    externalId: true,
                    timestamp: true,
                },
            }),
            prisma.product.findMany({
                where: { tenantId },
                select: { id: true, sku: true, name: true, categoryId: true },
            }),
        ]);

        const skuMap = new Map<string, { id: string; name: string; categoryId: string | null }>();
        const nameMap = new Map<string, { id: string; name: string; categoryId: string | null }>();

        for (const product of products) {
            if (product.sku) skuMap.set(product.sku.toLowerCase(), product);
            nameMap.set(product.name.toLowerCase(), product);
        }

        return events
            .filter((event) => !skipDays.has(dayKey(event.timestamp)))
            .map((event) => {
                const matched = (event.sku && skuMap.get(event.sku.toLowerCase()))
                    || nameMap.get(event.productName.toLowerCase())
                    || null;

                return {
                    id: event.id,
                    day: dayKey(event.timestamp),
                    hour: event.timestamp.getHours(),
                    quantity: event.quantity,
                    unitPrice: event.unitPrice,
                    totalPrice: event.totalPrice,
                    externalId: event.externalId,
                    productId: matched?.id || null,
                    productName: matched?.name || event.productName,
                    categoryId: matched?.categoryId || null,
                };
            });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /analytics/summary/today
    // Real-time operational snapshot
    // ─────────────────────────────────────────────────────────────────────────
    fastify.get('/analytics/summary/today', async (req, reply) => {
        const tenantId = getTenant(req);
        const today = todayRange();

        const [
            todayOrders,
            openOrders,
            openTables,
            allTables,
            openSessions,
            wasteToday,
            goalsToday,
        ] = await Promise.all([
            // Completed orders today
            prisma.salesOrder.findMany({
                where: { tenantId, status: 'completed', createdAt: today },
                select: { totalAmount: true, paymentMethod: true, tableId: true, employeeId: true },
            }),
            // Open orders right now
            prisma.salesOrder.count({ where: { tenantId, status: 'open' } }),
            // Occupied tables
            prisma.diningTable.count({
                where: { tenantId, salesOrders: { some: { status: 'open' } } },
            }),
            // Total active tables
            prisma.diningTable.count({ where: { tenantId, isActive: true } }),
            // Open register sessions
            prisma.registerSession.findMany({
                where: { tenantId, status: 'open' },
                select: { id: true, employeeId: true, startedAt: true },
            }),
            // Waste events today
            prisma.kitchenActivityLog.findMany({
                where: { tenantId, action: 'WASTE', createdAt: today },
                select: { quantity: true, metadata: true, entityId: true },
            }),
            // Daily goals today
            prisma.dailyGoal.aggregate({
                where: { tenantId, date: new Date().toISOString().split('T')[0] },
                _count: { id: true },
                _sum: { currentQty: true },
            }),
        ]);

        const totalRevenue = todayOrders.reduce((s, o) => s + o.totalAmount, 0);
        const orderCount = todayOrders.length;
        const avgTicket = orderCount > 0 ? totalRevenue / orderCount : 0;

        // Payment split
        const paymentSplit = todayOrders.reduce<Record<string, { count: number; total: number }>>((acc, o) => {
            const m = o.paymentMethod || 'other';
            if (!acc[m]) acc[m] = { count: 0, total: 0 };
            acc[m].count++;
            acc[m].total += o.totalAmount;
            return acc;
        }, {});

        // Waste cost (using fixed $5 avg if no item data — production should look up averageCost)
        const wasteCost = wasteToday.reduce((s, w) => {
            const qty = w.quantity ?? 0;
            const meta = w.metadata as any;
            const unitCost = meta?.unitCost ?? meta?.averageCost ?? 0;
            return s + qty * unitCost;
        }, 0);

        // Session hours for run-rate
        const sessionRevenues = openSessions.map(s => {
            const hours = (Date.now() - new Date(s.startedAt).getTime()) / 3_600_000;
            const sessionOrders = todayOrders.filter(o => true); // rough total
            return { id: s.id, hoursOpen: Math.max(0.5, hours) };
        });
        const avgHoursOpen = sessionRevenues.length > 0
            ? sessionRevenues.reduce((s, r) => s + r.hoursOpen, 0) / sessionRevenues.length
            : 1;
        const runRatePerHour = avgHoursOpen > 0 ? totalRevenue / avgHoursOpen : 0;

        const completedGoals = await prisma.dailyGoal.count({
            where: { tenantId, date: new Date().toISOString().split('T')[0], isCompleted: true },
        });

        return {
            // Revenue
            revenue: {
                total: Math.round(totalRevenue * 100) / 100,
                orderCount,
                avgTicket: Math.round(avgTicket * 100) / 100,
                runRatePerHour: Math.round(runRatePerHour * 100) / 100,
                byMethod: paymentSplit,
            },
            // Tables
            tables: {
                occupied: openTables,
                total: allTables,
                occupancyRate: allTables > 0 ? Math.round((openTables / allTables) * 100) / 100 : 0,
                openOrders,
            },
            // Register
            register: {
                openSessions: openSessions.length,
                sessionIds: openSessions.map(s => s.id),
            },
            // Waste
            waste: {
                events: wasteToday.length,
                estimatedCost: Math.round(wasteCost * 100) / 100,
                wasteRatioEstimate: totalRevenue > 0 ? Math.round((wasteCost / totalRevenue) * 10000) / 10000 : 0,
            },
            // Goals
            goals: {
                total: goalsToday._count.id,
                completed: completedGoals,
                completionRate: goalsToday._count.id > 0
                    ? Math.round((completedGoals / goalsToday._count.id) * 100) / 100
                    : 0,
            },
            generatedAt: new Date().toISOString(),
        };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GET /analytics/revenue/daily
    // ?from=YYYY-MM-DD&to=YYYY-MM-DD
    // ─────────────────────────────────────────────────────────────────────────
    fastify.get('/analytics/revenue/daily', async (req, reply) => {
        const tenantId = getTenant(req);
        const { from, to } = req.query as { from?: string; to?: string };
        const range = dateRange(from, to);

        const orders = await prisma.salesOrder.findMany({
            where: { tenantId, status: 'completed', createdAt: range },
            select: { totalAmount: true, paymentMethod: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        });

        // Group by date
        const byDate: Record<string, { date: string; revenue: number; orders: number; cash: number; card: number; transfer: number }> = {};
        for (const o of orders) {
            const d = o.createdAt.toISOString().split('T')[0];
            if (!byDate[d]) byDate[d] = { date: d, revenue: 0, orders: 0, cash: 0, card: 0, transfer: 0 };
            byDate[d].revenue += o.totalAmount;
            byDate[d].orders++;
            if (o.paymentMethod === 'cash') byDate[d].cash += o.totalAmount;
            else if (o.paymentMethod === 'card') byDate[d].card += o.totalAmount;
            else if (o.paymentMethod === 'transfer') byDate[d].transfer += o.totalAmount;
        }

        const liveDays = new Set(Object.keys(byDate));
        const importedEvents = await getImportedEventsForAnalytics(tenantId, range, liveDays);
        const importedOrdersByDay: Record<string, Set<string>> = {};

        for (const event of importedEvents) {
            if (!byDate[event.day]) byDate[event.day] = { date: event.day, revenue: 0, orders: 0, cash: 0, card: 0, transfer: 0 };
            byDate[event.day].revenue += event.totalPrice;
            if (!importedOrdersByDay[event.day]) importedOrdersByDay[event.day] = new Set();
            importedOrdersByDay[event.day].add(event.externalId || `event:${event.id}`);
        }

        for (const [day, orderKeys] of Object.entries(importedOrdersByDay)) {
            byDate[day].orders += orderKeys.size;
        }

        const result = Object.values(byDate).map(d => ({
            ...d,
            revenue: Math.round(d.revenue * 100) / 100,
            avgTicket: d.orders > 0 ? Math.round((d.revenue / d.orders) * 100) / 100 : 0,
            cash: Math.round(d.cash * 100) / 100,
            card: Math.round(d.card * 100) / 100,
            transfer: Math.round(d.transfer * 100) / 100,
        }));

        // Period totals
        const totals = result.reduce((a, d) => ({
            revenue: a.revenue + d.revenue,
            orders: a.orders + d.orders,
        }), { revenue: 0, orders: 0 });

        return {
            data: result,
            totals: {
                revenue: Math.round(totals.revenue * 100) / 100,
                orders: totals.orders,
                avgTicket: totals.orders > 0 ? Math.round((totals.revenue / totals.orders) * 100) / 100 : 0,
                days: result.length,
            },
        };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GET /analytics/revenue/hourly
    // ?date=YYYY-MM-DD (defaults to today)
    // ─────────────────────────────────────────────────────────────────────────
    fastify.get('/analytics/revenue/hourly', async (req, reply) => {
        const tenantId = getTenant(req);
        const { date } = req.query as { date?: string };
        const d = date ? new Date(date) : new Date();
        const range = {
            gte: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0),
            lte: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59),
        };

        const orders = await prisma.salesOrder.findMany({
            where: { tenantId, status: 'completed', createdAt: range },
            select: { totalAmount: true, createdAt: true, tableId: true },
        });

        // Build 24-hour grid
        const hours: Record<number, { hour: number; revenue: number; orders: number; tablesActive: Set<string> }> = {};
        for (let h = 0; h < 24; h++) hours[h] = { hour: h, revenue: 0, orders: 0, tablesActive: new Set() };

        for (const o of orders) {
            const h = o.createdAt.getHours();
            hours[h].revenue += o.totalAmount;
            hours[h].orders++;
            if (o.tableId) hours[h].tablesActive.add(o.tableId);
        }

        if (orders.length === 0) {
            const importedEvents = await getImportedEventsForAnalytics(tenantId, range);
            const hourlyOrderKeys: Record<number, Set<string>> = {};

            for (const event of importedEvents) {
                hours[event.hour].revenue += event.totalPrice;
                if (!hourlyOrderKeys[event.hour]) hourlyOrderKeys[event.hour] = new Set();
                hourlyOrderKeys[event.hour].add(event.externalId || `event:${event.id}`);
            }

            for (const [hour, orderKeys] of Object.entries(hourlyOrderKeys)) {
                hours[Number(hour)].orders += orderKeys.size;
            }
        }

        return Object.values(hours).map(h => ({
            hour: h.hour,
            label: `${String(h.hour).padStart(2, '0')}:00`,
            revenue: Math.round(h.revenue * 100) / 100,
            orders: h.orders,
            tablesActive: h.tablesActive.size,
            avgTicket: h.orders > 0 ? Math.round((h.revenue / h.orders) * 100) / 100 : 0,
        }));
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GET /analytics/products/velocity
    // ?from=&to=&limit=20
    // ─────────────────────────────────────────────────────────────────────────
    fastify.get('/analytics/products/velocity', async (req, reply) => {
        const tenantId = getTenant(req);
        const { from, to, limit } = req.query as { from?: string; to?: string; limit?: string };
        const range = dateRange(from, to);
        const take = Math.min(parseInt(limit || '20', 10), 100);

        const items = await prisma.salesItem.findMany({
            where: {
                salesOrder: { tenantId, status: 'completed', createdAt: range },
            },
            select: {
                productId: true,
                productNameSnapshot: true,
                quantity: true,
                unitPrice: true,
                totalPrice: true,
            },
        });

        // Aggregate by product
        const byProduct: Record<string, {
            productId: string; name: string;
            unitsSold: number; revenue: number; avgPrice: number; orders: number;
        }> = {};

        for (const i of items) {
            const key = i.productId || i.productNameSnapshot;
            if (!byProduct[key]) {
                byProduct[key] = {
                    productId: i.productId || '',
                    name: i.productNameSnapshot,
                    unitsSold: 0,
                    revenue: 0,
                    avgPrice: i.unitPrice,
                    orders: 0,
                };
            }
            byProduct[key].unitsSold += i.quantity;
            byProduct[key].revenue += i.totalPrice;
            byProduct[key].orders++;
        }

        const liveDays = await getLiveOrderDays(tenantId, range);
        const importedEvents = await getImportedEventsForAnalytics(tenantId, range, liveDays);
        for (const event of importedEvents) {
            const key = event.productId || event.productName;
            if (!byProduct[key]) {
                byProduct[key] = {
                    productId: event.productId || '',
                    name: event.productName,
                    unitsSold: 0,
                    revenue: 0,
                    avgPrice: event.unitPrice,
                    orders: 0,
                };
            }
            byProduct[key].unitsSold += event.quantity;
            byProduct[key].revenue += event.totalPrice;
            byProduct[key].orders++;
        }

        // Sort by revenue, take top N
        const sorted = Object.values(byProduct)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, take)
            .map((p, idx) => ({
                rank: idx + 1,
                productId: p.productId,
                name: p.name,
                unitsSold: p.unitsSold,
                revenue: Math.round(p.revenue * 100) / 100,
                avgPrice: Math.round(p.avgPrice * 100) / 100,
                revenueShare: 0, // computed below
            }));

        const totalRevenue = sorted.reduce((s, p) => s + p.revenue, 0);
        sorted.forEach(p => {
            p.revenueShare = totalRevenue > 0 ? Math.round((p.revenue / totalRevenue) * 10000) / 10000 : 0;
        });

        return { data: sorted, totalRevenue: Math.round(totalRevenue * 100) / 100 };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GET /analytics/products/profitability
    // ?limit=20
    // ─────────────────────────────────────────────────────────────────────────
    fastify.get('/analytics/products/profitability', async (req, reply) => {
        const tenantId = getTenant(req);
        const { from, to, limit } = req.query as { from?: string; to?: string; limit?: string };
        const range = dateRange(from, to);
        const take = Math.min(parseInt(limit || '20', 10), 100);

        // Get products with recipes
        const products = await prisma.product.findMany({
            where: { tenantId },
            select: {
                id: true,
                name: true,
                categoryId: true,
                price: true,
                cost: true,
                recipes: {
                    select: {
                        quantity: true,
                        costAtCreation: true,
                        supplyItem: {
                            select: {
                                averageCost: true,
                                currentCost: true,
                                stockCorrectionFactor: true,
                                yieldPercentage: true,
                            }
                        },
                    },
                },
            },
        });

        // Compute COGS from recipe
        const productMargins = products.map(p => {
            let cogs = p.cost ?? 0;
            if (p.recipes.length > 0 && cogs === 0) {
                cogs = p.recipes.reduce((s, r) => {
                    const itemCost = r.costAtCreation ?? getEffectiveRecipeUnitCost({
                        rawCost: r.supplyItem?.averageCost ?? r.supplyItem?.currentCost ?? 0,
                        stockCorrectionFactor: r.supplyItem?.stockCorrectionFactor,
                        yieldPercentage: r.supplyItem?.yieldPercentage,
                    });
                    return s + r.quantity * itemCost;
                }, 0);
            }
            const margin = p.price - cogs;
            const marginPct = p.price > 0 ? margin / p.price : 0;
            return { id: p.id, name: p.name, categoryId: p.categoryId || null, price: p.price, cogs, margin, marginPct };
        });

        // Sales counts for the period
        const salesCounts = await prisma.salesItem.groupBy({
            by: ['productId'],
            where: { salesOrder: { tenantId, status: 'completed', createdAt: range } },
            _sum: { quantity: true, totalPrice: true },
        });

        const salesMap: Record<string, { units: number; revenue: number }> = {};
        for (const s of salesCounts) {
            salesMap[s.productId || ''] = {
                units: s._sum.quantity ?? 0,
                revenue: s._sum.totalPrice ?? 0,
            };
        }

        const liveDays = await getLiveOrderDays(tenantId, range);
        const importedEvents = await getImportedEventsForAnalytics(tenantId, range, liveDays);
        for (const event of importedEvents) {
            if (!event.productId) continue;
            if (!salesMap[event.productId]) {
                salesMap[event.productId] = { units: 0, revenue: 0 };
            }
            salesMap[event.productId].units += event.quantity;
            salesMap[event.productId].revenue += event.totalPrice;
        }

        const result = productMargins
            .map(p => {
                const s = salesMap[p.id] || { units: 0, revenue: 0 };
                return {
                    productId: p.id,
                    name: p.name,
                    sellingPrice: Math.round(p.price * 100) / 100,
                    cogs: Math.round(p.cogs * 100) / 100,
                    margin: Math.round(p.margin * 100) / 100,
                    marginPct: Math.round(p.marginPct * 10000) / 10000,
                    unitsSold: s.units,
                    contribution: Math.round(p.margin * s.units * 100) / 100,
                    revenue: Math.round(s.revenue * 100) / 100,
                };
            })
            .sort((a, b) => b.contribution - a.contribution)
            .slice(0, take);

        return { data: result };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GET /analytics/categories/performance
    // ?from=&to=
    // ─────────────────────────────────────────────────────────────────────────
    fastify.get('/analytics/categories/performance', async (req, reply) => {
        const tenantId = getTenant(req);
        const { from, to } = req.query as { from?: string; to?: string };
        const range = dateRange(from, to);

        const items = await prisma.salesItem.findMany({
            where: { salesOrder: { tenantId, status: 'completed', createdAt: range } },
            select: {
                quantity: true,
                totalPrice: true,
                product: { select: { categoryId: true } },
            },
        });

        const byCategory: Record<string, { name: string; revenue: number; units: number }> = {};
        for (const i of items) {
            const catId = i.product?.categoryId || 'uncategorized';
            const catName = catId === 'uncategorized' ? 'Sin Categoría' : catId;
            if (!byCategory[catId]) byCategory[catId] = { name: catName, revenue: 0, units: 0 };
            byCategory[catId].revenue += i.totalPrice;
            byCategory[catId].units += i.quantity;
        }

        const liveDays = await getLiveOrderDays(tenantId, range);
        const importedEvents = await getImportedEventsForAnalytics(tenantId, range, liveDays);
        for (const event of importedEvents) {
            const catId = event.categoryId || 'uncategorized';
            const catName = catId === 'uncategorized' ? 'Sin Categoría' : catId;
            if (!byCategory[catId]) byCategory[catId] = { name: catName, revenue: 0, units: 0 };
            byCategory[catId].revenue += event.totalPrice;
            byCategory[catId].units += event.quantity;
        }

        const total = Object.values(byCategory).reduce((s, c) => s + c.revenue, 0);
        const result = Object.entries(byCategory)
            .map(([id, c]) => ({
                categoryId: id,
                name: c.name,
                revenue: Math.round(c.revenue * 100) / 100,
                units: c.units,
                revenueShare: total > 0 ? Math.round((c.revenue / total) * 10000) / 10000 : 0,
            }))
            .sort((a, b) => b.revenue - a.revenue);

        return { data: result, totalRevenue: Math.round(total * 100) / 100 };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GET /analytics/tables/performance
    // ?from=&to=
    // ─────────────────────────────────────────────────────────────────────────
    fastify.get('/analytics/tables/performance', async (req, reply) => {
        const tenantId = getTenant(req);
        const { from, to } = req.query as { from?: string; to?: string };
        const range = dateRange(from, to);

        const tables = await prisma.diningTable.findMany({
            where: { tenantId, isActive: true },
            select: { id: true, name: true, zone: true, capacity: true },
        });

        const orders = await prisma.salesOrder.findMany({
            where: { tenantId, status: 'completed', tableId: { not: null }, createdAt: range },
            select: { tableId: true, tableName: true, totalAmount: true, createdAt: true },
        });

        // Build table stats
        const tableStats: Record<string, { orders: number; revenue: number; lastOrder: Date | null }> = {};
        for (const o of orders) {
            const tid = o.tableId!;
            if (!tableStats[tid]) tableStats[tid] = { orders: 0, revenue: 0, lastOrder: null };
            tableStats[tid].orders++;
            tableStats[tid].revenue += o.totalAmount;
            if (!tableStats[tid].lastOrder || o.createdAt > tableStats[tid].lastOrder!) {
                tableStats[tid].lastOrder = o.createdAt;
            }
        }

        const result = tables.map(t => {
            const s = tableStats[t.id] || { orders: 0, revenue: 0, lastOrder: null };
            return {
                tableId: t.id,
                name: t.name,
                zone: t.zone,
                capacity: t.capacity,
                orders: s.orders,
                revenue: Math.round(s.revenue * 100) / 100,
                avgTicket: s.orders > 0 ? Math.round((s.revenue / s.orders) * 100) / 100 : 0,
                lastOrder: s.lastOrder?.toISOString() || null,
                // Revenue per seat estimate
                revenuePerSeat: t.capacity && t.capacity > 0 && s.orders > 0
                    ? Math.round((s.revenue / (t.capacity * Math.max(s.orders, 1))) * 100) / 100
                    : 0,
            };
        }).sort((a, b) => b.revenue - a.revenue);

        // Zone summary
        const byZone: Record<string, { zone: string; tables: number; revenue: number; orders: number }> = {};
        for (const t of result) {
            const z = t.zone || 'General';
            if (!byZone[z]) byZone[z] = { zone: z, tables: 0, revenue: 0, orders: 0 };
            byZone[z].tables++;
            byZone[z].revenue += t.revenue;
            byZone[z].orders += t.orders;
        }

        return {
            tables: result,
            byZone: Object.values(byZone).map(z => ({
                ...z,
                revenue: Math.round(z.revenue * 100) / 100,
                avgTicket: z.orders > 0 ? Math.round((z.revenue / z.orders) * 100) / 100 : 0,
            })).sort((a, b) => b.revenue - a.revenue),
        };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GET /analytics/staff/sales
    // ?from=&to=&limit=20
    // ─────────────────────────────────────────────────────────────────────────
    fastify.get('/analytics/staff/sales', async (req, reply) => {
        const tenantId = getTenant(req);
        const { from, to, limit } = req.query as { from?: string; to?: string; limit?: string };
        const range = dateRange(from, to);
        const take = parseInt(limit || '20', 10);

        const orders = await prisma.salesOrder.findMany({
            where: { tenantId, status: 'completed', employeeId: { not: null }, createdAt: range },
            select: { employeeId: true, totalAmount: true, createdAt: true },
        });

        const byEmp: Record<string, { revenue: number; orders: number; lastSale: Date | null }> = {};
        for (const o of orders) {
            const eid = o.employeeId!;
            if (!byEmp[eid]) byEmp[eid] = { revenue: 0, orders: 0, lastSale: null };
            byEmp[eid].revenue += o.totalAmount;
            byEmp[eid].orders++;
            if (!byEmp[eid].lastSale || o.createdAt > byEmp[eid].lastSale!) byEmp[eid].lastSale = o.createdAt;
        }

        // Lookup employee names
        const empIds = Object.keys(byEmp);
        const employees = empIds.length > 0
            ? await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullName: true, role: true } })
            : [];
        const empMap: Record<string, { name: string; role: string }> = {};
        for (const e of employees) empMap[e.id] = { name: e.fullName, role: e.role };

        const result = Object.entries(byEmp)
            .map(([id, s], idx) => ({
                rank: idx + 1,
                employeeId: id,
                name: empMap[id]?.name || id,
                role: empMap[id]?.role || '',
                revenue: Math.round(s.revenue * 100) / 100,
                orders: s.orders,
                avgTicket: s.orders > 0 ? Math.round((s.revenue / s.orders) * 100) / 100 : 0,
                lastSale: s.lastSale?.toISOString() || null,
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, take)
            .map((r, i) => ({ ...r, rank: i + 1 }));

        return { data: result };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GET /analytics/staff/goals
    // ?date=YYYY-MM-DD (defaults to today)
    // ─────────────────────────────────────────────────────────────────────────
    fastify.get('/analytics/staff/goals', async (req, reply) => {
        const tenantId = getTenant(req);
        const { date } = req.query as { date?: string };
        const targetDate = date || new Date().toISOString().split('T')[0];

        const goals = await prisma.dailyGoal.findMany({
            where: { tenantId, date: targetDate },
            select: {
                employeeId: true,
                type: true,
                targetName: true,
                targetQty: true,
                currentQty: true,
                isCompleted: true,
                rewardValue: true,
                completedAt: true,
            },
        });

        // Group by employee
        const byEmp: Record<string, {
            total: number; completed: number; totalReward: number;
            completedAt: Date | null;
        }> = {};
        for (const g of goals) {
            if (!byEmp[g.employeeId]) byEmp[g.employeeId] = { total: 0, completed: 0, totalReward: 0, completedAt: null };
            byEmp[g.employeeId].total++;
            if (g.isCompleted) {
                byEmp[g.employeeId].completed++;
                byEmp[g.employeeId].totalReward += g.rewardValue ?? 0;
                if (g.completedAt && (!byEmp[g.employeeId].completedAt || g.completedAt > byEmp[g.employeeId].completedAt!)) {
                    byEmp[g.employeeId].completedAt = g.completedAt;
                }
            }
        }

        const empIds = Object.keys(byEmp);
        const employees = empIds.length > 0
            ? await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullName: true } })
            : [];
        const empMap: Record<string, string> = {};
        for (const e of employees) empMap[e.id] = e.fullName;

        const result = Object.entries(byEmp)
            .map(([id, s]) => ({
                employeeId: id,
                name: empMap[id] || id,
                total: s.total,
                completed: s.completed,
                completionRate: s.total > 0 ? Math.round((s.completed / s.total) * 100) / 100 : 0,
                totalReward: s.totalReward,
                lastCompletedAt: s.completedAt?.toISOString() || null,
            }))
            .sort((a, b) => b.completionRate - a.completionRate)
            .map((r, i) => ({ ...r, rank: i + 1 }));

        return { date: targetDate, data: result };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GET /analytics/cash/accuracy
    // ?from=&to=
    // ─────────────────────────────────────────────────────────────────────────
    fastify.get('/analytics/cash/accuracy', async (req, reply) => {
        const tenantId = getTenant(req);
        const { from, to } = req.query as { from?: string; to?: string };
        const range = dateRange(from, to);

        const sessions = await prisma.registerSession.findMany({
            where: { tenantId, status: 'closed', endedAt: range },
            select: {
                id: true,
                employeeId: true,
                startedAt: true,
                endedAt: true,
                declaredCash: true,
                expectedCash: true,
                registerType: true,
                notes: true,
            },
        });

        const empIds = [...new Set(sessions.map(s => s.employeeId))];
        const employees = empIds.length > 0
            ? await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullName: true } })
            : [];
        const empMap: Record<string, string> = {};
        for (const e of employees) empMap[e.id] = e.fullName;

        const byCashier: Record<string, {
            sessions: number; perfectCloses: number; totalVariance: number;
        }> = {};

        const sessionDetails = sessions.map(s => {
            const variance = (s.declaredCash ?? 0) - (s.expectedCash ?? 0);
            const isPerfect = Math.abs(variance) < 0.01;
            const eid = s.employeeId;
            if (!byCashier[eid]) byCashier[eid] = { sessions: 0, perfectCloses: 0, totalVariance: 0 };
            byCashier[eid].sessions++;
            if (isPerfect) byCashier[eid].perfectCloses++;
            byCashier[eid].totalVariance += Math.abs(variance);

            const durationMins = s.endedAt && s.startedAt
                ? Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000)
                : null;

            return {
                sessionId: s.id,
                employeeId: eid,
                employeeName: empMap[eid] || eid,
                registerType: s.registerType,
                date: s.startedAt.toISOString().split('T')[0],
                shiftDurationMins: durationMins,
                expectedCash: Math.round((s.expectedCash ?? 0) * 100) / 100,
                declaredCash: Math.round((s.declaredCash ?? 0) * 100) / 100,
                variance: Math.round(variance * 100) / 100,
                isPerfect,
            };
        });

        const cashierSummary = Object.entries(byCashier).map(([id, c]) => ({
            employeeId: id,
            name: empMap[id] || id,
            sessions: c.sessions,
            perfectCloses: c.perfectCloses,
            accuracyRate: c.sessions > 0 ? Math.round((c.perfectCloses / c.sessions) * 100) / 100 : 0,
            totalVariance: Math.round(c.totalVariance * 100) / 100,
            avgVariance: c.sessions > 0 ? Math.round((c.totalVariance / c.sessions) * 100) / 100 : 0,
        })).sort((a, b) => b.accuracyRate - a.accuracyRate);

        const totalVariance = sessionDetails.reduce((s, r) => s + Math.abs(r.variance), 0);
        const perfectCloses = sessionDetails.filter(r => r.isPerfect).length;

        return {
            summary: {
                totalSessions: sessions.length,
                perfectCloses,
                accuracyRate: sessions.length > 0 ? Math.round((perfectCloses / sessions.length) * 100) / 100 : 0,
                totalVariance: Math.round(totalVariance * 100) / 100,
                avgVariancePerSession: sessions.length > 0 ? Math.round((totalVariance / sessions.length) * 100) / 100 : 0,
            },
            byCashier: cashierSummary,
            sessions: sessionDetails.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)),
        };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GET /analytics/kitchen/production
    // ?from=&to=
    // ─────────────────────────────────────────────────────────────────────────
    fastify.get('/analytics/kitchen/production', async (req, reply) => {
        const tenantId = getTenant(req);
        const { from, to } = req.query as { from?: string; to?: string };
        const range = dateRange(from, to);

        const [prodLogs, wasteLogs, doneLogs] = await Promise.all([
            prisma.kitchenActivityLog.findMany({
                where: { tenantId, action: 'PRODUCTION', createdAt: range },
                select: { employeeId: true, employeeName: true, entityName: true, quantity: true, unit: true, createdAt: true },
            }),
            prisma.kitchenActivityLog.findMany({
                where: { tenantId, action: 'WASTE', createdAt: range },
                select: { employeeId: true, employeeName: true, entityName: true, quantity: true, metadata: true },
            }),
            prisma.kitchenActivityLog.findMany({
                where: { tenantId, action: 'ORDER_DONE', createdAt: range },
                select: { employeeId: true, employeeName: true, entityId: true, entityName: true, createdAt: true },
            }),
        ]);

        // By employee: production
        const byEmp: Record<string, {
            name: string; productionEvents: number; unitsProduced: number;
            wasteEvents: number; wasteCost: number; ordersDone: number;
        }> = {};

        for (const p of prodLogs) {
            const eid = p.employeeId;
            if (!byEmp[eid]) byEmp[eid] = { name: p.employeeName, productionEvents: 0, unitsProduced: 0, wasteEvents: 0, wasteCost: 0, ordersDone: 0 };
            byEmp[eid].productionEvents++;
            byEmp[eid].unitsProduced += p.quantity ?? 0;
        }
        for (const w of wasteLogs) {
            const eid = w.employeeId;
            if (!byEmp[eid]) byEmp[eid] = { name: w.employeeName, productionEvents: 0, unitsProduced: 0, wasteEvents: 0, wasteCost: 0, ordersDone: 0 };
            byEmp[eid].wasteEvents++;
            const meta = w.metadata as any;
            byEmp[eid].wasteCost += (w.quantity ?? 0) * (meta?.unitCost ?? meta?.averageCost ?? 0);
        }
        for (const d of doneLogs) {
            const eid = d.employeeId;
            if (!byEmp[eid]) byEmp[eid] = { name: d.employeeName, productionEvents: 0, unitsProduced: 0, wasteEvents: 0, wasteCost: 0, ordersDone: 0 };
            byEmp[eid].ordersDone++;
        }

        // Daily breakdown for ORDER_DONE (kitchen throughput)
        const throughputByDay: Record<string, number> = {};
        for (const d of doneLogs) {
            const day = d.createdAt.toISOString().split('T')[0];
            throughputByDay[day] = (throughputByDay[day] || 0) + 1;
        }

        const staff = Object.entries(byEmp).map(([id, s]) => ({
            employeeId: id,
            name: s.name,
            productionEvents: s.productionEvents,
            unitsProduced: s.unitsProduced,
            ordersDone: s.ordersDone,
            wasteEvents: s.wasteEvents,
            wasteCost: Math.round(s.wasteCost * 100) / 100,
        })).sort((a, b) => b.ordersDone - a.ordersDone);

        return {
            summary: {
                totalProductionEvents: prodLogs.length,
                totalOrdersDone: doneLogs.length,
                totalWasteEvents: wasteLogs.length,
            },
            staff,
            throughputByDay: Object.entries(throughputByDay)
                .map(([date, count]) => ({ date, ordersDone: count }))
                .sort((a, b) => a.date.localeCompare(b.date)),
        };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GET /analytics/inventory/health
    // Snapshot of stock vs. par levels
    // ─────────────────────────────────────────────────────────────────────────
    fastify.get('/analytics/inventory/health', async (req, reply) => {
        const tenantId = getTenant(req);

        const items = await prisma.supplyItem.findMany({
            where: { tenantId, isActive: true },
            select: {
                id: true, name: true, category: true,
                stockQuantity: true, minStock: true, parLevel: true, maxStock: true,
                currentCost: true, averageCost: true,
                defaultUnit: true, yieldUnit: true, isProduction: true, countZone: true,
                lastCountedAt: true, lastPurchaseDate: true,
            },
        });

        const critical = items.filter(i => i.stockQuantity <= (i.minStock ?? 0));
        const belowPar = items.filter(i => i.parLevel && i.stockQuantity < i.parLevel && i.stockQuantity > (i.minStock ?? 0));
        const healthy = items.filter(i => i.parLevel ? i.stockQuantity >= i.parLevel : i.stockQuantity > (i.minStock ?? 0));
        const overstock = items.filter(i => i.maxStock && i.stockQuantity > i.maxStock);

        // Total inventory value
        const totalValue = items.reduce((s, i) => s + i.stockQuantity * (i.averageCost ?? i.currentCost ?? 0), 0);

        // Days since last count
        const now = Date.now();
        const staleCounts = items.filter(i => {
            if (!i.lastCountedAt) return true;
            const daysSince = (now - new Date(i.lastCountedAt).getTime()) / 86_400_000;
            return daysSince > 7;
        });

        return {
            summary: {
                totalItems: items.length,
                critical: critical.length,
                belowPar: belowPar.length,
                healthy: healthy.length,
                overstock: overstock.length,
                staleCount: staleCounts.length,
                totalInventoryValue: Math.round(totalValue * 100) / 100,
            },
            critical: critical.map(i => ({
                id: i.id, name: i.name, category: i.category,
                stock: i.stockQuantity, minStock: i.minStock, unit: getOperationalUnit(i),
                status: 'CRITICAL',
            })),
            belowPar: belowPar.map(i => ({
                id: i.id, name: i.name, category: i.category,
                stock: i.stockQuantity, parLevel: i.parLevel, unit: getOperationalUnit(i),
                deficit: Math.round(((i.parLevel ?? 0) - i.stockQuantity) * 100) / 100,
                status: 'BELOW_PAR',
            })),
        };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GET /analytics/waste/digest
    // Top-line waste metrics (complements /waste/dashboard)
    // ?from=&to=
    // ─────────────────────────────────────────────────────────────────────────
    fastify.get('/analytics/waste/digest', async (req, reply) => {
        const tenantId = getTenant(req);
        const { from, to } = req.query as { from?: string; to?: string };
        const range = dateRange(from, to);

        const [wasteLogs, periodRevenue] = await Promise.all([
            prisma.kitchenActivityLog.findMany({
                where: { tenantId, action: 'WASTE', createdAt: range },
                select: {
                    employeeId: true, employeeName: true,
                    entityId: true, entityName: true,
                    quantity: true, unit: true,
                    metadata: true, createdAt: true,
                },
            }),
            prisma.salesOrder.aggregate({
                where: { tenantId, status: 'completed', createdAt: range },
                _sum: { totalAmount: true },
            }),
        ]);

        const totalRevenue = periodRevenue._sum.totalAmount ?? 0;

        // Aggregate cost
        let totalWasteCost = 0;
        const byItem: Record<string, { name: string; qty: number; cost: number; events: number }> = {};
        const byReason: Record<string, { count: number; cost: number }> = {};
        const byEmployee: Record<string, { name: string; cost: number; count: number }> = {};

        for (const w of wasteLogs) {
            const meta = w.metadata as any;
            const unitCost = meta?.unitCost ?? meta?.averageCost ?? 0;
            const cost = (w.quantity ?? 0) * unitCost;
            totalWasteCost += cost;

            // By item
            const ikey = (w.entityId ?? w.entityName) ?? 'unknown';
            if (!byItem[ikey]) byItem[ikey] = { name: w.entityName ?? ikey, qty: 0, cost: 0, events: 0 };
            byItem[ikey].qty += w.quantity ?? 0;
            byItem[ikey].cost += cost;
            byItem[ikey].events++;

            // By reason
            const reason = meta?.wasteType || 'UNKNOWN';
            if (!byReason[reason]) byReason[reason] = { count: 0, cost: 0 };
            byReason[reason].count++;
            byReason[reason].cost += cost;

            // By employee
            const eid = w.employeeId;
            if (!byEmployee[eid]) byEmployee[eid] = { name: w.employeeName, cost: 0, count: 0 };
            byEmployee[eid].cost += cost;
            byEmployee[eid].count++;
        }

        return {
            summary: {
                wasteEvents: wasteLogs.length,
                totalWasteCost: Math.round(totalWasteCost * 100) / 100,
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                wastePctRevenue: totalRevenue > 0
                    ? Math.round((totalWasteCost / totalRevenue) * 10000) / 10000
                    : 0,
            },
            topWastedItems: Object.values(byItem)
                .sort((a, b) => b.cost - a.cost)
                .slice(0, 10)
                .map(i => ({ ...i, cost: Math.round(i.cost * 100) / 100, qty: Math.round(i.qty * 100) / 100 })),
            byReason: Object.entries(byReason)
                .map(([reason, r]) => ({ reason, count: r.count, cost: Math.round(r.cost * 100) / 100 }))
                .sort((a, b) => b.cost - a.cost),
            topWasters: Object.entries(byEmployee)
                .map(([id, e]) => ({
                    employeeId: id, name: e.name,
                    cost: Math.round(e.cost * 100) / 100, events: e.count,
                }))
                .sort((a, b) => b.cost - a.cost)
                .slice(0, 5),
        };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GET /analytics/orders/timing
    // KDS performance — order creation → ORDER_DONE timing
    // ?from=&to=
    // ─────────────────────────────────────────────────────────────────────────
    fastify.get('/analytics/orders/timing', async (req, reply) => {
        const tenantId = getTenant(req);
        const { from, to } = req.query as { from?: string; to?: string };
        const range = dateRange(from, to);

        const [orders, doneLogs] = await Promise.all([
            prisma.salesOrder.findMany({
                where: { tenantId, status: 'completed', createdAt: range },
                select: { id: true, createdAt: true, totalAmount: true, tableId: true, tableName: true },
            }),
            prisma.kitchenActivityLog.findMany({
                where: { tenantId, action: 'ORDER_DONE', createdAt: range },
                select: { entityId: true, createdAt: true, employeeId: true, employeeName: true },
            }),
        ]);

        // Build a map of orderId → ORDER_DONE time
        const doneMap: Record<string, Date> = {};
        for (const d of doneLogs) {
            if (d.entityId && !doneMap[d.entityId]) doneMap[d.entityId] = d.createdAt;
        }

        const timings = orders
            .filter(o => doneMap[o.id])
            .map(o => {
                const prepSec = (doneMap[o.id].getTime() - o.createdAt.getTime()) / 1000;
                return {
                    orderId: o.id,
                    tableId: o.tableId,
                    tableName: o.tableName,
                    createdAt: o.createdAt.toISOString(),
                    doneAt: doneMap[o.id].toISOString(),
                    prepSeconds: Math.round(prepSec),
                    prepMinutes: Math.round(prepSec / 60),
                    isLate: prepSec > 20 * 60, // >20 min = late
                };
            });

        const avgPrepSec = timings.length > 0
            ? timings.reduce((s, t) => s + t.prepSeconds, 0) / timings.length
            : 0;
        const lateCount = timings.filter(t => t.isLate).length;

        return {
            summary: {
                ordersTracked: timings.length,
                totalOrders: orders.length,
                coverageRate: orders.length > 0 ? Math.round((timings.length / orders.length) * 100) / 100 : 0,
                avgPrepSeconds: Math.round(avgPrepSec),
                avgPrepMinutes: Math.round(avgPrepSec / 60),
                lateOrders: lateCount,
                slaComplianceRate: timings.length > 0 ? Math.round(((timings.length - lateCount) / timings.length) * 100) / 100 : 0,
            },
            data: timings.sort((a, b) => b.prepSeconds - a.prepSeconds),
        };
    });
}
