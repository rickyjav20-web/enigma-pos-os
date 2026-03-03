/**
 * KdsPage — Kitchen Display System v2
 *
 * Features:
 * - Shows all OPEN + recently COMPLETED orders (last 6h) in real time
 * - Per-item tap-to-mark: each item can be marked individually
 * - Smart auto-complete: when ALL items of an order are marked done,
 *   ORDER_DONE is auto-fired (no extra tap needed)
 * - "Todo Listo" full-order button still available for quick sends
 * - ITEM_DONE + ORDER_DONE logged to KitchenActivityLog
 * - Urgency colours: sage → blue → amber → red (0-5, 5-12, 12-20, 20+ min)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
    Bell, CheckCircle2, Circle, Clock, MapPin, RefreshCw,
    ShoppingBag, Flame, AlertTriangle, Loader2, Wifi, WifiOff,
    ChevronDown
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrderItem {
    id: string;
    productNameSnapshot: string;
    quantity: number;
    unitPrice: number;
    kdsStation?: string | null;
}

interface Order {
    id: string;
    status: 'open' | 'completed';
    createdAt: string;
    totalAmount: number;
    paymentMethod: string;
    tableName: string | null;
    ticketName: string | null;
    items: OrderItem[];
    _elapsed?: number;
    _urgency?: 'fresh' | 'normal' | 'late' | 'urgent';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function minutesAgo(dateStr: string): number {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

function getUrgency(mins: number): 'fresh' | 'normal' | 'late' | 'urgent' {
    if (mins < 5) return 'fresh';
    if (mins < 12) return 'normal';
    if (mins < 20) return 'late';
    return 'urgent';
}

function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function formatElapsed(mins: number): string {
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// ─── Urgency config ───────────────────────────────────────────────────────────
const URGENCY = {
    fresh: {
        border: 'border-l-[#93B59D]',
        bg: 'bg-[#1C402E]/30',
        badge: 'bg-[#93B59D]/15 text-[#93B59D]',
        label: 'Nuevo',
        dot: 'bg-[#93B59D] shadow-[0_0_8px_rgba(147,181,157,0.7)] animate-pulse',
    },
    normal: {
        border: 'border-l-blue-500',
        bg: 'bg-blue-500/5',
        badge: 'bg-blue-500/15 text-blue-400',
        label: 'En curso',
        dot: 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]',
    },
    late: {
        border: 'border-l-amber-500',
        bg: 'bg-amber-500/5',
        badge: 'bg-amber-500/15 text-amber-400',
        label: 'Tardando',
        dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-pulse',
    },
    urgent: {
        border: 'border-l-red-500',
        bg: 'bg-red-500/8',
        badge: 'bg-red-500/15 text-red-400',
        label: '¡Urgente!',
        dot: 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse',
    },
};

// ─── Main Component ─────────────────────────────────────────────────────────
export default function KdsPage() {
    const { user } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [doneOrderIds, setDoneOrderIds] = useState<Set<string>>(new Set());
    const [doneItemIds, setDoneItemIds] = useState<Set<string>>(new Set());
    const [markingOrder, setMarkingOrder] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [online, setOnline] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [, forceRender] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [stationFilter, setStationFilter] = useState<string>(
        () => localStorage.getItem('kds_station_filter') || ''
    );

    // ── Fetch done state (ORDER_DONE + ITEM_DONE logs from today) ─────────────
    const fetchDoneState = useCallback(async () => {
        try {
            const from = `${new Date().toISOString().split('T')[0]}T00:00:00.000Z`;
            const [orderRes, itemRes] = await Promise.all([
                api.get('/kitchen/activity', { params: { action: 'ORDER_DONE', from } }),
                api.get('/kitchen/activity', { params: { action: 'ITEM_DONE', from } }),
            ]);
            const orderLogs: any[] = orderRes.data?.data || [];
            const itemLogs: any[] = itemRes.data?.data || [];
            setDoneOrderIds(new Set(orderLogs.map(l => l.entityId).filter(Boolean)));
            setDoneItemIds(new Set(itemLogs.map(l => l.entityId).filter(Boolean)));
        } catch {
            // Non-critical
        }
    }, []);

    // ── Fetch orders (open + completed, last 6h) ──────────────────────────────
    const fetchOrders = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api.get('/sales', { params: { status: 'open,completed' } });
            const all: Order[] = res.data?.data || [];
            const cutoff = Date.now() - 6 * 60 * 60 * 1000;
            const recent = all
                .filter(o => new Date(o.createdAt).getTime() > cutoff)
                .map(o => {
                    const mins = minutesAgo(o.createdAt);
                    return { ...o, _elapsed: mins, _urgency: getUrgency(mins) };
                })
                // Open orders first, then by age (oldest first = most urgent)
                .sort((a, b) => {
                    if (a.status === 'open' && b.status !== 'open') return -1;
                    if (a.status !== 'open' && b.status === 'open') return 1;
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                });
            setOrders(recent);
            setLastRefresh(new Date());
            setOnline(true);
        } catch {
            setOnline(false);
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Initial load ──────────────────────────────────────────────────────────
    useEffect(() => {
        void Promise.all([fetchOrders(), fetchDoneState()]);
    }, [fetchOrders, fetchDoneState]);

    // ── Auto-refresh every 10s ────────────────────────────────────────────────
    useEffect(() => {
        const interval = setInterval(() => {
            fetchOrders(true);
            fetchDoneState();
        }, 10000);
        return () => clearInterval(interval);
    }, [fetchOrders, fetchDoneState]);

    // ── Update elapsed timers every minute ───────────────────────────────────
    useEffect(() => {
        timerRef.current = setInterval(() => {
            setOrders(prev => prev.map(o => {
                const mins = minutesAgo(o.createdAt);
                return { ...o, _elapsed: mins, _urgency: getUrgency(mins) };
            }));
            forceRender(n => n + 1);
        }, 60000);
        return () => { if (timerRef.current !== null) clearInterval(timerRef.current); };
    }, []);

    // ── Mark single item done ─────────────────────────────────────────────────
    const handleMarkItemDone = useCallback(async (order: Order, item: OrderItem) => {
        if (!user || doneItemIds.has(item.id) || doneOrderIds.has(order.id)) return;

        // Optimistic: add item to done set immediately
        const newDoneItems = new Set([...doneItemIds, item.id]);
        setDoneItemIds(newDoneItems);

        try {
            await api.post('/kitchen/activity', {
                employeeId: user.id,
                employeeName: user.name,
                action: 'ITEM_DONE',
                entityType: 'SalesItem',
                entityId: item.id,
                entityName: `${item.quantity}× ${item.productNameSnapshot}`,
                quantity: item.quantity,
                metadata: { orderId: order.id, productName: item.productNameSnapshot },
            });
        } catch {
            // Revert optimistic update on failure
            setDoneItemIds(prev => {
                const next = new Set(prev);
                next.delete(item.id);
                return next;
            });
            return;
        }

        // Auto-complete: if ALL items now done → fire ORDER_DONE
        const allDone = order.items.every(i => newDoneItems.has(i.id));
        if (allDone && !doneOrderIds.has(order.id)) {
            // Auto-trigger ORDER_DONE (no setMarkingOrder — it's automatic)
            try {
                await api.post('/kitchen/activity', {
                    employeeId: user.id,
                    employeeName: user.name,
                    action: 'ORDER_DONE',
                    entityType: 'SalesOrder',
                    entityId: order.id,
                    entityName: order.tableName
                        ? `${order.tableName} — $${order.totalAmount.toFixed(2)}`
                        : `Orden $${order.totalAmount.toFixed(2)}`,
                });
                setDoneOrderIds(prev => new Set([...prev, order.id]));
            } catch {
                // Non-critical — order will retry on next poll
            }
        }
    }, [user, doneItemIds, doneOrderIds]);

    // ── Mark full order done (all items + ORDER_DONE in one tap) ─────────────
    const handleMarkOrderDone = useCallback(async (order: Order) => {
        if (!user || doneOrderIds.has(order.id)) return;
        setMarkingOrder(order.id);

        const undoneItems = order.items.filter(i => !doneItemIds.has(i.id));

        try {
            // Log ITEM_DONE for any items not yet individually done
            await Promise.all(undoneItems.map(item =>
                api.post('/kitchen/activity', {
                    employeeId: user.id,
                    employeeName: user.name,
                    action: 'ITEM_DONE',
                    entityType: 'SalesItem',
                    entityId: item.id,
                    entityName: `${item.quantity}× ${item.productNameSnapshot}`,
                    quantity: item.quantity,
                    metadata: { orderId: order.id, productName: item.productNameSnapshot },
                })
            ));

            // Log ORDER_DONE
            await api.post('/kitchen/activity', {
                employeeId: user.id,
                employeeName: user.name,
                action: 'ORDER_DONE',
                entityType: 'SalesOrder',
                entityId: order.id,
                entityName: order.tableName
                    ? `${order.tableName} — $${order.totalAmount.toFixed(2)}`
                    : `Orden $${order.totalAmount.toFixed(2)}`,
            });

            // Update state
            setDoneOrderIds(prev => new Set([...prev, order.id]));
            setDoneItemIds(prev => {
                const next = new Set(prev);
                undoneItems.forEach(i => next.add(i.id));
                return next;
            });
        } catch (e) {
            console.error('Failed to mark order done', e);
        } finally {
            setMarkingOrder(null);
        }
    }, [user, doneItemIds, doneOrderIds]);

    // ── Derived state ─────────────────────────────────────────────────────────
    // Orders paid from POS (status='completed') auto-move to done — no KDS action needed.
    // This keeps prep-time averages clean (only KDS-processed orders generate ORDER_DONE logs).
    const allActiveOrders = orders.filter(o => o.status === 'open' && !doneOrderIds.has(o.id));
    const doneOrders = orders.filter(o => doneOrderIds.has(o.id) || o.status === 'completed');

    // Station filter: if set, show only items matching this station (or unassigned items)
    const activeOrders = stationFilter
        ? allActiveOrders
            .map(o => ({
                ...o,
                items: o.items.filter(i => !i.kdsStation || i.kdsStation === stationFilter),
            }))
            .filter(o => o.items.length > 0)
        : allActiveOrders;

    // Collect unique station names from all current items for filter pills
    const availableStations = Array.from(new Set(
        orders.flatMap(o => o.items.map(i => i.kdsStation).filter(Boolean) as string[])
    )).sort();

    const urgentCount = activeOrders.filter(o => o._urgency === 'urgent' || o._urgency === 'late').length;
    const openCount = activeOrders.filter(o => o.status === 'open').length;

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-[#93B59D]/40">
                <Loader2 size={28} className="animate-spin text-[#93B59D]" />
                <span className="text-sm">Cargando pedidos...</span>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[#121413] overflow-hidden">

            {/* ── Header ── */}
            <div className="px-5 pt-4 pb-3 border-b border-white/[0.05] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Bell size={20} className="text-[#93B59D]" />
                        {activeOrders.length > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 rounded-full text-[10px] font-black text-white flex items-center justify-center px-1 shadow-[0_0_8px_rgba(239,68,68,0.6)]">
                                {activeOrders.length}
                            </span>
                        )}
                    </div>
                    <div>
                        <h1 className="text-[15px] font-bold text-white leading-none">Pantalla de Pedidos</h1>
                        <p className="text-[11px] text-[#F4F0EA]/40 mt-0.5">
                            {activeOrders.length === 0
                                ? '✓ Todo al día'
                                : urgentCount > 0
                                    ? <span className="text-red-400">{urgentCount} urgente{urgentCount > 1 ? 's' : ''} · {activeOrders.length} total</span>
                                    : <>
                                        {openCount > 0 && <span className="text-blue-400">{openCount} abierta{openCount > 1 ? 's' : ''} · </span>}
                                        {activeOrders.length} pendiente{activeOrders.length > 1 ? 's' : ''}
                                      </>
                            }
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-1 ${online ? 'text-[#F4F0EA]/25' : 'text-red-400'}`}>
                        {online ? <Wifi size={12} /> : <WifiOff size={12} />}
                        <span className="text-[10px] tabular-nums hidden sm:block">
                            {lastRefresh.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <button
                        onClick={() => { void fetchOrders(true); void fetchDoneState(); }}
                        className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#F4F0EA]/40 hover:text-white transition-colors"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* ── Station Filter Pills ── */}
            {availableStations.length > 0 && (
                <div className="flex gap-2 px-4 py-2 border-b border-white/[0.04] overflow-x-auto scrollbar-none shrink-0">
                    <button
                        onClick={() => {
                            setStationFilter('');
                            localStorage.setItem('kds_station_filter', '');
                        }}
                        className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                            !stationFilter
                                ? 'bg-[#93B59D] text-[#121413]'
                                : 'bg-white/[0.04] text-[#F4F0EA]/40 border border-white/[0.06]'
                        }`}
                    >
                        Todos
                    </button>
                    {availableStations.map(station => (
                        <button
                            key={station}
                            onClick={() => {
                                const next = stationFilter === station ? '' : station;
                                setStationFilter(next);
                                localStorage.setItem('kds_station_filter', next);
                            }}
                            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                                stationFilter === station
                                    ? 'bg-[#93B59D] text-[#121413]'
                                    : 'bg-white/[0.04] text-[#F4F0EA]/40 border border-white/[0.06]'
                            }`}
                        >
                            {station}
                        </button>
                    ))}
                </div>
            )}

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 portrait:px-3">

                {/* Empty state */}
                {activeOrders.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-48 gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-[#1C402E]/40 border border-[#93B59D]/15 flex items-center justify-center">
                            <CheckCircle2 size={24} className="text-[#93B59D]" />
                        </div>
                        <p className="text-base font-semibold text-white">Cocina al día</p>
                        <p className="text-sm text-[#F4F0EA]/40 text-center max-w-[200px]">
                            No hay pedidos pendientes de preparar.
                        </p>
                    </div>
                )}

                {/* Active orders */}
                {activeOrders.map(order => (
                    <OrderCard
                        key={order.id}
                        order={order}
                        doneItemIds={doneItemIds}
                        onMarkItem={(item) => void handleMarkItemDone(order, item)}
                        onMarkAll={() => void handleMarkOrderDone(order)}
                        isMarkingAll={markingOrder === order.id}
                    />
                ))}

                {/* Done orders — compact list */}
                {doneOrders.length > 0 && (
                    <div className="pt-2">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex-1 h-px bg-white/[0.04]" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#F4F0EA]/25 px-2">
                                Completados hoy ({doneOrders.length})
                            </span>
                            <div className="flex-1 h-px bg-white/[0.04]" />
                        </div>
                        <div className="space-y-2">
                            {doneOrders.slice(0, 8).map(order => (
                                <DoneOrderRow key={order.id} order={order} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Order Card (active) ────────────────────────────────────────────────────
function OrderCard({
    order, doneItemIds, onMarkItem, onMarkAll, isMarkingAll
}: {
    order: Order;
    doneItemIds: Set<string>;
    onMarkItem: (item: OrderItem) => void;
    onMarkAll: () => void;
    isMarkingAll: boolean;
}) {
    const urgency = order._urgency || 'fresh';
    const elapsed = order._elapsed ?? 0;
    const style = URGENCY[urgency];

    const totalItems = order.items.length;
    const doneCount = order.items.filter(i => doneItemIds.has(i.id)).length;
    const allItemsDone = doneCount === totalItems;
    const progressPct = totalItems > 0 ? (doneCount / totalItems) * 100 : 0;

    return (
        <div className={`
            rounded-2xl border border-l-4 overflow-hidden transition-all
            ${style.border} ${style.bg} border-white/[0.06]
        `}>
            {/* ── Card header ── */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
                    <div>
                        {order.tableName ? (
                            <div className="flex items-center gap-1.5">
                                <MapPin size={12} className="text-[#F4F0EA]/55" />
                                <span className="text-sm font-bold text-white">{order.tableName}</span>
                                {order.status === 'open' && (
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full border border-blue-500/20">
                                        Abierto
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <ShoppingBag size={12} className="text-[#F4F0EA]/55" />
                                <span className="text-sm font-bold text-[#F4F0EA]/75">
                                    {order.ticketName || 'Para llevar'}
                                </span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-[#F4F0EA]/40">{formatTime(order.createdAt)}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${style.badge}`}>
                                {formatElapsed(elapsed)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {urgency === 'urgent' && <Flame size={13} className="text-red-400" />}
                    {urgency === 'late' && <AlertTriangle size={13} className="text-amber-400" />}
                    <span className="text-xs font-bold font-mono text-[#F4F0EA]/75">
                        ${order.totalAmount.toFixed(2)}
                    </span>
                </div>
            </div>

            {/* ── Progress bar ── */}
            {totalItems > 1 && (
                <div className="px-4 pb-2">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-[#F4F0EA]/35">
                            {doneCount}/{totalItems} listos
                        </span>
                        <span className="text-[10px] text-[#F4F0EA]/25">
                            {totalItems - doneCount} restante{totalItems - doneCount !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${
                                allItemsDone ? 'bg-[#93B59D]' : 'bg-amber-400'
                            }`}
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>
            )}

            {/* ── Items — tappable rows ── */}
            <div className="px-3 pb-2 space-y-1">
                {order.items.map(item => {
                    const done = doneItemIds.has(item.id);
                    return (
                        <button
                            key={item.id}
                            onClick={() => onMarkItem(item)}
                            disabled={done}
                            className={`
                                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                                transition-all duration-150 touch-manipulation
                                ${done
                                    ? 'bg-[#93B59D]/8 border border-[#93B59D]/15 opacity-60 cursor-default'
                                    : 'bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] active:scale-[0.98]'
                                }
                            `}
                        >
                            {/* Quantity badge */}
                            <span className={`
                                w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0
                                text-[13px] font-black
                                ${done
                                    ? 'bg-[#93B59D]/20 text-[#93B59D]'
                                    : 'bg-white/[0.08] text-white'
                                }
                            `}>
                                {item.quantity}
                            </span>

                            {/* Product name */}
                            <span className={`
                                flex-1 text-sm font-medium text-left leading-tight
                                ${done ? 'line-through text-[#F4F0EA]/35' : 'text-[#F4F0EA]/90'}
                            `}>
                                {item.productNameSnapshot}
                            </span>

                            {/* Check/circle icon */}
                            {done
                                ? <CheckCircle2 size={18} className="text-[#93B59D] flex-shrink-0" />
                                : <Circle size={18} className="text-white/20 flex-shrink-0" />
                            }
                        </button>
                    );
                })}
            </div>

            {/* ── Full-order button ── */}
            <button
                onClick={onMarkAll}
                disabled={isMarkingAll || allItemsDone}
                className={`
                    w-full py-3.5 flex items-center justify-center gap-2
                    border-t border-white/[0.04]
                    text-sm font-bold transition-all
                    active:scale-[0.99] disabled:opacity-40
                    ${allItemsDone
                        ? 'bg-[#1C402E]/60 text-[#93B59D] cursor-default'
                        : 'bg-black/20 hover:bg-[#1C402E]/60 text-[#93B59D] hover:text-white'
                    }
                `}
            >
                {isMarkingAll
                    ? <Loader2 size={16} className="animate-spin" />
                    : allItemsDone
                        ? <CheckCircle2 size={16} />
                        : <ChevronDown size={16} />
                }
                {isMarkingAll
                    ? 'Enviando...'
                    : allItemsDone
                        ? 'Todo listo — Pedido completado'
                        : `Enviar todo${order.tableName ? ` — ${order.tableName}` : ''}`
                }
            </button>
        </div>
    );
}

// ─── Done Order Row ─────────────────────────────────────────────────────────
function DoneOrderRow({ order }: { order: Order }) {
    return (
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] opacity-50">
            <CheckCircle2 size={14} className="text-[#93B59D] flex-shrink-0" />
            <div className="flex-1 min-w-0">
                <span className="text-xs text-[#F4F0EA]/55 font-medium truncate">
                    {order.tableName || order.ticketName || 'Para llevar'}
                </span>
                <span className="text-xs text-[#F4F0EA]/25 ml-2">
                    {order.items.map(i => `${i.quantity}× ${i.productNameSnapshot}`).join(', ')}
                </span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
                <Clock size={10} className="text-[#F4F0EA]/15" />
                <span className="text-[10px] text-[#F4F0EA]/25">{formatTime(order.createdAt)}</span>
            </div>
        </div>
    );
}
