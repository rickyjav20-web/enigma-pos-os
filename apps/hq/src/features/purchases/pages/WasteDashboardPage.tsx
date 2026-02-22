import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
    Trash2, TrendingUp, TrendingDown, Minus, AlertTriangle,
    RefreshCw, Loader2, Package, Users, Tag, MapPin, Calendar,
    ChevronDown
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface WasteDashboard {
    period: { from: string; to: string; days: number };
    kpis: {
        totalCost: number;
        totalEvents: number;
        totalQtyLost: number;
        worstItem: { name: string; costLost: number } | null;
        trendPct: number;
    };
    byItem: {
        supplyItemId: string;
        name: string;
        zone: number | null;
        totalQty: number;
        totalCostLost: number;
        eventCount: number;
    }[];
    byType: {
        wasteType: string;
        label: string;
        count: number;
        totalCostLost: number;
        pct: number;
    }[];
    byZone: { zone: string; count: number; totalCostLost: number }[];
    byEmployee: {
        employeeId: string;
        name: string;
        count: number;
        totalCostLost: number;
    }[];
    timeline: { date: string; count: number; totalCostLost: number }[];
    alerts: { itemId: string; name: string; message: string; severity: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PERIODS = [
    { label: 'Hoy', days: 1 },
    { label: 'Esta semana', days: 7 },
    { label: 'Este mes', days: 30 },
    { label: '3 meses', days: 90 },
];

function fmtCost(n: number) {
    return `$${n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getDateRange(days: number) {
    const to = new Date();
    const from = new Date(Date.now() - (days - 1) * 86400000);
    return {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
    };
}

const WASTE_TYPE_LABELS: Record<string, string> = {
    WRONG_ORDER: 'Pedido Incorrecto',
    DAMAGED: 'Dañado',
    EXPIRED: 'Vencido',
    OVERPRODUCTION: 'Sobreproducción',
    SPILLAGE: 'Derrame',
    QUALITY: 'Calidad',
    OTHER: 'Otro',
};

const ZONE_LABELS: Record<string, string> = {
    '1': 'Zona 1 — Barra',
    '2': 'Zona 2 — Cocina',
    '3': 'Zona 3 — Almacén',
    'unknown': 'Sin zona',
};

type TabKey = 'items' | 'type' | 'zone' | 'employee' | 'timeline';

// ─── Main Component ────────────────────────────────────────────────────────────
export default function WasteDashboardPage() {
    const [selectedDays, setSelectedDays] = useState(7);
    const [tab, setTab] = useState<TabKey>('items');
    const [data, setData] = useState<WasteDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [periodOpen, setPeriodOpen] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { from, to } = getDateRange(selectedDays);
        try {
            const res = await api.get('/waste/dashboard', { params: { from, to } });
            setData(res.data);
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Error al cargar datos de mermas.');
        } finally {
            setLoading(false);
        }
    }, [selectedDays]);

    useEffect(() => { load(); }, [load]);

    const periodLabel = PERIODS.find(p => p.days === selectedDays)?.label || `${selectedDays} días`;
    const trend = data?.kpis.trendPct ?? 0;

    return (
        <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                        <Trash2 size={20} className="text-red-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">Dashboard de Mermas</h1>
                        <p className="text-xs text-zinc-500">Analítica de pérdidas por item, causa y empleado</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Period selector */}
                    <div className="relative">
                        <button
                            onClick={() => setPeriodOpen(v => !v)}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-300 bg-white/5 hover:bg-white/10 rounded-xl border border-white/8 transition-colors"
                        >
                            <Calendar size={14} />
                            {periodLabel}
                            <ChevronDown size={12} className={`transition-transform ${periodOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {periodOpen && (
                            <div className="absolute right-0 top-10 bg-zinc-900 border border-white/10 rounded-xl shadow-xl z-20 min-w-[140px]">
                                {PERIODS.map(p => (
                                    <button
                                        key={p.days}
                                        onClick={() => { setSelectedDays(p.days); setPeriodOpen(false); }}
                                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors first:rounded-t-xl last:rounded-b-xl ${selectedDays === p.days ? 'text-white bg-white/5' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={load}
                        disabled={loading}
                        className="p-2 text-zinc-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/8 transition-colors"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {loading && (
                    <div className="flex items-center justify-center h-40 gap-3 text-zinc-500">
                        <Loader2 size={20} className="animate-spin" />
                        <span className="text-sm">Cargando datos...</span>
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm">
                        <AlertTriangle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {!loading && data && (
                    <>
                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KpiCard
                                label="Costo Total Perdido"
                                value={fmtCost(data.kpis.totalCost)}
                                sub={`${periodLabel}`}
                                accent="red"
                                icon={<Trash2 size={18} />}
                                trend={trend}
                            />
                            <KpiCard
                                label="Eventos Reportados"
                                value={String(data.kpis.totalEvents)}
                                sub="total"
                                accent="amber"
                                icon={<Tag size={18} />}
                            />
                            <KpiCard
                                label="Peor Item"
                                value={data.kpis.worstItem?.name || '—'}
                                sub={data.kpis.worstItem ? fmtCost(data.kpis.worstItem.costLost) : 'Sin datos'}
                                accent="orange"
                                icon={<AlertTriangle size={18} />}
                                truncateValue
                            />
                            <KpiCard
                                label="Tendencia"
                                value={trend === 0 ? '—' : `${trend > 0 ? '+' : ''}${trend.toFixed(0)}%`}
                                sub="vs período anterior"
                                accent={trend > 10 ? 'red' : trend < -10 ? 'emerald' : 'zinc'}
                                icon={trend > 0 ? <TrendingUp size={18} /> : trend < 0 ? <TrendingDown size={18} /> : <Minus size={18} />}
                            />
                        </div>

                        {/* Alerts */}
                        {data.alerts.length > 0 && (
                            <div className="space-y-2">
                                {data.alerts.map((a, i) => (
                                    <div
                                        key={i}
                                        className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${a.severity === 'HIGH'
                                            ? 'bg-red-500/8 border-red-500/20 text-red-300'
                                            : 'bg-amber-500/8 border-amber-500/20 text-amber-300'
                                        }`}
                                    >
                                        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                                        <div>
                                            <span className="font-semibold">{a.name}</span>
                                            <span className="text-current/70 ml-2">{a.message}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Tabs */}
                        <div>
                            <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/5 mb-4 flex-wrap">
                                {([
                                    { key: 'items', label: 'Por Item', icon: <Package size={13} /> },
                                    { key: 'type', label: 'Por Causa', icon: <Tag size={13} /> },
                                    { key: 'zone', label: 'Por Zona', icon: <MapPin size={13} /> },
                                    { key: 'employee', label: 'Por Empleado', icon: <Users size={13} /> },
                                    { key: 'timeline', label: 'Histórico', icon: <Calendar size={13} /> },
                                ] as { key: TabKey; label: string; icon: React.ReactNode }[]).map(t => (
                                    <button
                                        key={t.key}
                                        onClick={() => setTab(t.key)}
                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${tab === t.key
                                            ? 'bg-white/10 text-white'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                        }`}
                                    >
                                        {t.icon}
                                        {t.label}
                                    </button>
                                ))}
                            </div>

                            {/* Tab: By Item */}
                            {tab === 'items' && (
                                <div className="space-y-1">
                                    {data.byItem.length === 0 && <EmptyState label="Sin mermas registradas en este período" />}
                                    {data.byItem.map((item, i) => (
                                        <div key={item.supplyItemId} className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                                            <span className="text-xs text-zinc-600 font-mono w-5">{i + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                                                <p className="text-xs text-zinc-500">
                                                    {item.eventCount} eventos · {ZONE_LABELS[String(item.zone)] || 'Sin zona'}
                                                </p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-sm font-bold text-red-400">{fmtCost(item.totalCostLost)}</p>
                                                <p className="text-xs text-zinc-600">{item.totalQty.toLocaleString('es', { maximumFractionDigits: 2 })} unidades</p>
                                            </div>
                                            {/* Cost bar */}
                                            <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden flex-shrink-0">
                                                <div
                                                    className="h-full bg-red-500/60 rounded-full"
                                                    style={{ width: `${Math.min(100, (item.totalCostLost / (data.kpis.totalCost || 1)) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Tab: By Type */}
                            {tab === 'type' && (
                                <div className="space-y-2">
                                    {data.byType.length === 0 && <EmptyState label="Sin datos de tipo de merma" />}
                                    {data.byType.map(t => (
                                        <div key={t.wasteType} className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                                            <div className="flex items-center justify-between mb-2">
                                                <div>
                                                    <p className="text-sm font-semibold text-white">{WASTE_TYPE_LABELS[t.wasteType] || t.wasteType}</p>
                                                    <p className="text-xs text-zinc-500">{t.count} eventos</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-red-400">{fmtCost(t.totalCostLost)}</p>
                                                    <p className="text-xs text-zinc-500">{t.pct.toFixed(1)}% del total</p>
                                                </div>
                                            </div>
                                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-amber-500/50 rounded-full transition-all duration-700"
                                                    style={{ width: `${t.pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Tab: By Zone */}
                            {tab === 'zone' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {data.byZone.length === 0 && <div className="col-span-3"><EmptyState label="Sin datos por zona" /></div>}
                                    {data.byZone.map(z => (
                                        <div key={z.zone} className="p-5 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                                            <MapPin size={24} className="text-zinc-500 mx-auto mb-2" />
                                            <p className="text-sm font-semibold text-white mb-1">{ZONE_LABELS[z.zone] || `Zona ${z.zone}`}</p>
                                            <p className="text-2xl font-bold text-red-400">{fmtCost(z.totalCostLost)}</p>
                                            <p className="text-xs text-zinc-500 mt-1">{z.count} eventos</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Tab: By Employee */}
                            {tab === 'employee' && (
                                <div className="space-y-1">
                                    {data.byEmployee.length === 0 && <EmptyState label="Sin datos por empleado" />}
                                    {data.byEmployee.map((emp, i) => (
                                        <div key={emp.employeeId} className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                                            <span className="text-xs text-zinc-600 font-mono w-5">{i + 1}</span>
                                            <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                                                <span className="text-xs font-bold text-violet-300">{emp.name.substring(0, 2).toUpperCase()}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-white truncate">{emp.name}</p>
                                                <p className="text-xs text-zinc-500">{emp.count} eventos reportados</p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-sm font-bold text-red-400">{fmtCost(emp.totalCostLost)}</p>
                                                <p className="text-xs text-zinc-500">
                                                    ${(emp.totalCostLost / Math.max(emp.count, 1)).toFixed(2)} / evento
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Tab: Timeline */}
                            {tab === 'timeline' && (
                                <div>
                                    {data.timeline.length === 0 && <EmptyState label="Sin datos históricos" />}
                                    <div className="space-y-1">
                                        {data.timeline.map(day => {
                                            const maxCost = Math.max(...data.timeline.map(d => d.totalCostLost), 0.01);
                                            const barPct = (day.totalCostLost / maxCost) * 100;
                                            const dateLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
                                            return (
                                                <div key={day.date} className="flex items-center gap-4 p-2">
                                                    <span className="text-xs text-zinc-500 w-28 flex-shrink-0 capitalize">{dateLabel}</span>
                                                    <div className="flex-1 h-6 bg-white/[0.03] rounded-lg overflow-hidden">
                                                        <div
                                                            className="h-full bg-red-500/40 rounded-lg transition-all duration-500"
                                                            style={{ width: `${barPct}%` }}
                                                        />
                                                    </div>
                                                    <div className="text-right flex-shrink-0 w-20">
                                                        <p className="text-xs font-bold text-red-400">{fmtCost(day.totalCostLost)}</p>
                                                        <p className="text-[10px] text-zinc-600">{day.count} eventos</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function KpiCard({
    label, value, sub, accent, icon, trend, truncateValue
}: {
    label: string;
    value: string;
    sub: string;
    accent: 'red' | 'amber' | 'orange' | 'emerald' | 'zinc';
    icon: React.ReactNode;
    trend?: number;
    truncateValue?: boolean;
}) {
    const colors: Record<string, string> = {
        red: 'bg-red-500/10 border-red-500/20 text-red-400',
        amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
        orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
        emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
        zinc: 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400',
    };
    return (
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 border ${colors[accent]}`}>
                {icon}
            </div>
            <p className={`text-xl font-bold text-white mb-0.5 ${truncateValue ? 'truncate' : ''}`}>{value}</p>
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>
            {trend !== undefined && trend !== 0 && (
                <div className={`flex items-center gap-1 mt-1 text-[10px] font-semibold ${trend > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {trend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {Math.abs(trend).toFixed(0)}% vs anterior
                </div>
            )}
        </div>
    );
}

function EmptyState({ label }: { label: string }) {
    return (
        <div className="text-center py-12 text-zinc-600">
            <Package size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{label}</p>
        </div>
    );
}
