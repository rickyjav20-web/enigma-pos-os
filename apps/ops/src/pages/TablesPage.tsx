/**
 * TablesPage — OPS Torre de Control
 * Live table states powered by KDS activity.
 * States: libre → preparando → servida → revisar
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeft, RefreshCw, MapPin, Users, Clock, LayoutGrid,
    ChefHat, CheckCircle2, AlertTriangle, CircleDot,
    Info, X,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
const TENANT_ID = 'enigma_hq';

type TableStatus = 'libre' | 'preparando' | 'servida' | 'revisar' | 'ocupada_sin_kds';

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
function TableCard({ table, onClick, onCheck }: {
    table: DiningTable;
    onClick: () => void;
    onCheck: () => void;
}) {
    const isTakeaway = table.zone === 'Takeaway';
    const isBar = table.zone === 'Bar';
    const cfg = STATUS_CONFIG[table.status];
    const hasProgress = table.isOccupied && (table.itemsTotal ?? 0) > 0;

    const handleClick = () => {
        if (table.status === 'revisar' || table.status === 'servida') {
            onCheck();
        } else {
            onClick();
        }
    };

    return (
        <button
            onClick={handleClick}
            className={`
                relative w-full text-left p-4 rounded-2xl border
                transition-all duration-200 active:scale-[0.96] touch-manipulation
                ${cfg.bg} ${cfg.border} hover:brightness-110
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

            {/* Capacity */}
            {table.capacity && (
                <div className="flex items-center gap-1 mb-2">
                    <Users className="w-3 h-3 text-[#F4F0EA]/25" />
                    <span className="text-[11px] text-[#F4F0EA]/30">{table.capacity} pax</span>
                </div>
            )}

            {/* Status content */}
            {table.isOccupied && table.currentTicket ? (
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold font-mono" style={{ color: cfg.color }}>
                            ${table.currentTicket.totalAmount.toFixed(2)}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-[#F4F0EA]/30">
                            <Clock className="w-3 h-3" />
                            <span>{timeElapsed(table.currentTicket.createdAt)}</span>
                        </div>
                    </div>

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

// ─── Color Legend ────────────────────────────────────────────────────────────
function ColorLegend({ onClose }: { onClose: () => void }) {
    const statuses: TableStatus[] = ['libre', 'preparando', 'servida', 'revisar', 'ocupada_sin_kds'];
    const icons: Record<TableStatus, React.ReactNode> = {
        libre: <CircleDot className="w-4 h-4" />,
        preparando: <ChefHat className="w-4 h-4" />,
        servida: <CheckCircle2 className="w-4 h-4" />,
        revisar: <AlertTriangle className="w-4 h-4" />,
        ocupada_sin_kds: <Clock className="w-4 h-4" />,
    };
    const actions: Record<TableStatus, string> = {
        libre: 'Toca para abrir nueva orden',
        preparando: 'Toca para ver/editar la orden',
        servida: 'Toca para marcar como revisada',
        revisar: 'Toca para marcar como revisada',
        ocupada_sin_kds: 'Toca para ver/editar la orden',
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
                                    <p className="text-[10px] font-semibold mt-1" style={{ color: `${cfg.color}99` }}>{actions[s]}</p>
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
        const interval = setInterval(() => fetchTables(true), 10000); // 10s for live updates
        return () => clearInterval(interval);
    }, [fetchTables]);

    const handleSeedDefaults = async () => {
        setSeeding(true);
        try {
            await fetch(`${API_URL}/tables/seed`, {
                method: 'POST',
                headers: { 'x-tenant-id': TENANT_ID }
            });
            await fetchTables();
        } finally {
            setSeeding(false);
        }
    };

    const handleTableClick = (table: DiningTable) => {
        const params = new URLSearchParams({ tableId: table.id, tableName: table.name });
        if (table.isOccupied && table.currentTicket?.id) {
            params.set('ticketId', table.currentTicket.id);
        }
        navigate(`/manual-sale?${params.toString()}`);
    };

    const handleTableCheck = async (table: DiningTable) => {
        // Mark table as reviewed — navigates to the order
        try {
            await fetch(`${API_URL}/tables/${table.id}/check`, {
                method: 'POST',
                headers: { 'x-tenant-id': TENANT_ID, 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
        } catch { /* non-critical */ }

        // Then navigate to the order
        handleTableClick(table);
    };

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
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#121413] flex items-center justify-center">
                <div className="text-center space-y-3">
                    <div className="w-10 h-10 border-2 border-[#93B59D]/20 border-t-[#93B59D] rounded-full animate-spin mx-auto" />
                    <p className="text-[#F4F0EA]/40 text-sm">Cargando salon...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#121413] text-[#F4F0EA]">

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
                                            onClick={() => handleTableClick(table)}
                                            onCheck={() => handleTableCheck(table)}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* ── Color Legend Modal ── */}
            {showLegend && <ColorLegend onClose={() => setShowLegend(false)} />}
        </div>
    );
}
