/**
 * TablesPage — OPS Torre de Control
 * Live table states powered by KDS activity.
 * States: libre → preparando → servida → revisar
 * Tap a table → detail drawer with actions.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCartStore } from '../stores/cartStore';
import {
    ArrowLeft, RefreshCw, MapPin, Users, Clock, LayoutGrid,
    ChefHat, CheckCircle2, AlertTriangle, CircleDot, Coffee,
    Info, X, ExternalLink, Trash2, Eye, ArrowRightLeft, Merge,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
const TENANT_ID = 'enigma_hq';
const TH = { 'x-tenant-id': TENANT_ID, 'Content-Type': 'application/json' };

type TableStatus = 'libre' | 'preparando' | 'servida' | 'revisar' | 'sobremesa' | 'ocupada_sin_kds';

interface CurrentTicket {
    id: string;
    ticketName: string | null;
    totalAmount: number;
    createdAt: string;
}

interface DiningTable {
    id: string;
    name: string;
    zone: string | null;
    capacity: number | null;
    sortOrder: number;
    status: TableStatus;
    isOccupied: boolean;
    currentTicket: CurrentTicket | null;
    itemsDone?: number;
    itemsTotal?: number;
    guestCount?: number | null;
    totalAmount?: number;
}

interface OrderItem {
    id: string;
    productNameSnapshot: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}

interface TableDetail {
    id: string;
    name: string;
    zone: string | null;
    capacity: number | null;
    orders: {
        id: string;
        ticketName: string | null;
        totalAmount: number;
        createdAt: string;
        employeeId: string | null;
        items: OrderItem[];
    }[];
    totalAmount: number;
    totalItems: number;
}

// ─── Status Config ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<TableStatus, {
    label: string;
    color: string;
    bg: string;
    border: string;
    dot: string;
    dotGlow: string;
    pulse: boolean;
    description: string;
}> = {
    libre: {
        label: 'Libre',
        color: '#93B59D',
        bg: 'bg-[#222524]',
        border: 'border-white/[0.06]',
        dot: 'bg-[#93B59D]',
        dotGlow: 'shadow-[0_0_6px_rgba(147,181,157,0.5)]',
        pulse: false,
        description: 'Mesa disponible para nuevos clientes',
    },
    preparando: {
        label: 'Preparando',
        color: '#FBBF24',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        dot: 'bg-amber-400',
        dotGlow: 'shadow-[0_0_8px_rgba(251,191,36,0.7)]',
        pulse: true,
        description: 'Cocina esta preparando los pedidos',
    },
    servida: {
        label: 'Servida',
        color: '#34D399',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        dot: 'bg-emerald-400',
        dotGlow: 'shadow-[0_0_8px_rgba(52,211,153,0.7)]',
        pulse: false,
        description: 'Todos los items fueron entregados por cocina',
    },
    revisar: {
        label: 'Revisar',
        color: '#F87171',
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        dot: 'bg-red-400',
        dotGlow: 'shadow-[0_0_8px_rgba(248,113,113,0.7)]',
        pulse: true,
        description: 'Servida hace mas de 10 min — verificar si necesita algo',
    },
    sobremesa: {
        label: 'Sobremesa',
        color: '#A78BFA',
        bg: 'bg-violet-500/10',
        border: 'border-violet-500/30',
        dot: 'bg-violet-400',
        dotGlow: 'shadow-[0_0_8px_rgba(167,139,250,0.5)]',
        pulse: false,
        description: 'Mesa revisada, clientes disfrutando — esperando antes de volver a revisar',
    },
    ocupada_sin_kds: {
        label: 'Ocupada',
        color: '#818CF8',
        bg: 'bg-indigo-500/10',
        border: 'border-indigo-500/30',
        dot: 'bg-indigo-400',
        dotGlow: 'shadow-[0_0_8px_rgba(129,140,248,0.7)]',
        pulse: false,
        description: 'Tiene pedido abierto pero sin actividad en cocina',
    },
};

function timeElapsed(dateStr: string): string {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
}

// ─── Table Card ──────────────────────────────────────────────────────────────
function TableCard({ table, onClick, isSource, isPickingTarget, disabled }: {
    table: DiningTable;
    onClick: () => void;
    isSource?: boolean;
    isPickingTarget?: boolean;
    disabled?: boolean;
}) {
    const isTakeaway = table.zone === 'Takeaway';
    const isBar = table.zone === 'Bar';
    const cfg = STATUS_CONFIG[table.status];
    const hasProgress = table.isOccupied && (table.itemsTotal ?? 0) > 0;

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                relative w-full text-left p-4 rounded-2xl border
                transition-all duration-200 active:scale-[0.96] touch-manipulation
                ${isSource ? 'bg-sky-500/15 border-sky-500/50 ring-2 ring-sky-500/30' : isPickingTarget ? 'bg-sky-500/5 border-sky-400/30 hover:border-sky-400/60 hover:bg-sky-500/10' : `${cfg.bg} ${cfg.border} hover:brightness-110`}
                ${disabled ? 'opacity-40 pointer-events-none' : ''}
            `}
        >
            {/* Live status dot */}
            <div className={`
                absolute top-3 right-3 w-2.5 h-2.5 rounded-full
                ${cfg.dot} ${cfg.dotGlow} ${cfg.pulse ? 'animate-pulse' : ''}
            `} />

            {/* Table name */}
            <h3 className="font-bold text-[15px] text-[#F4F0EA] leading-none mb-1 pr-6">
                {isTakeaway ? '📦 ' : isBar ? '🍷 ' : ''}{table.name}
            </h3>

            {/* Guest count / Capacity */}
            <div className="flex items-center gap-1 mb-2">
                <Users className="w-3 h-3 text-[#F4F0EA]/25" />
                {table.guestCount ? (
                    <span className="text-[11px] text-[#93B59D]">{table.guestCount} persona{table.guestCount > 1 ? 's' : ''}</span>
                ) : table.capacity ? (
                    <span className="text-[11px] text-[#F4F0EA]/30">{table.capacity} pax</span>
                ) : null}
            </div>

            {/* Status content */}
            {table.isOccupied && table.currentTicket ? (
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold font-mono" style={{ color: cfg.color }}>
                            ${(table.totalAmount || table.currentTicket.totalAmount).toFixed(2)}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-[#F4F0EA]/30">
                            <Clock className="w-3 h-3" />
                            <span>{timeElapsed(table.currentTicket.createdAt)}</span>
                        </div>
                    </div>

                    {/* Per-person average */}
                    {table.guestCount && table.guestCount > 0 && (
                        <div className="text-[10px] text-[#F4F0EA]/40 font-mono">
                            ${((table.totalAmount || table.currentTicket.totalAmount) / table.guestCount).toFixed(2)}/persona
                        </div>
                    )}

                    {/* Progress bar */}
                    {hasProgress && (
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${((table.itemsDone ?? 0) / (table.itemsTotal ?? 1)) * 100}%`,
                                        background: cfg.color,
                                    }}
                                />
                            </div>
                            <span className="text-[9px] font-mono tabular-nums" style={{ color: cfg.color, opacity: 0.7 }}>
                                {table.itemsDone}/{table.itemsTotal}
                            </span>
                        </div>
                    )}

                    {/* Status badge */}
                    <span
                        className="inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                        style={{
                            color: cfg.color,
                            background: `${cfg.color}15`,
                            border: `1px solid ${cfg.color}30`,
                        }}
                    >
                        {cfg.label}
                    </span>
                </div>
            ) : (
                <span
                    className="inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{
                        color: cfg.color,
                        background: `${cfg.color}15`,
                        border: `1px solid ${cfg.color}30`,
                    }}
                >
                    {isTakeaway ? 'Para Llevar' : cfg.label}
                </span>
            )}
        </button>
    );
}

// ─── Table Detail Drawer ─────────────────────────────────────────────────────
function TableDrawer({ table, onClose, onNavigate, onCheck, onFree, fetchDetail, onGuestCountChange, onMove, onMerge }: {
    table: DiningTable;
    onClose: () => void;
    onNavigate: () => void;
    onCheck: () => void;
    onFree: () => void;
    fetchDetail: (id: string) => Promise<TableDetail | null>;
    onGuestCountChange: (tableId: string, ticketId: string, count: number | null) => void;
    onMove: () => void;
    onMerge: () => void;
}) {
    const cfg = STATUS_CONFIG[table.status];
    const [detail, setDetail] = useState<TableDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [confirmFree, setConfirmFree] = useState(false);
    const [freeing, setFreeing] = useState(false);
    const [localGuestCount, setLocalGuestCount] = useState<number | null>(table.guestCount || null);

    useEffect(() => {
        if (table.isOccupied) {
            setLoadingDetail(true);
            fetchDetail(table.id).then(d => {
                setDetail(d);
                setLoadingDetail(false);
            });
        }
    }, [table.id, table.isOccupied, fetchDetail]);

    const handleFree = async () => {
        setFreeing(true);
        await onFree();
        setFreeing(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={onClose}>
            <div
                className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[#1A1D1B] rounded-t-3xl sm:rounded-3xl border border-white/[0.08] animate-in slide-in-from-bottom-4"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 bg-[#1A1D1B] rounded-t-3xl border-b border-white/[0.05] px-5 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${cfg.dot} ${cfg.dotGlow} ${cfg.pulse ? 'animate-pulse' : ''}`} />
                            <div>
                                <h2 className="text-lg font-bold text-[#F4F0EA]">{table.name}</h2>
                                <div className="flex items-center gap-2 mt-0.5">
                                    {table.zone && (
                                        <span className="text-[10px] text-[#F4F0EA]/30 flex items-center gap-1">
                                            <MapPin className="w-3 h-3" /> {table.zone}
                                        </span>
                                    )}
                                    {table.capacity && (
                                        <span className="text-[10px] text-[#F4F0EA]/30 flex items-center gap-1">
                                            <Users className="w-3 h-3" /> {table.capacity} pax
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span
                                className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                                style={{ color: cfg.color, background: `${cfg.color}15`, border: `1px solid ${cfg.color}30` }}
                            >
                                {cfg.label}
                            </span>
                            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/10">
                                <X className="w-4 h-4 text-[#F4F0EA]/50" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">

                    {/* Ticket info when occupied */}
                    {table.isOccupied && table.currentTicket && (
                        <div className="p-4 rounded-2xl border" style={{ background: `${cfg.color}08`, borderColor: `${cfg.color}20` }}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xl font-bold font-mono" style={{ color: cfg.color }}>
                                    ${table.currentTicket.totalAmount.toFixed(2)}
                                </span>
                                <div className="flex items-center gap-1 text-xs" style={{ color: `${cfg.color}99` }}>
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{timeElapsed(table.currentTicket.createdAt)}</span>
                                </div>
                            </div>

                            {/* Guest count editor */}
                            <div className="flex items-center justify-between py-2 mb-2 border-b border-white/[0.05]">
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.3)' }} />
                                    <span className="text-xs" style={{ color: 'rgba(244,240,234,0.5)' }}>Personas</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => {
                                            const next = Math.max(0, (localGuestCount || 1) - 1);
                                            const val = next === 0 ? null : next;
                                            setLocalGuestCount(val);
                                            onGuestCountChange(table.id, table.currentTicket!.id, val);
                                        }}
                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors"
                                        style={{ background: 'rgba(244,240,234,0.06)', color: 'rgba(244,240,234,0.5)' }}
                                    >-</button>
                                    <span className="text-sm w-6 text-center font-bold tabular-nums"
                                        style={{ color: localGuestCount ? '#93B59D' : 'rgba(244,240,234,0.2)' }}>
                                        {localGuestCount || '—'}
                                    </span>
                                    <button
                                        onClick={() => {
                                            const next = (localGuestCount || 0) + 1;
                                            setLocalGuestCount(next);
                                            onGuestCountChange(table.id, table.currentTicket!.id, next);
                                        }}
                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors"
                                        style={{ background: 'rgba(147,181,157,0.1)', color: '#93B59D' }}
                                    >+</button>
                                </div>
                            </div>

                            {/* Per-person average */}
                            {localGuestCount && localGuestCount > 0 && (
                                <div className="text-[11px] font-mono mb-2" style={{ color: 'rgba(244,240,234,0.4)' }}>
                                    ${(table.currentTicket.totalAmount / localGuestCount).toFixed(2)}/persona
                                </div>
                            )}

                            {/* Progress */}
                            {(table.itemsTotal ?? 0) > 0 && (
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{
                                                width: `${((table.itemsDone ?? 0) / (table.itemsTotal ?? 1)) * 100}%`,
                                                background: cfg.color,
                                            }}
                                        />
                                    </div>
                                    <span className="text-[11px] font-mono tabular-nums" style={{ color: cfg.color }}>
                                        {table.itemsDone}/{table.itemsTotal} items
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Order items detail */}
                    {table.isOccupied && (
                        <div>
                            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#F4F0EA]/30 mb-2">
                                Detalle del pedido
                            </h3>
                            {loadingDetail ? (
                                <div className="flex items-center justify-center py-6">
                                    <div className="w-5 h-5 border-2 border-[#93B59D]/20 border-t-[#93B59D] rounded-full animate-spin" />
                                </div>
                            ) : detail && detail.orders.length > 0 ? (
                                <div className="space-y-2">
                                    {detail.orders.map(order => (
                                        <div key={order.id} className="rounded-xl bg-white/[0.03] border border-white/[0.05] overflow-hidden">
                                            {order.items.map((item, i) => (
                                                <div
                                                    key={item.id}
                                                    className={`flex items-center justify-between px-3 py-2.5 ${
                                                        i !== order.items.length - 1 ? 'border-b border-white/[0.04]' : ''
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        <span className="text-[11px] font-bold text-[#F4F0EA]/40 w-5 text-center tabular-nums">
                                                            {item.quantity}x
                                                        </span>
                                                        <span className="text-[13px] text-[#F4F0EA]/80 truncate">
                                                            {item.productNameSnapshot}
                                                        </span>
                                                    </div>
                                                    <span className="text-[12px] font-mono text-[#F4F0EA]/40 ml-2 flex-shrink-0">
                                                        ${item.totalPrice.toFixed(2)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-[#F4F0EA]/25 py-4 text-center">Sin items en el pedido</p>
                            )}
                        </div>
                    )}

                    {/* Free table - description */}
                    {!table.isOccupied && (
                        <div className="text-center py-6">
                            <div className="w-12 h-12 rounded-2xl bg-[#93B59D]/10 border border-[#93B59D]/20 flex items-center justify-center mx-auto mb-3">
                                <CheckCircle2 className="w-5 h-5 text-[#93B59D]" />
                            </div>
                            <p className="text-sm text-[#F4F0EA]/50">Mesa disponible</p>
                            <p className="text-[11px] text-[#F4F0EA]/25 mt-1">Toca "Abrir Orden" para asignar un pedido</p>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="sticky bottom-0 bg-[#1A1D1B] border-t border-white/[0.05] p-4 space-y-2">
                    {/* Primary action row */}
                    <div className="flex gap-2">
                        <button
                            onClick={onNavigate}
                            className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                            style={{
                                background: 'linear-gradient(135deg, #1C402E, #255639)',
                                color: '#F4F0EA',
                            }}
                        >
                            {table.isOccupied ? (
                                <><Eye className="w-4 h-4" /> Ver / Editar Orden</>
                            ) : (
                                <><ExternalLink className="w-4 h-4" /> Abrir Orden</>
                            )}
                        </button>
                    </div>

                    {/* Move / Merge actions for occupied tables */}
                    {table.isOccupied && (
                        <div className="flex gap-2">
                            <button
                                onClick={onMove}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5
                                    bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-colors"
                            >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                Mover
                            </button>
                            <button
                                onClick={onMerge}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5
                                    bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors"
                            >
                                <Merge className="w-3.5 h-3.5" />
                                Mezclar
                            </button>
                        </div>
                    )}

                    {/* Secondary actions for occupied tables */}
                    {table.isOccupied && (
                        <div className="flex gap-2">
                            {(table.status === 'servida' || table.status === 'revisar') && (
                                <button
                                    onClick={() => { onCheck(); onClose(); }}
                                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5
                                        bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Marcar Revisada
                                </button>
                            )}
                            {!confirmFree ? (
                                <button
                                    onClick={() => setConfirmFree(true)}
                                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5
                                        bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Liberar Mesa
                                </button>
                            ) : (
                                <button
                                    onClick={handleFree}
                                    disabled={freeing}
                                    className="flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5
                                        bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse disabled:opacity-50"
                                >
                                    {freeing ? 'Liberando...' : 'Confirmar Anular Tickets'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Color Legend ────────────────────────────────────────────────────────────
function ColorLegend({ onClose }: { onClose: () => void }) {
    const statuses: TableStatus[] = ['libre', 'preparando', 'servida', 'revisar', 'sobremesa', 'ocupada_sin_kds'];
    const icons: Record<TableStatus, React.ReactNode> = {
        libre: <CircleDot className="w-4 h-4" />,
        preparando: <ChefHat className="w-4 h-4" />,
        servida: <CheckCircle2 className="w-4 h-4" />,
        revisar: <AlertTriangle className="w-4 h-4" />,
        sobremesa: <Coffee className="w-4 h-4" />,
        ocupada_sin_kds: <Clock className="w-4 h-4" />,
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={onClose}>
            <div className="w-full max-w-md bg-[#1A1D1B] rounded-t-3xl sm:rounded-3xl border border-white/[0.08] p-6 space-y-4"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-[#F4F0EA]">Estados de Mesa</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/10">
                        <X className="w-4 h-4 text-[#F4F0EA]/50" />
                    </button>
                </div>

                <div className="space-y-3">
                    {statuses.map(s => {
                        const cfg = STATUS_CONFIG[s];
                        return (
                            <div key={s} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: `${cfg.color}08` }}>
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ background: `${cfg.color}20`, color: cfg.color }}>
                                    {icons[s]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                                        <span className="text-sm font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                                    </div>
                                    <p className="text-[11px] text-[#F4F0EA]/40 mt-0.5">{cfg.description}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function TablesPage() {
    const navigate = useNavigate();
    const [tables, setTables] = useState<DiningTable[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeZone, setActiveZone] = useState('Todas');
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [seeding, setSeeding] = useState(false);
    const [showLegend, setShowLegend] = useState(false);
    const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);

    // Move / Merge action mode
    const [actionMode, setActionMode] = useState<'move' | 'merge' | null>(null);
    const [sourceTable, setSourceTable] = useState<DiningTable | null>(null);
    const [confirmTarget, setConfirmTarget] = useState<DiningTable | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionToast, setActionToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const fetchTables = useCallback(async (silent = false) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        try {
            const res = await fetch(`${API_URL}/tables`, {
                headers: { 'x-tenant-id': TENANT_ID }
            });
            if (!res.ok) throw new Error(`API ${res.status}`);
            const data = await res.json();
            setTables(Array.isArray(data) ? data : (data.data || []));
            setLastRefresh(new Date());
        } catch (e) {
            console.error('Tables fetch failed', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchTables();
        const interval = setInterval(() => fetchTables(true), 10000);
        return () => clearInterval(interval);
    }, [fetchTables]);

    const fetchTableDetail = useCallback(async (id: string): Promise<TableDetail | null> => {
        try {
            const res = await fetch(`${API_URL}/tables/${id}/detail`, { headers: TH });
            if (!res.ok) return null;
            const data = await res.json();
            return data.data || null;
        } catch {
            return null;
        }
    }, []);

    const handleSeedDefaults = async () => {
        setSeeding(true);
        try {
            await fetch(`${API_URL}/tables/seed`, { method: 'POST', headers: TH });
            await fetchTables();
        } finally {
            setSeeding(false);
        }
    };

    const { loadTicket, setTable, clearCart } = useCartStore();

    const handleNavigateToOrder = async (table: DiningTable) => {
        if (table.isOccupied && table.currentTicket?.id) {
            // Load existing ticket into cart then go to POS
            try {
                const res = await fetch(`${API_URL}/sales/${table.currentTicket.id}`, { headers: TH });
                const data = await res.json();
                const order = data?.data || data;
                loadTicket({
                    id: order.id,
                    name: order.ticketName || order.tableName || `Ticket #${order.id.slice(-4)}`,
                    tableId: table.id,
                    tableName: table.name,
                    guestCount: order.guestCount || null,
                    items: (order.items || []).map((i: any) => ({
                        productId: i.productId,
                        name: i.productNameSnapshot,
                        price: i.unitPrice,
                        quantity: i.quantity,
                    })),
                });
            } catch {
                // Fallback: just set table
                clearCart();
                setTable(table.id, table.name);
            }
        } else {
            // Free table: clear cart, assign table, go to POS
            clearCart();
            setTable(table.id, table.name);
        }
        setSelectedTable(null);
        navigate('/pos');
    };

    const handleTableCheck = async (table: DiningTable) => {
        try {
            await fetch(`${API_URL}/tables/${table.id}/check`, {
                method: 'POST', headers: TH, body: JSON.stringify({}),
            });
            await fetchTables(true);
        } catch { /* non-critical */ }
    };

    const handleFreeTable = async (table: DiningTable) => {
        try {
            await fetch(`${API_URL}/tables/${table.id}/free`, {
                method: 'POST', headers: TH, body: JSON.stringify({}),
            });
            setSelectedTable(null);
            await fetchTables(true);
        } catch {
            alert('Error al liberar la mesa');
        }
    };

    const handleGuestCountChange = useCallback(async (_tableId: string, ticketId: string, count: number | null) => {
        try {
            await fetch(`${API_URL}/sales/${ticketId}`, {
                method: 'PUT', headers: TH,
                body: JSON.stringify({ guestCount: count }),
            });
        } catch {
            // Silent — optimistic update in drawer UI
        }
    }, []);

    // Move / Merge handlers
    const startAction = (mode: 'move' | 'merge', table: DiningTable) => {
        setActionMode(mode);
        setSourceTable(table);
        setSelectedTable(null); // close drawer
        setConfirmTarget(null);
    };

    const cancelAction = () => {
        setActionMode(null);
        setSourceTable(null);
        setConfirmTarget(null);
    };

    const handleTableCardClick = (table: DiningTable) => {
        if (actionMode && sourceTable) {
            if (table.id === sourceTable.id) return;
            setConfirmTarget(table);
        } else {
            setSelectedTable(table);
        }
    };

    const executeAction = async () => {
        if (!sourceTable || !confirmTarget || !actionMode) return;
        setActionLoading(true);
        try {
            const endpoint = actionMode === 'move'
                ? `${API_URL}/tables/${sourceTable.id}/move-to/${confirmTarget.id}`
                : `${API_URL}/tables/${sourceTable.id}/merge-into/${confirmTarget.id}`;
            const res = await fetch(endpoint, { method: 'POST', headers: TH });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Error ${res.status}`);
            }
            setActionToast({
                msg: actionMode === 'move'
                    ? `${sourceTable.name} → ${confirmTarget.name}`
                    : `${sourceTable.name} + ${confirmTarget.name} combinadas`,
                type: 'success',
            });
            cancelAction();
            await fetchTables(true);
        } catch (e: any) {
            setActionToast({ msg: e.message || 'Error al ejecutar accion', type: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    // Auto-dismiss toast
    useEffect(() => {
        if (actionToast) {
            const t = setTimeout(() => setActionToast(null), 3000);
            return () => clearTimeout(t);
        }
    }, [actionToast]);

    // Build zone list
    const zones = ['Todas', ...Array.from(new Set(tables.map(t => t.zone || 'General')))];
    const allZones = zones.slice(1);
    const tablesByZone: Record<string, DiningTable[]> = {};
    if (activeZone === 'Todas') {
        allZones.forEach(z => {
            tablesByZone[z] = tables.filter(t => (t.zone || 'General') === z);
        });
    } else {
        tablesByZone[activeZone] = tables.filter(t => (t.zone || 'General') === activeZone);
    }

    // Status counts
    const statusCounts = {
        libre: tables.filter(t => t.status === 'libre').length,
        preparando: tables.filter(t => t.status === 'preparando').length,
        servida: tables.filter(t => t.status === 'servida').length,
        revisar: tables.filter(t => t.status === 'revisar').length,
        sobremesa: tables.filter(t => t.status === 'sobremesa').length,
    };

    // Urgency: tables needing attention
    const urgentCount = statusCounts.revisar;

    if (loading) {
        return (
            <div className="h-full bg-[#121413] flex items-center justify-center">
                <div className="text-center space-y-3">
                    <div className="w-10 h-10 border-2 border-[#93B59D]/20 border-t-[#93B59D] rounded-full animate-spin mx-auto" />
                    <p className="text-[#F4F0EA]/40 text-sm">Cargando salon...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-[#121413] text-[#F4F0EA] overflow-y-auto">

            {/* ── Sticky Header ── */}
            <div className="sticky top-0 z-20 bg-[#121413]/95 backdrop-blur-xl border-b border-white/[0.05]">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Link to="/" className="p-2 bg-white/[0.06] rounded-xl hover:bg-white/10 transition-colors">
                            <ArrowLeft className="w-5 h-5 text-[#F4F0EA]/60" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <LayoutGrid className="w-4 h-4 text-[#93B59D]" />
                                <h1 className="text-base font-bold text-[#F4F0EA] leading-none">Torre de Control</h1>
                                {urgentCount > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                                        {urgentCount}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                {statusCounts.preparando > 0 && (
                                    <span className="text-[10px] font-semibold" style={{ color: STATUS_CONFIG.preparando.color }}>
                                        {statusCounts.preparando} preparando
                                    </span>
                                )}
                                {statusCounts.servida > 0 && (
                                    <>
                                        {statusCounts.preparando > 0 && <span className="text-[#F4F0EA]/15 text-[10px]">·</span>}
                                        <span className="text-[10px] font-semibold" style={{ color: STATUS_CONFIG.servida.color }}>
                                            {statusCounts.servida} servida{statusCounts.servida !== 1 ? 's' : ''}
                                        </span>
                                    </>
                                )}
                                {statusCounts.sobremesa > 0 && (
                                    <>
                                        <span className="text-[#F4F0EA]/15 text-[10px]">·</span>
                                        <span className="text-[10px] font-semibold" style={{ color: STATUS_CONFIG.sobremesa.color }}>
                                            {statusCounts.sobremesa} sobremesa
                                        </span>
                                    </>
                                )}
                                {statusCounts.revisar > 0 && (
                                    <>
                                        <span className="text-[#F4F0EA]/15 text-[10px]">·</span>
                                        <span className="text-[10px] font-semibold" style={{ color: STATUS_CONFIG.revisar.color }}>
                                            {statusCounts.revisar} revisar
                                        </span>
                                    </>
                                )}
                                {statusCounts.libre > 0 && (
                                    <>
                                        {(statusCounts.preparando > 0 || statusCounts.servida > 0 || statusCounts.revisar > 0) && <span className="text-[#F4F0EA]/15 text-[10px]">·</span>}
                                        <span className="text-[10px] text-[#93B59D]/60">
                                            {statusCounts.libre} libre{statusCounts.libre !== 1 ? 's' : ''}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowLegend(true)}
                            className="p-2 bg-white/[0.06] rounded-xl hover:bg-white/10 transition-colors"
                            title="Ver leyenda de colores"
                        >
                            <Info className="w-4 h-4 text-[#F4F0EA]/40" />
                        </button>
                        <span className="text-[10px] text-[#F4F0EA]/25 tabular-nums hidden sm:block">
                            {lastRefresh.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                            onClick={() => fetchTables(true)}
                            className="p-2 bg-white/[0.06] rounded-xl hover:bg-white/10 transition-colors"
                            disabled={refreshing}
                        >
                            <RefreshCw className={`w-4 h-4 text-[#F4F0EA]/40 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Zone Filter Pills */}
                {zones.length > 2 && (
                    <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
                        {zones.map(zone => (
                            <button
                                key={zone}
                                onClick={() => setActiveZone(zone)}
                                className={`
                                    flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold
                                    transition-all duration-150
                                    ${activeZone === zone
                                        ? 'bg-[#93B59D] text-[#121413] shadow-[0_0_12px_rgba(147,181,157,0.3)]'
                                        : 'bg-white/[0.05] text-[#F4F0EA]/45 hover:bg-white/10 hover:text-[#F4F0EA]/70'
                                    }
                                `}
                            >
                                {zone}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Content ── */}
            <div className="p-4 space-y-7 pb-28">

                {tables.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-[#222524] border border-white/[0.06] flex items-center justify-center mb-5">
                            <MapPin className="w-7 h-7 text-[#F4F0EA]/20" />
                        </div>
                        <h3 className="text-base font-semibold text-[#F4F0EA]/50 mb-1">Sin mesas configuradas</h3>
                        <p className="text-xs text-[#F4F0EA]/25 mb-6 max-w-[200px]">
                            Crea tus mesas desde el Back Office o carga las predeterminadas
                        </p>
                        <button
                            onClick={handleSeedDefaults}
                            disabled={seeding}
                            className="px-5 py-2.5 bg-[#93B59D]/15 text-[#93B59D] rounded-xl text-sm font-semibold
                                border border-[#93B59D]/30 hover:bg-[#93B59D]/25 transition-colors disabled:opacity-50"
                        >
                            {seeding ? 'Cargando...' : 'Cargar mesas predeterminadas'}
                        </button>
                    </div>
                ) : (
                    Object.entries(tablesByZone).map(([zone, zoneTables]) => {
                        if (zoneTables.length === 0) return null;
                        const zoneActive = zoneTables.filter(t => t.isOccupied).length;
                        return (
                            <div key={zone}>
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#F4F0EA]/30 flex-shrink-0">
                                        {zone}
                                    </span>
                                    <div className="flex-1 h-px bg-white/[0.04]" />
                                    {zoneActive > 0 && (
                                        <span className="text-[10px] text-amber-400/70 flex-shrink-0">
                                            {zoneActive}/{zoneTables.length} activas
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {zoneTables.map(table => (
                                        <TableCard
                                            key={table.id}
                                            table={table}
                                            onClick={() => handleTableCardClick(table)}
                                            isSource={!!actionMode && sourceTable?.id === table.id}
                                            isPickingTarget={!!actionMode && sourceTable?.id !== table.id}
                                            disabled={!!actionMode && sourceTable?.id === table.id}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* ── Action Mode Banner ── */}
            {actionMode && sourceTable && (
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-sky-950/95 backdrop-blur-xl border-t border-sky-500/30 px-4 py-3 safe-area-bottom">
                    <div className="flex items-center justify-between max-w-2xl mx-auto">
                        <div className="flex items-center gap-3">
                            {actionMode === 'move' ? (
                                <ArrowRightLeft className="w-5 h-5 text-sky-400" />
                            ) : (
                                <Merge className="w-5 h-5 text-violet-400" />
                            )}
                            <div>
                                <p className="text-sm font-semibold text-[#F4F0EA]">
                                    {actionMode === 'move' ? 'Mover' : 'Mezclar'} {sourceTable.name}
                                </p>
                                <p className="text-[11px] text-[#F4F0EA]/50">
                                    Selecciona la mesa destino
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={cancelAction}
                            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.08] text-[#F4F0EA]/70 hover:bg-white/[0.15] transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* ── Confirm Action Modal ── */}
            {confirmTarget && sourceTable && actionMode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => setConfirmTarget(null)}>
                    <div className="w-full max-w-sm mx-4 bg-[#1A1D1B] rounded-2xl border border-white/[0.08] p-5 space-y-4"
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3">
                            {actionMode === 'move' ? (
                                <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center">
                                    <ArrowRightLeft className="w-5 h-5 text-sky-400" />
                                </div>
                            ) : (
                                <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                                    <Merge className="w-5 h-5 text-violet-400" />
                                </div>
                            )}
                            <div>
                                <h3 className="text-base font-bold text-[#F4F0EA]">
                                    {actionMode === 'move' ? 'Mover Mesa' : 'Mezclar Mesas'}
                                </h3>
                                <p className="text-xs text-[#F4F0EA]/50">
                                    {sourceTable.name} → {confirmTarget.name}
                                </p>
                            </div>
                        </div>

                        <p className="text-sm text-[#F4F0EA]/60">
                            {actionMode === 'move'
                                ? `Todos los tickets abiertos de ${sourceTable.name} se moveran a ${confirmTarget.name}. Los items que ya salieron en KDS no se re-envian.`
                                : `Todos los items de ${sourceTable.name} se combinaran en el ticket de ${confirmTarget.name}. Los tickets vacios se eliminaran.`
                            }
                        </p>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setConfirmTarget(null)}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-white/[0.06] text-[#F4F0EA]/60 hover:bg-white/10 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={executeAction}
                                disabled={actionLoading}
                                className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 ${
                                    actionMode === 'move'
                                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30'
                                        : 'bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30'
                                }`}
                            >
                                {actionLoading ? 'Procesando...' : actionMode === 'move' ? 'Mover' : 'Mezclar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Table Detail Drawer ── */}
            {selectedTable && !actionMode && (
                <TableDrawer
                    table={selectedTable}
                    onClose={() => setSelectedTable(null)}
                    onNavigate={() => handleNavigateToOrder(selectedTable)}
                    onCheck={() => handleTableCheck(selectedTable)}
                    onFree={() => handleFreeTable(selectedTable)}
                    fetchDetail={fetchTableDetail}
                    onGuestCountChange={handleGuestCountChange}
                    onMove={() => startAction('move', selectedTable)}
                    onMerge={() => startAction('merge', selectedTable)}
                />
            )}

            {/* ── Toast ── */}
            {actionToast && (
                <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl text-sm font-semibold shadow-2xl transition-all ${
                    actionToast.type === 'success'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                    {actionToast.msg}
                </div>
            )}

            {/* ── Color Legend Modal ── */}
            {showLegend && <ColorLegend onClose={() => setShowLegend(false)} />}
        </div>
    );
}
