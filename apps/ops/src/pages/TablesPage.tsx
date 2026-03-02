/**
 * TablesPage — OPS Salon View
 * Shows all dining tables grouped by zone with live occupancy status.
 * Branding: Dark Organic Tech — Onyx Black + Sage Highlight
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, MapPin, Users, Clock, LayoutGrid } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
const TENANT_ID = 'enigma_hq';

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
    isOccupied: boolean;
    currentTicket: CurrentTicket | null;
}

function timeElapsed(dateStr: string): string {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
}

// ─── Table Card ───────────────────────────────────────────────────────────────
function TableCard({ table, onClick }: { table: DiningTable; onClick: () => void }) {
    const isTakeaway = table.zone === 'Takeaway';
    const isBar = table.zone === 'Bar';

    return (
        <button
            onClick={onClick}
            className={`
                relative w-full text-left p-4 rounded-2xl border
                transition-all duration-200 active:scale-[0.96] touch-manipulation
                ${table.isOccupied
                    ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-400/50'
                    : isTakeaway
                        ? 'bg-[#1C402E]/50 border-[#93B59D]/25 hover:border-[#93B59D]/50'
                        : isBar
                            ? 'bg-[#222524] border-white/[0.08] hover:border-purple-500/30'
                            : 'bg-[#222524] border-white/[0.06] hover:border-[#93B59D]/30'
                }
            `}
        >
            {/* Live status dot */}
            <div className={`
                absolute top-3 right-3 w-2 h-2 rounded-full
                ${table.isOccupied
                    ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] animate-pulse'
                    : 'bg-[#93B59D] shadow-[0_0_6px_rgba(147,181,157,0.5)]'
                }
            `} />

            {/* Table name */}
            <h3 className="font-bold text-[15px] text-[#F4F0EA] leading-none mb-1 pr-6">
                {isTakeaway ? '📦 ' : isBar ? '🍷 ' : ''}{table.name}
            </h3>

            {/* Capacity */}
            {table.capacity && (
                <div className="flex items-center gap-1 mb-3">
                    <Users className="w-3 h-3 text-[#F4F0EA]/25" />
                    <span className="text-[11px] text-[#F4F0EA]/30">{table.capacity} pax</span>
                </div>
            )}

            {/* Status */}
            {table.isOccupied && table.currentTicket ? (
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-amber-400 font-mono">
                            ${table.currentTicket.totalAmount.toFixed(2)}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-[#F4F0EA]/30">
                            <Clock className="w-3 h-3" />
                            <span>{timeElapsed(table.currentTicket.createdAt)}</span>
                        </div>
                    </div>
                    <span className="inline-block text-[10px] font-bold uppercase tracking-widest
                        text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        Ocupada
                    </span>
                </div>
            ) : (
                <span className={`
                    inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full
                    ${isTakeaway
                        ? 'text-[#93B59D] bg-[#93B59D]/10 border border-[#93B59D]/20'
                        : 'text-[#93B59D] bg-[#93B59D]/10 border border-[#93B59D]/20'
                    }
                `}>
                    {isTakeaway ? 'Para Llevar' : 'Libre'}
                </span>
            )}
        </button>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TablesPage() {
    const navigate = useNavigate();
    const [tables, setTables] = useState<DiningTable[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeZone, setActiveZone] = useState('Todas');
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [seeding, setSeeding] = useState(false);

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
        // Auto-refresh every 20 seconds for live occupancy
        const interval = setInterval(() => fetchTables(true), 20000);
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
        navigate(`/manual-sale?${params.toString()}`);
    };

    // Build zone list
    const zones = ['Todas', ...Array.from(new Set(tables.map(t => t.zone || 'General')))];

    // Group tables by zone
    const allZones = zones.slice(1);
    const tablesByZone: Record<string, DiningTable[]> = {};
    if (activeZone === 'Todas') {
        allZones.forEach(z => {
            tablesByZone[z] = tables.filter(t => (t.zone || 'General') === z);
        });
    } else {
        tablesByZone[activeZone] = tables.filter(t => (t.zone || 'General') === activeZone);
    }

    const occupiedCount = tables.filter(t => t.isOccupied).length;
    const freeCount = tables.filter(t => !t.isOccupied).length;

    // ── Loading ──
    if (loading) {
        return (
            <div className="min-h-screen bg-[#121413] flex items-center justify-center">
                <div className="text-center space-y-3">
                    <div className="w-10 h-10 border-2 border-[#93B59D]/20 border-t-[#93B59D] rounded-full animate-spin mx-auto" />
                    <p className="text-[#F4F0EA]/40 text-sm">Cargando salón...</p>
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
                        <Link
                            to="/"
                            className="p-2 bg-white/[0.06] rounded-xl hover:bg-white/10 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-[#F4F0EA]/60" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <LayoutGrid className="w-4 h-4 text-[#93B59D]" />
                                <h1 className="text-base font-bold text-[#F4F0EA] leading-none">Salón</h1>
                            </div>
                            <p className="text-[11px] text-[#F4F0EA]/35 mt-0.5">
                                <span className="text-amber-400">{occupiedCount} ocupadas</span>
                                <span className="mx-1.5 text-[#F4F0EA]/20">·</span>
                                <span className="text-[#93B59D]">{freeCount} libres</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
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

                {/* Empty state */}
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
                            {seeding ? 'Cargando...' : '✦ Cargar mesas predeterminadas'}
                        </button>
                    </div>
                ) : (
                    Object.entries(tablesByZone).map(([zone, zoneTables]) => {
                        if (zoneTables.length === 0) return null;
                        const zoneOccupied = zoneTables.filter(t => t.isOccupied).length;
                        return (
                            <div key={zone}>
                                {/* Zone header */}
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#F4F0EA]/30 flex-shrink-0">
                                        {zone}
                                    </span>
                                    <div className="flex-1 h-px bg-white/[0.04]" />
                                    {zoneOccupied > 0 && (
                                        <span className="text-[10px] text-amber-400/70 flex-shrink-0">
                                            {zoneOccupied}/{zoneTables.length} ocupadas
                                        </span>
                                    )}
                                </div>

                                {/* Table grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {zoneTables.map(table => (
                                        <TableCard
                                            key={table.id}
                                            table={table}
                                            onClick={() => handleTableClick(table)}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
