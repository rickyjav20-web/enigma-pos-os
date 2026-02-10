import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    DollarSign, TrendingUp, AlertTriangle, CheckCircle2, Clock,
    Users, ArrowUpRight, ShoppingCart, ChevronDown, ChevronUp,
    CalendarDays, BarChart3, Shield
} from 'lucide-react';

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:4000/api/v1';
const TENANT_HEADER = { 'x-tenant-id': 'enigma_hq', 'Content-Type': 'application/json' };

interface SessionView {
    id: string;
    employee: { id: string; fullName: string; role: string };
    startedAt: string;
    endedAt: string | null;
    status: string;
    startingCash: number;
    declaredCash: number | null;
    declaredCard: number | null;
    declaredTransfer: number | null;
    expectedCash: number;
    difference: number | null;
    notes: string | null;
    breakdown: { sales: number; purchases: number; expenses: number; deposits: number };
    transactionCount: number;
    transactions: any[];
}

interface DailySummary {
    date: string;
    totalSessions: number;
    closedSessions: number;
    openSessions: number;
    totalSales: number;
    totalPurchases: number;
    totalExpenses: number;
    totalDeposits: number;
    totalDeclaredCash: number;
    totalExpectedCash: number;
    totalDifference: number;
}

interface CashierStat {
    employee: { id: string; fullName: string; role: string };
    totalSessions: number;
    perfectCloses: number;
    accuracy: number;
    avgDifference: number;
    avgAbsDifference: number;
    totalSales: number;
    totalTransactions: number;
    lastSession: string | null;
}

type TabType = 'today' | 'sessions' | 'cashiers';

export default function RegisterAdminPage() {
    const [activeTab, setActiveTab] = useState<TabType>('today');
    const [summary, setSummary] = useState<DailySummary | null>(null);
    const [sessions, setSessions] = useState<SessionView[]>([]);
    const [cashierStats, setCashierStats] = useState<CashierStat[]>([]);
    const [expandedSession, setExpandedSession] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [selectedDate]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [summaryRes, sessionsRes, statsRes] = await Promise.all([
                fetch(`${API_URL}/register/sessions/daily-summary?date=${selectedDate}`, { headers: TENANT_HEADER }),
                fetch(`${API_URL}/register/sessions?date=${selectedDate}`, { headers: TENANT_HEADER }),
                fetch(`${API_URL}/register/cashier-stats?days=30`, { headers: TENANT_HEADER })
            ]);

            const [summaryData, sessionsData, statsData] = await Promise.all([
                summaryRes.json(),
                sessionsRes.json(),
                statsRes.json()
            ]);

            setSummary(summaryData);
            setSessions(sessionsData);
            setCashierStats(statsData.cashiers || []);
        } catch (e) {
            console.error('Failed to load register admin data', e);
        } finally {
            setIsLoading(false);
        }
    };

    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

    const tabs: { id: TabType; label: string; icon: any }[] = [
        { id: 'today', label: 'Resumen del Día', icon: CalendarDays },
        { id: 'sessions', label: 'Sesiones', icon: Clock },
        { id: 'cashiers', label: 'Rendimiento', icon: BarChart3 },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                        <Shield className="w-8 h-8 text-emerald-400" />
                        Centro de Control — Caja
                    </h2>
                    <p className="text-sm text-white/40 mt-1">
                        Supervisión de operaciones, cierres y rendimiento de cajeros
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                    />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-white/5 pb-0">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-[1px]
                            ${activeTab === tab.id
                                ? 'text-emerald-400 border-emerald-400'
                                : 'text-white/40 border-transparent hover:text-white/60'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="text-center py-20 text-white/30">Cargando datos...</div>
            ) : (
                <>
                    {activeTab === 'today' && summary && <DailySummaryView summary={summary} fmt={fmt} />}
                    {activeTab === 'sessions' && (
                        <SessionsTable
                            sessions={sessions}
                            expandedSession={expandedSession}
                            setExpandedSession={setExpandedSession}
                            fmt={fmt}
                        />
                    )}
                    {activeTab === 'cashiers' && <CashierStatsView stats={cashierStats} fmt={fmt} />}
                </>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// DAILY SUMMARY TAB
// ═══════════════════════════════════════════════════════════
function DailySummaryView({ summary, fmt }: { summary: DailySummary; fmt: (n: number) => string }) {
    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white/60">Ventas Efectivo</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-400 font-mono">{fmt(summary.totalSales)}</div>
                        <p className="text-xs text-white/40 mt-1">Ingresos del día</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white/60">Compras</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-amber-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-400 font-mono">{fmt(Math.abs(summary.totalPurchases))}</div>
                        <p className="text-xs text-white/40 mt-1">Pagos a proveedores</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white/60">Gastos</CardTitle>
                        <ArrowUpRight className="h-4 w-4 text-red-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-400 font-mono">{fmt(Math.abs(summary.totalExpenses))}</div>
                        <p className="text-xs text-white/40 mt-1">Salidas operativas</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white/60">Diferencia</CardTitle>
                        {Math.abs(summary.totalDifference) < 0.01
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            : <AlertTriangle className="h-4 w-4 text-red-400" />
                        }
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold font-mono ${Math.abs(summary.totalDifference) < 0.01 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmt(summary.totalDifference)}
                        </div>
                        <p className="text-xs text-white/40 mt-1">
                            {summary.closedSessions} cierres • {summary.openSessions > 0 ? `${summary.openSessions} abiertas` : 'Todas cerradas'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Cash Flow Summary */}
            <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-emerald-400" />
                        Flujo de Efectivo del Día
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <FlowRow label="Efectivo Declarado (Conteo)" value={summary.totalDeclaredCash} fmt={fmt} color="text-white" />
                        <FlowRow label="Efectivo Esperado (Sistema)" value={summary.totalExpectedCash} fmt={fmt} color="text-white/60" />
                        <div className="border-t border-white/10 pt-2">
                            <FlowRow
                                label="Diferencia Global"
                                value={summary.totalDifference}
                                fmt={fmt}
                                color={Math.abs(summary.totalDifference) < 0.01 ? 'text-emerald-400' : 'text-red-400'}
                                bold
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Sessions Status */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="bg-slate-900 border-slate-800 text-center">
                    <CardContent className="pt-6">
                        <p className="text-4xl font-bold text-white font-mono">{summary.totalSessions}</p>
                        <p className="text-xs text-white/40 mt-1">Total Sesiones</p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800 text-center">
                    <CardContent className="pt-6">
                        <p className="text-4xl font-bold text-emerald-400 font-mono">{summary.closedSessions}</p>
                        <p className="text-xs text-white/40 mt-1">Cerradas</p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800 text-center">
                    <CardContent className="pt-6">
                        <p className={`text-4xl font-bold font-mono ${summary.openSessions > 0 ? 'text-amber-400' : 'text-white/20'}`}>
                            {summary.openSessions}
                        </p>
                        <p className="text-xs text-white/40 mt-1">Abiertas</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function FlowRow({ label, value, fmt, color, bold }: {
    label: string; value: number; fmt: (n: number) => string; color: string; bold?: boolean;
}) {
    return (
        <div className="flex justify-between items-center">
            <span className={`text-sm ${bold ? 'font-bold' : ''} text-white/60`}>{label}</span>
            <span className={`font-mono ${bold ? 'text-lg font-bold' : 'text-sm'} ${color}`}>{fmt(value)}</span>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// SESSIONS TABLE TAB
// ═══════════════════════════════════════════════════════════
function SessionsTable({ sessions, expandedSession, setExpandedSession, fmt }: {
    sessions: SessionView[];
    expandedSession: string | null;
    setExpandedSession: (id: string | null) => void;
    fmt: (n: number) => string;
}) {
    if (sessions.length === 0) {
        return (
            <div className="text-center py-20 text-white/30">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No hay sesiones de caja para esta fecha.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {sessions.map(session => {
                const isExpanded = expandedSession === session.id;
                const diffColor = session.difference == null
                    ? 'text-white/30'
                    : Math.abs(session.difference) < 0.01
                        ? 'text-emerald-400'
                        : 'text-red-400';

                return (
                    <Card key={session.id} className="bg-slate-900 border-slate-800 overflow-hidden">
                        {/* Session Header */}
                        <button
                            onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                            className="w-full text-left"
                        >
                            <CardContent className="py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center
                                            ${session.status === 'open' ? 'bg-amber-500/20' : 'bg-emerald-500/20'}`}>
                                            {session.status === 'open'
                                                ? <Clock className="w-5 h-5 text-amber-400" />
                                                : <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                            }
                                        </div>
                                        <div>
                                            <p className="font-bold text-white">{session.employee.fullName}</p>
                                            <div className="flex items-center gap-2 text-xs text-white/40">
                                                <span>{new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                {session.endedAt && (
                                                    <>
                                                        <span>→</span>
                                                        <span>{new Date(session.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <Badge variant={session.status === 'open' ? 'outline' : 'secondary'}
                                            className={session.status === 'open' ? 'border-amber-500/50 text-amber-400' : 'bg-emerald-500/20 text-emerald-400 border-0'}>
                                            {session.status === 'open' ? 'Abierta' : 'Cerrada'}
                                        </Badge>

                                        {session.difference != null && (
                                            <div className="text-right">
                                                <p className={`font-mono font-bold ${diffColor}`}>
                                                    {session.difference > 0 ? '+' : ''}{fmt(session.difference)}
                                                </p>
                                                <p className="text-xs text-white/30">diferencia</p>
                                            </div>
                                        )}

                                        <div className="text-right">
                                            <p className="font-mono text-sm text-white">{fmt(session.expectedCash)}</p>
                                            <p className="text-xs text-white/30">esperado</p>
                                        </div>

                                        {isExpanded
                                            ? <ChevronUp className="w-4 h-4 text-white/30" />
                                            : <ChevronDown className="w-4 h-4 text-white/30" />
                                        }
                                    </div>
                                </div>
                            </CardContent>
                        </button>

                        {/* Expanded Detail */}
                        {isExpanded && (
                            <div className="border-t border-white/5 bg-black/30 p-4 space-y-4 animate-fade-in">
                                {/* Breakdown */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                    <MiniStat label="Fondo Inicial" value={fmt(session.startingCash)} color="text-white/60" />
                                    <MiniStat label="Ventas" value={`+${fmt(session.breakdown.sales)}`} color="text-emerald-400" />
                                    <MiniStat label="Compras" value={fmt(session.breakdown.purchases)} color="text-amber-400" />
                                    <MiniStat label="Gastos" value={fmt(session.breakdown.expenses)} color="text-red-400" />
                                </div>

                                {/* Audit Row */}
                                {session.status === 'closed' && (
                                    <div className="bg-white/5 rounded-lg p-3 space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-white/40">Efectivo Esperado</span>
                                            <span className="font-mono text-white/70">{fmt(session.expectedCash)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-white/40">Efectivo Declarado</span>
                                            <span className="font-mono text-white">{fmt(session.declaredCash || 0)}</span>
                                        </div>
                                        {session.declaredCard != null && session.declaredCard > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-white/40">Tarjeta Declarada</span>
                                                <span className="font-mono text-blue-400">{fmt(session.declaredCard)}</span>
                                            </div>
                                        )}
                                        {session.declaredTransfer != null && session.declaredTransfer > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-white/40">Transfer Declarada</span>
                                                <span className="font-mono text-purple-400">{fmt(session.declaredTransfer)}</span>
                                            </div>
                                        )}
                                        <div className="border-t border-white/10 pt-2 flex justify-between text-sm font-bold">
                                            <span className="text-white/60">Diferencia</span>
                                            <span className={`font-mono ${diffColor}`}>
                                                {session.difference! > 0 ? '+' : ''}{fmt(session.difference!)}
                                            </span>
                                        </div>
                                        {session.notes && (
                                            <p className="text-xs text-white/30 italic mt-2">📝 {session.notes}</p>
                                        )}
                                    </div>
                                )}

                                {/* Transaction List */}
                                {session.transactions.length > 0 && (
                                    <div>
                                        <p className="text-xs text-white/40 uppercase tracking-wider mb-2">
                                            {session.transactionCount} Movimientos
                                        </p>
                                        <div className="max-h-60 overflow-auto space-y-1">
                                            {session.transactions.map((tx: any) => (
                                                <div key={tx.id} className="flex justify-between items-center py-1.5 px-2 rounded text-sm hover:bg-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <TypeBadge type={tx.type} />
                                                        <span className="text-white/70 truncate max-w-[200px]">{tx.description || tx.type}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs text-white/30 font-mono">
                                                            {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        <span className={`font-mono font-bold ${tx.amount < 0 ? 'text-white/70' : 'text-emerald-400'}`}>
                                                            {tx.amount > 0 ? '+' : ''}{fmt(tx.amount)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                );
            })}
        </div>
    );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="bg-white/5 rounded-lg p-2 text-center">
            <p className={`font-mono text-sm font-bold ${color}`}>{value}</p>
            <p className="text-xs text-white/30">{label}</p>
        </div>
    );
}

function TypeBadge({ type }: { type: string }) {
    const styles: Record<string, string> = {
        SALE: 'bg-emerald-500/20 text-emerald-400',
        PURCHASE: 'bg-amber-500/20 text-amber-400',
        EXPENSE: 'bg-red-500/20 text-red-400',
        DEPOSIT: 'bg-blue-500/20 text-blue-400',
        OPENING: 'bg-purple-500/20 text-purple-400',
        WITHDRAWAL: 'bg-orange-500/20 text-orange-400',
    };
    const labels: Record<string, string> = {
        SALE: 'Venta',
        PURCHASE: 'Compra',
        EXPENSE: 'Gasto',
        DEPOSIT: 'Ingreso',
        OPENING: 'Apertura',
        WITHDRAWAL: 'Retiro',
    };
    return (
        <span className={`text-xs px-2 py-0.5 rounded-full ${styles[type] || 'bg-white/10 text-white/50'}`}>
            {labels[type] || type}
        </span>
    );
}

// ═══════════════════════════════════════════════════════════
// CASHIER PERFORMANCE TAB
// ═══════════════════════════════════════════════════════════
function CashierStatsView({ stats, fmt }: { stats: CashierStat[]; fmt: (n: number) => string }) {
    if (stats.length === 0) {
        return (
            <div className="text-center py-20 text-white/30">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No hay datos de rendimiento aún.</p>
                <p className="text-xs">Los datos se acumulan con cada cierre de caja.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <p className="text-xs text-white/40">Últimos 30 días • Basado en {stats.reduce((s, c) => s + c.totalSessions, 0)} cierres</p>

            {stats.map(cashier => {
                const accuracyColor = cashier.accuracy >= 90 ? 'text-emerald-400' : cashier.accuracy >= 70 ? 'text-amber-400' : 'text-red-400';
                const accuracyBg = cashier.accuracy >= 90 ? 'bg-emerald-500/20' : cashier.accuracy >= 70 ? 'bg-amber-500/20' : 'bg-red-500/20';

                return (
                    <Card key={cashier.employee.id} className="bg-slate-900 border-slate-800">
                        <CardContent className="py-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-full ${accuracyBg} flex items-center justify-center`}>
                                        <span className={`text-lg font-bold font-mono ${accuracyColor}`}>
                                            {cashier.accuracy}%
                                        </span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-white">{cashier.employee.fullName}</p>
                                        <Badge variant="outline" className="text-xs border-white/20 text-white/40">
                                            {cashier.employee.role}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-white/30">Último cierre</p>
                                    <p className="text-xs text-white/50">
                                        {cashier.lastSession
                                            ? new Date(cashier.lastSession).toLocaleDateString()
                                            : 'N/A'
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-4 gap-3">
                                <div className="text-center">
                                    <p className="font-mono text-sm font-bold text-white">{cashier.totalSessions}</p>
                                    <p className="text-xs text-white/30">Sesiones</p>
                                </div>
                                <div className="text-center">
                                    <p className="font-mono text-sm font-bold text-emerald-400">{cashier.perfectCloses}</p>
                                    <p className="text-xs text-white/30">Perfectos</p>
                                </div>
                                <div className="text-center">
                                    <p className={`font-mono text-sm font-bold ${Math.abs(cashier.avgDifference) < 0.01 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {fmt(cashier.avgDifference)}
                                    </p>
                                    <p className="text-xs text-white/30">Dif. Prom</p>
                                </div>
                                <div className="text-center">
                                    <p className="font-mono text-sm font-bold text-white">{fmt(cashier.totalSales)}</p>
                                    <p className="text-xs text-white/30">Ventas Total</p>
                                </div>
                            </div>

                            {/* Accuracy Bar */}
                            <div className="mt-3">
                                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${cashier.accuracy >= 90 ? 'bg-emerald-500' : cashier.accuracy >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                                        style={{ width: `${cashier.accuracy}%` }}
                                    />
                                </div>
                                <p className="text-xs text-white/20 mt-1">
                                    Precisión: {cashier.perfectCloses}/{cashier.totalSessions} cierres exactos
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
