/**
 * KdsPage — Kitchen Display System v3
 *
 * Horizontal card layout optimized for landscape kitchen displays.
 * - Colored header bar per card (tap to send all)
 * - Per-item tap-to-mark with large touch targets
 * - Urgency colors: green → blue → amber → red
 * - Loud notification sound on new orders
 * - Auto-refresh every 8s
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
    CheckCircle2, Clock, RefreshCw,
    Loader2, Wifi, WifiOff, Volume2, VolumeX,
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
    _urgency?: Urgency;
}

type Urgency = 'fresh' | 'normal' | 'late' | 'urgent';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function minutesAgo(dateStr: string): number {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

function getUrgency(mins: number): Urgency {
    if (mins < 5) return 'fresh';
    if (mins < 12) return 'normal';
    if (mins < 20) return 'late';
    return 'urgent';
}

function formatElapsed(mins: number): string {
    if (mins < 1) return '0:00';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}`;
    return `${m}:00`;
}

function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

// ─── Urgency colors ──────────────────────────────────────────────────────────
const URGENCY_COLORS: Record<Urgency, { bar: string; barText: string; glow: string }> = {
    fresh:  { bar: '#1C6B3A', barText: '#C8E6C9', glow: 'rgba(76,175,80,0.3)' },
    normal: { bar: '#1565C0', barText: '#BBDEFB', glow: 'rgba(33,150,243,0.3)' },
    late:   { bar: '#E65100', barText: '#FFE0B2', glow: 'rgba(255,152,0,0.4)' },
    urgent: { bar: '#B71C1C', barText: '#FFCDD2', glow: 'rgba(244,67,54,0.5)' },
};

// ─── Notification Sound (Web Audio API) ──────────────────────────────────────
function playNotificationSound() {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const notes = [880, 1108.73, 1318.51]; // A5, C#6, E6 — bright major chord
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + i * 0.08);
            osc.stop(ctx.currentTime + 0.6);
        });
        // Second pulse for loudness
        setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'square';
            osc2.frequency.value = 1318.51;
            gain2.gain.setValueAtTime(0.3, ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(ctx.currentTime);
            osc2.stop(ctx.currentTime + 0.4);
        }, 300);
    } catch {
        // Audio not available
    }
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function KdsPage() {
    const { user } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [doneOrderIds, setDoneOrderIds] = useState<Set<string>>(new Set());
    const [doneItemIds, setDoneItemIds] = useState<Set<string>>(new Set());
    const [markingOrder, setMarkingOrder] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [online, setOnline] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('kds_sound') !== 'off');
    const [stationFilter, setStationFilter] = useState<string>(
        () => localStorage.getItem('kds_station_filter') || ''
    );

    const prevOrderIdsRef = useRef<Set<string>>(new Set());
    const initialLoadRef = useRef(true);

    // ── Fetch done state ─────────────────────────────────────────────────────
    const fetchDoneState = useCallback(async () => {
        try {
            const from = `${new Date().toISOString().split('T')[0]}T00:00:00.000Z`;
            const [orderRes, itemRes] = await Promise.all([
                api.get('/kitchen/activity', { params: { action: 'ORDER_DONE', from } }),
                api.get('/kitchen/activity', { params: { action: 'ITEM_DONE', from } }),
            ]);
            setDoneOrderIds(new Set((orderRes.data?.data || []).map((l: any) => l.entityId).filter(Boolean)));
            setDoneItemIds(new Set((itemRes.data?.data || []).map((l: any) => l.entityId).filter(Boolean)));
        } catch { /* non-critical */ }
    }, []);

    // ── Fetch orders ─────────────────────────────────────────────────────────
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
                .sort((a, b) => {
                    if (a.status === 'open' && b.status !== 'open') return -1;
                    if (a.status !== 'open' && b.status === 'open') return 1;
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                });

            // Detect new orders → play sound
            const currentIds = new Set(recent.filter(o => o.status === 'open').map(o => o.id));
            if (!initialLoadRef.current && soundEnabled) {
                for (const id of currentIds) {
                    if (!prevOrderIdsRef.current.has(id)) {
                        playNotificationSound();
                        break; // One sound per poll cycle
                    }
                }
            }
            prevOrderIdsRef.current = currentIds;
            initialLoadRef.current = false;

            setOrders(recent);
            setLastRefresh(new Date());
            setOnline(true);
        } catch {
            setOnline(false);
        } finally {
            setLoading(false);
        }
    }, [soundEnabled]);

    // ── Initial load + auto-refresh ──────────────────────────────────────────
    useEffect(() => {
        void Promise.all([fetchOrders(), fetchDoneState()]);
    }, [fetchOrders, fetchDoneState]);

    useEffect(() => {
        const interval = setInterval(() => {
            fetchOrders(true);
            fetchDoneState();
        }, 8000);
        return () => clearInterval(interval);
    }, [fetchOrders, fetchDoneState]);

    // ── Update elapsed timers every 30s ──────────────────────────────────────
    useEffect(() => {
        const timer = setInterval(() => {
            setOrders(prev => prev.map(o => {
                const mins = minutesAgo(o.createdAt);
                return { ...o, _elapsed: mins, _urgency: getUrgency(mins) };
            }));
        }, 30000);
        return () => clearInterval(timer);
    }, []);

    // ── Mark single item done ────────────────────────────────────────────────
    const handleMarkItemDone = useCallback(async (order: Order, item: OrderItem) => {
        if (!user || doneItemIds.has(item.id) || doneOrderIds.has(order.id)) return;

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
            setDoneItemIds(prev => { const n = new Set(prev); n.delete(item.id); return n; });
            return;
        }

        // Auto-complete when ALL items done
        const allDone = order.items.every(i => newDoneItems.has(i.id));
        if (allDone && !doneOrderIds.has(order.id)) {
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
            } catch { /* retry on next poll */ }
        }
    }, [user, doneItemIds, doneOrderIds]);

    // ── Mark full order done ─────────────────────────────────────────────────
    const handleMarkOrderDone = useCallback(async (order: Order) => {
        if (!user || doneOrderIds.has(order.id)) return;
        setMarkingOrder(order.id);

        const undoneItems = order.items.filter(i => !doneItemIds.has(i.id));

        try {
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

    // ── Derived state ────────────────────────────────────────────────────────
    const allActiveOrders = orders.filter(o => o.status === 'open' && !doneOrderIds.has(o.id));
    const doneOrders = orders.filter(o => doneOrderIds.has(o.id) || o.status === 'completed');

    const activeOrders = stationFilter
        ? allActiveOrders
            .map(o => ({
                ...o,
                items: o.items.filter(i => !i.kdsStation || i.kdsStation === stationFilter),
            }))
            .filter(o => o.items.length > 0)
        : allActiveOrders;

    const availableStations = Array.from(new Set(
        orders.flatMap(o => o.items.map(i => i.kdsStation).filter(Boolean) as string[])
    )).sort();

    // ── Loading state ────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="h-full flex items-center justify-center" style={{ background: '#0D0F0E' }}>
                <Loader2 size={32} className="animate-spin" style={{ color: '#93B59D' }} />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden" style={{ background: '#0D0F0E' }}>

            {/* ── Top Bar ── */}
            <div className="flex items-center justify-between px-4 py-2 shrink-0"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)' }}>
                <div className="flex items-center gap-3">
                    <h1 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#93B59D' }}>
                        KDS
                    </h1>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                            background: activeOrders.length > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(147,181,157,0.15)',
                            color: activeOrders.length > 0 ? '#ef4444' : '#93B59D',
                        }}>
                        {activeOrders.length} pendiente{activeOrders.length !== 1 ? 's' : ''}
                    </span>
                    {doneOrders.length > 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)' }}>
                            {doneOrders.length} completado{doneOrders.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Station filter pills */}
                    {availableStations.length > 0 && (
                        <div className="flex gap-1.5 mr-2">
                            <button
                                onClick={() => { setStationFilter(''); localStorage.setItem('kds_station_filter', ''); }}
                                className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all"
                                style={{
                                    background: !stationFilter ? '#93B59D' : 'rgba(255,255,255,0.04)',
                                    color: !stationFilter ? '#0D0F0E' : 'rgba(255,255,255,0.35)',
                                    border: `1px solid ${!stationFilter ? '#93B59D' : 'rgba(255,255,255,0.06)'}`,
                                }}
                            >All</button>
                            {availableStations.map(s => (
                                <button key={s}
                                    onClick={() => {
                                        const next = stationFilter === s ? '' : s;
                                        setStationFilter(next);
                                        localStorage.setItem('kds_station_filter', next);
                                    }}
                                    className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all"
                                    style={{
                                        background: stationFilter === s ? '#93B59D' : 'rgba(255,255,255,0.04)',
                                        color: stationFilter === s ? '#0D0F0E' : 'rgba(255,255,255,0.35)',
                                        border: `1px solid ${stationFilter === s ? '#93B59D' : 'rgba(255,255,255,0.06)'}`,
                                    }}
                                >{s}</button>
                            ))}
                        </div>
                    )}

                    {/* Sound toggle */}
                    <button
                        onClick={() => {
                            const next = !soundEnabled;
                            setSoundEnabled(next);
                            localStorage.setItem('kds_sound', next ? 'on' : 'off');
                            if (next) playNotificationSound();
                        }}
                        className="p-1.5 rounded-lg transition-all"
                        style={{
                            background: soundEnabled ? 'rgba(147,181,157,0.15)' : 'rgba(255,255,255,0.04)',
                            color: soundEnabled ? '#93B59D' : 'rgba(255,255,255,0.2)',
                        }}
                        title={soundEnabled ? 'Sonido activado' : 'Sonido desactivado'}
                    >
                        {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                    </button>

                    {/* Connection */}
                    <div className="flex items-center gap-1" style={{ color: online ? 'rgba(255,255,255,0.2)' : '#ef4444' }}>
                        {online ? <Wifi size={12} /> : <WifiOff size={12} />}
                        <span className="text-[10px] tabular-nums">
                            {lastRefresh.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={() => { void fetchOrders(true); void fetchDoneState(); }}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)' }}
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* ── Cards Grid — Horizontal Scroll ── */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                {activeOrders.length === 0 ? (
                    /* Empty state */
                    <div className="h-full flex flex-col items-center justify-center gap-4">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                            style={{ background: 'rgba(147,181,157,0.1)', border: '1px solid rgba(147,181,157,0.15)' }}>
                            <CheckCircle2 size={28} style={{ color: '#93B59D' }} />
                        </div>
                        <div className="text-center">
                            <p className="text-base font-bold" style={{ color: 'rgba(255,255,255,0.8)' }}>Cocina al día</p>
                            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                No hay pedidos pendientes
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-3 p-3 h-full"
                        style={{ minWidth: 'min-content' }}>
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

                        {/* Done orders — compact column at the end */}
                        {doneOrders.length > 0 && (
                            <div className="w-[260px] shrink-0 flex flex-col h-full">
                                <div className="px-3 py-2 shrink-0">
                                    <span className="text-[10px] font-bold uppercase tracking-widest"
                                        style={{ color: 'rgba(255,255,255,0.2)' }}>
                                        Completados ({doneOrders.length})
                                    </span>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-1.5 px-1">
                                    {doneOrders.slice(0, 20).map(order => (
                                        <div key={order.id}
                                            className="rounded-lg px-3 py-2 flex items-center gap-2"
                                            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                                            <CheckCircle2 size={12} style={{ color: '#93B59D', opacity: 0.5 }} />
                                            <div className="flex-1 min-w-0">
                                                <span className="text-[11px] font-semibold truncate block"
                                                    style={{ color: 'rgba(255,255,255,0.35)' }}>
                                                    {order.tableName || order.ticketName || 'Para llevar'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <Clock size={9} style={{ color: 'rgba(255,255,255,0.15)' }} />
                                                <span className="text-[10px] tabular-nums" style={{ color: 'rgba(255,255,255,0.2)' }}>
                                                    {formatTime(order.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Order Card ──────────────────────────────────────────────────────────────
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
    const colors = URGENCY_COLORS[urgency];
    const doneCount = order.items.filter(i => doneItemIds.has(i.id)).length;
    const allDone = doneCount === order.items.length;
    const label = order.tableName || order.ticketName || 'Para llevar';

    return (
        <div className="w-[280px] shrink-0 flex flex-col h-full rounded-xl overflow-hidden transition-all"
            style={{
                background: '#161918',
                border: `1px solid rgba(255,255,255,0.06)`,
                boxShadow: `0 4px 24px rgba(0,0,0,0.3), 0 0 0 0 ${colors.glow}`,
            }}>

            {/* ── Colored Header Bar — TAP TO SEND ALL ── */}
            <button
                onClick={onMarkAll}
                disabled={isMarkingAll || allDone}
                className="w-full shrink-0 px-4 py-3.5 flex items-center justify-between transition-all active:brightness-110 disabled:opacity-60"
                style={{ background: allDone ? '#1C402E' : colors.bar, minHeight: '56px' }}
            >
                <div className="flex items-center gap-2 min-w-0">
                    {isMarkingAll ? (
                        <Loader2 size={18} className="animate-spin" style={{ color: colors.barText }} />
                    ) : allDone ? (
                        <CheckCircle2 size={18} style={{ color: '#93B59D' }} />
                    ) : null}
                    <span className="font-extrabold text-[15px] uppercase tracking-wide truncate"
                        style={{ color: allDone ? '#93B59D' : colors.barText }}>
                        {label}
                    </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {doneCount > 0 && !allDone && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(0,0,0,0.3)', color: colors.barText }}>
                            {doneCount}/{order.items.length}
                        </span>
                    )}
                    <div className="flex items-center gap-1">
                        <Clock size={12} style={{ color: colors.barText, opacity: 0.7 }} />
                        <span className="text-sm font-bold font-mono tabular-nums"
                            style={{ color: colors.barText }}>
                            {formatElapsed(elapsed)}
                        </span>
                    </div>
                </div>
            </button>

            {/* ── Items List — scrollable ── */}
            <div className="flex-1 overflow-y-auto py-1">
                {order.items.map(item => {
                    const done = doneItemIds.has(item.id);
                    return (
                        <button
                            key={item.id}
                            onClick={() => onMarkItem(item)}
                            disabled={done}
                            className="w-full flex items-center gap-3 px-3 py-3 text-left transition-all active:scale-[0.98] touch-manipulation"
                            style={{
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                background: done ? 'rgba(147,181,157,0.06)' : 'transparent',
                                opacity: done ? 0.5 : 1,
                            }}
                        >
                            {/* Quantity badge */}
                            <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-black"
                                style={{
                                    background: done ? 'rgba(147,181,157,0.2)' : 'rgba(255,255,255,0.08)',
                                    color: done ? '#93B59D' : '#fff',
                                    border: `1px solid ${done ? 'rgba(147,181,157,0.3)' : 'rgba(255,255,255,0.08)'}`,
                                }}>
                                {item.quantity}
                            </span>

                            {/* Product name */}
                            <span className="flex-1 text-sm font-semibold leading-tight"
                                style={{
                                    color: done ? 'rgba(147,181,157,0.6)' : 'rgba(255,255,255,0.9)',
                                    textDecoration: done ? 'line-through' : 'none',
                                }}>
                                {item.productNameSnapshot}
                            </span>

                            {/* Check icon */}
                            {done && (
                                <CheckCircle2 size={16} style={{ color: '#93B59D' }} className="shrink-0" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── Bottom info ── */}
            <div className="shrink-0 px-3 py-2 flex items-center justify-between"
                style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.2)' }}>
                <span className="text-[10px] tabular-nums" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {formatTime(order.createdAt)}
                </span>
                <span className="text-[11px] font-bold font-mono tabular-nums"
                    style={{ color: 'rgba(255,255,255,0.4)' }}>
                    ${order.totalAmount.toFixed(2)}
                </span>
            </div>
        </div>
    );
}
