/**
 * KdsPage — Kitchen Display System
 * Shows live incoming orders from the POS, grouped by urgency.
 * Kitchen staff marks orders as "Listo" → logs to KitchenActivityLog.
 * Auto-refreshes every 10 seconds.
 *
 * State: orders are tracked as done via KitchenActivityLog (action: ORDER_DONE)
 * so it persists across page refreshes without schema changes.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
    Bell, CheckCircle2, Clock, MapPin, RefreshCw,
    ShoppingBag, Flame, AlertTriangle, Loader2, Wifi, WifiOff
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrderItem {
    id: string;
    productNameSnapshot: string;
    quantity: number;
    unitPrice: number;
}

interface Order {
    id: string;
    createdAt: string;
    totalAmount: number;
    paymentMethod: string;
    tableName: string | null;
    ticketName: string | null;
    items: OrderItem[];
    _elapsed?: number; // minutes since order
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
    return new Date(dateStr).toLocaleTimeString('es', {
        hour: '2-digit', minute: '2-digit'
    });
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

// ─── Main Component ────────────────────────────────────────────────────────────
export default function KdsPage() {
    const { user } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
    const [markingDone, setMarkingDone] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [online, setOnline] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [, forceRender] = useState(0); // for elapsed timer
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Fetch done order IDs from KitchenActivityLog ──
    const fetchDoneOrders = useCallback(async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await api.get('/kitchen/activity', {
                params: { action: 'ORDER_DONE', from: `${today}T00:00:00.000Z` }
            });
            const logs = res.data?.data || [];
            const ids = new Set<string>(logs.map((l: any) => l.entityId).filter(Boolean));
            setDoneIds(ids);
        } catch {
            // Non-critical, keep existing
        }
    }, []);

    // ── Fetch recent sales orders (last 6 hours) ──
    const fetchOrders = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api.get('/sales?status=completed');
            const all: Order[] = res.data?.data || [];

            // Filter last 6 hours
            const cutoff = Date.now() - 6 * 60 * 60 * 1000;
            const recent = all
                .filter(o => new Date(o.createdAt).getTime() > cutoff)
                .map(o => {
                    const mins = minutesAgo(o.createdAt);
                    return { ...o, _elapsed: mins, _urgency: getUrgency(mins) };
                })
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            setOrders(recent);
            setLastRefresh(new Date());
            setOnline(true);
        } catch {
            setOnline(false);
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Initial load ──
    useEffect(() => {
        void Promise.all([fetchOrders(), fetchDoneOrders()]);
    }, [fetchOrders, fetchDoneOrders]);

    // ── Auto-refresh every 10s ──
    useEffect(() => {
        const interval = setInterval(() => {
            fetchOrders(true);
            fetchDoneOrders();
        }, 10000);
        return () => clearInterval(interval);
    }, [fetchOrders, fetchDoneOrders]);

    // ── Update elapsed timers every minute ──
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

    // ── Mark order done ──
    const handleMarkDone = async (order: Order) => {
        if (!user) return;
        setMarkingDone(order.id);
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
            setDoneIds(prev => new Set([...prev, order.id]));
        } catch (e) {
            console.error('Failed to mark done', e);
        } finally {
            setMarkingDone(null);
        }
    };

    // ── Derived: active (not done) orders ──
    const activeOrders = orders.filter(o => !doneIds.has(o.id));
    const doneOrders = orders.filter(o => doneIds.has(o.id));
    const urgentCount = activeOrders.filter(o => o._urgency === 'urgent' || o._urgency === 'late').length;

    // ── Loading screen ──
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
                        <h1 className="text-[15px] font-bold text-white leading-none">
                            Pantalla de Pedidos
                        </h1>
                        <p className="text-[11px] text-[#F4F0EA]/40 mt-0.5">
                            {activeOrders.length === 0
                                ? '✓ Todo al día'
                                : urgentCount > 0
                                    ? <span className="text-red-400">{urgentCount} urgente{urgentCount > 1 ? 's' : ''} · {activeOrders.length} total</span>
                                    : `${activeOrders.length} pendiente${activeOrders.length > 1 ? 's' : ''}`
                            }
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Connection status */}
                    <div className={`flex items-center gap-1 ${online ? 'text-[#F4F0EA]/25' : 'text-red-400'}`}>
                        {online ? <Wifi size={12} /> : <WifiOff size={12} />}
                        <span className="text-[10px] tabular-nums hidden sm:block">
                            {lastRefresh.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <button
                        onClick={() => { fetchOrders(true); fetchDoneOrders(); }}
                        className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#F4F0EA]/40 hover:text-white transition-colors"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

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

                {/* Active orders — newest first */}
                {activeOrders.map(order => (
                    <OrderCard
                        key={order.id}
                        order={order}
                        onDone={() => handleMarkDone(order)}
                        isMarking={markingDone === order.id}
                    />
                ))}

                {/* Done orders (collapsed, last 10) */}
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
    order, onDone, isMarking
}: {
    order: Order;
    onDone: () => void;
    isMarking: boolean;
}) {
    const urgency = order._urgency || 'fresh';
    const elapsed = order._elapsed ?? 0;
    const style = URGENCY[urgency];

    return (
        <div className={`
            rounded-2xl border border-l-4 overflow-hidden transition-all
            ${style.border} ${style.bg}
            border-white/[0.06]
        `}>
            {/* Card header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
                    <div>
                        {order.tableName ? (
                            <div className="flex items-center gap-1.5">
                                <MapPin size={12} className="text-[#F4F0EA]/55" />
                                <span className="text-sm font-bold text-white">{order.tableName}</span>
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

                {/* Urgency badge */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {urgency === 'urgent' && <Flame size={13} className="text-red-400" />}
                    {urgency === 'late' && <AlertTriangle size={13} className="text-amber-400" />}
                    <span className="text-xs font-bold font-mono text-[#F4F0EA]/75">
                        ${order.totalAmount.toFixed(2)}
                    </span>
                </div>
            </div>

            {/* Items list */}
            <div className="px-4 pb-3 space-y-1">
                {order.items.map(item => (
                    <div key={item.id} className="flex items-center gap-2">
                        <span className="
                            w-6 h-6 rounded-lg bg-white/[0.06] border border-white/[0.08]
                            flex items-center justify-center
                            text-[11px] font-black text-white flex-shrink-0
                        ">
                            {item.quantity}
                        </span>
                        <span className="text-sm text-[#F4F0EA]/85 font-medium leading-tight">
                            {item.productNameSnapshot}
                        </span>
                    </div>
                ))}
            </div>

            {/* Done button — big tap target for kitchen use */}
            <button
                onClick={onDone}
                disabled={isMarking}
                className="
                    w-full py-3.5 flex items-center justify-center gap-2
                    bg-black/20 hover:bg-[#1C402E]/60
                    border-t border-white/[0.04]
                    text-sm font-bold text-[#93B59D]
                    hover:text-white transition-all
                    active:scale-[0.99] disabled:opacity-50
                "
            >
                {isMarking
                    ? <Loader2 size={16} className="animate-spin" />
                    : <CheckCircle2 size={16} />
                }
                {isMarking ? 'Marcando...' : 'Listo — Pedido entregado'}
            </button>
        </div>
    );
}

// ─── Done Order Row (compact) ─────────────────────────────────────────────────
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
