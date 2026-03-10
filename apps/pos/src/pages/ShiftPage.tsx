import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Menu, ArrowLeft, Clock, DollarSign, TrendingUp, TrendingDown,
    X, ChevronRight, RefreshCw, CreditCard, Banknote,
    ArrowDownCircle, ArrowUpCircle, ShoppingCart,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface AuditData {
    startingCash: number;
    transactionsTotal: number;
    expectedCash: number;
    declaredCash: number | null;
    difference: number | null;
    breakdown: {
        sales: number;
        deposits: number;
        purchases: number;
        expenses: number;
        withdrawals: number;
    };
    transactionCount: number;
}

interface Transaction {
    id: string;
    amount: number;
    type: 'OPENING' | 'SALE' | 'PURCHASE' | 'EXPENSE' | 'WITHDRAWAL' | 'DEPOSIT';
    description: string | null;
    timestamp: string;
    currency: string;
    amountLocal: number | null;
    exchangeRate: number | null;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function formatPrice(n: number): string {
    return `$${Math.abs(n).toFixed(2).replace('.', ',')}`;
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m} ${ampm}`;
}

function formatDateTime(iso: string): string {
    const d = new Date(iso);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear().toString().slice(2);
    return `${day}/${month}/${year}, ${formatTime(iso)}`;
}

function timeSince(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

const txTypeConfig: Record<string, { label: string; icon: any; color: string }> = {
    SALE: { label: 'Venta', icon: ShoppingCart, color: '#93B59D' },
    DEPOSIT: { label: 'Ingreso', icon: ArrowDownCircle, color: '#3b82f6' },
    EXPENSE: { label: 'Gasto', icon: ArrowUpCircle, color: '#ef4444' },
    PURCHASE: { label: 'Compra', icon: ShoppingCart, color: '#f59e0b' },
    WITHDRAWAL: { label: 'Retiro', icon: ArrowUpCircle, color: '#ef4444' },
    OPENING: { label: 'Apertura', icon: DollarSign, color: '#93B59D' },
};

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function ShiftPage() {
    const navigate = useNavigate();
    const { employee, session: physicalSession, electronicSession, syncSession } = useAuth();
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<'physical' | 'electronic'>('physical');
    const [showCashModal, setShowCashModal] = useState(false);
    const [cashModalType, setCashModalType] = useState<'DEPOSIT' | 'EXPENSE'>('EXPENSE');
    const [cashAmount, setCashAmount] = useState('');
    const [cashDescription, setCashDescription] = useState('');
    const [cashCurrency, setCashCurrency] = useState('USD');
    const [submitting, setSubmitting] = useState(false);
    const [showTransactions, setShowTransactions] = useState(false);
    const loadingStatus = false;

    // Sessions come from AuthContext (tenant-wide, not employee-specific)
    const isOpen = !!(physicalSession || electronicSession);
    const activeSession = activeTab === 'physical' ? physicalSession : electronicSession;

    // ─── Fetch audit for active session ─────────────────────────────────
    const { data: auditData } = useQuery({
        queryKey: ['shift-audit', activeSession?.id],
        queryFn: async () => {
            if (!activeSession?.id) return null;
            const { data } = await api.get(`/register/audit/${activeSession.id}`);
            return data as AuditData;
        },
        enabled: !!activeSession?.id,
        refetchInterval: 15_000,
    });

    const otherSession = activeTab === 'physical' ? electronicSession : physicalSession;
    const { data: otherAudit } = useQuery({
        queryKey: ['shift-audit', otherSession?.id],
        queryFn: async () => {
            if (!otherSession?.id) return null;
            const { data } = await api.get(`/register/audit/${otherSession.id}`);
            return data as AuditData;
        },
        enabled: !!otherSession?.id,
        refetchInterval: 15_000,
    });

    // ─── Fetch transactions for active session ─────────────────────────
    const { data: transactions } = useQuery({
        queryKey: ['shift-transactions', activeSession?.id],
        queryFn: async () => {
            if (!activeSession?.id) return [];
            const { data } = await api.get(`/register/transactions/${activeSession.id}`);
            return (Array.isArray(data) ? data : data?.data || []) as Transaction[];
        },
        enabled: !!activeSession?.id,
        refetchInterval: 15_000,
    });

    // Combined sales summary (both registers)
    const combinedSales = (auditData?.breakdown?.sales || 0) + (otherAudit?.breakdown?.sales || 0);

    // ─── Cash movement handler ──────────────────────────────────────────
    const handleCashMovement = async () => {
        if (!activeSession?.id || !cashAmount || submitting) return;

        const amount = parseFloat(cashAmount);
        if (isNaN(amount) || amount <= 0) return;

        setSubmitting(true);
        try {
            const isExpense = cashModalType === 'EXPENSE';
            const finalAmount = isExpense ? -amount : amount;

            // Get exchange rate for non-USD currencies
            let exchangeRate = 1;
            let amountLocal = finalAmount;
            let amountUSD = finalAmount;

            if (cashCurrency !== 'USD') {
                try {
                    const { data: currencies } = await api.get('/currencies');
                    const curr = (currencies?.data || currencies || []).find(
                        (c: any) => c.code === cashCurrency
                    );
                    if (curr?.rateToUSD) {
                        exchangeRate = curr.rateToUSD;
                        amountLocal = finalAmount;
                        amountUSD = finalAmount / exchangeRate;
                    }
                } catch {
                    // fallback: use 1:1
                }
            }

            await api.post('/register/transaction', {
                sessionId: activeSession.id,
                amount: amountUSD,
                type: cashModalType,
                description: cashDescription || (isExpense ? 'Gasto' : 'Ingreso'),
                currency: cashCurrency,
                amountLocal,
                exchangeRate,
            });

            // Refresh data
            queryClient.invalidateQueries({ queryKey: ['shift-audit'] });
            queryClient.invalidateQueries({ queryKey: ['shift-transactions'] });

            setShowCashModal(false);
            setCashAmount('');
            setCashDescription('');
            setCashCurrency('USD');
        } catch (e: any) {
            console.error('Cash movement error:', e);
            alert(e?.response?.data?.error || 'Error registrando movimiento');
        } finally {
            setSubmitting(false);
        }
    };

    const refreshAll = () => {
        syncSession(); // Re-fetch tenant-wide sessions
        queryClient.invalidateQueries({ queryKey: ['shift-audit'] });
        queryClient.invalidateQueries({ queryKey: ['shift-transactions'] });
    };

    // ─── No open session state ──────────────────────────────────────────
    if (!loadingStatus && !isOpen) {
        return (
            <div className="fixed inset-0 flex flex-col safe-top safe-bottom" style={{ background: '#121413' }}>
                <header className="px-4 pt-3 pb-3 flex items-center gap-3 shrink-0"
                    style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                    <button onClick={() => navigate('/')}
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}>
                        <Menu className="w-4.5 h-4.5" style={{ color: '#F4F0EA' }} strokeWidth={2} />
                    </button>
                    <h1 className="text-lg font-semibold" style={{ color: '#F4F0EA' }}>Shift</h1>
                </header>

                <div className="flex-1 flex flex-col items-center justify-center px-8 gap-4">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}>
                        <Clock className="w-7 h-7" style={{ color: 'rgba(244,240,234,0.2)' }} />
                    </div>
                    <p className="text-base font-semibold text-center" style={{ color: 'rgba(244,240,234,0.5)' }}>
                        No hay turno abierto
                    </p>
                    <p className="text-sm text-center" style={{ color: 'rgba(244,240,234,0.25)' }}>
                        Abre la caja desde OPS para comenzar tu turno
                    </p>
                    <button onClick={refreshAll}
                        className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"
                        style={{ background: 'rgba(147,181,157,0.1)', color: '#93B59D', border: '1px solid rgba(147,181,157,0.2)' }}>
                        <RefreshCw className="w-4 h-4" /> Verificar
                    </button>
                </div>
            </div>
        );
    }

    // ─── Transaction List View ──────────────────────────────────────────
    if (showTransactions) {
        const txList = transactions || [];
        return (
            <div className="fixed inset-0 flex flex-col safe-top safe-bottom" style={{ background: '#121413' }}>
                <header className="px-4 pt-3 pb-3 flex items-center gap-3 shrink-0"
                    style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                    <button onClick={() => setShowTransactions(false)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}>
                        <ArrowLeft className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.5)' }} />
                    </button>
                    <h1 className="text-base font-semibold flex-1" style={{ color: '#F4F0EA' }}>
                        Movimientos — {activeTab === 'physical' ? 'Caja Física' : 'Caja Electrónica'}
                    </h1>
                </header>

                {/* Running balance */}
                <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(244,240,234,0.06)', background: 'rgba(244,240,234,0.02)' }}>
                    <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'rgba(244,240,234,0.3)' }}>
                            Balance actual
                        </span>
                        <span className="text-lg font-bold font-mono" style={{ color: '#93B59D' }}>
                            {formatPrice(auditData?.expectedCash || 0)}
                        </span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {txList.length === 0 ? (
                        <div className="flex items-center justify-center h-40">
                            <p className="text-sm" style={{ color: 'rgba(244,240,234,0.25)' }}>Sin movimientos</p>
                        </div>
                    ) : (
                        txList.map((tx) => {
                            const cfg = txTypeConfig[tx.type] || txTypeConfig.SALE;
                            const Icon = cfg.icon;
                            const isPositive = tx.amount >= 0;
                            return (
                                <div key={tx.id} className="px-4 py-3 flex items-center gap-3"
                                    style={{ borderBottom: '1px solid rgba(244,240,234,0.04)' }}>
                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}25` }}>
                                        <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                                                style={{ background: `${cfg.color}15`, color: cfg.color }}>
                                                {cfg.label}
                                            </span>
                                            {tx.currency !== 'USD' && (
                                                <span className="text-[10px] font-mono px-1 py-0.5 rounded"
                                                    style={{ background: 'rgba(244,240,234,0.06)', color: 'rgba(244,240,234,0.4)' }}>
                                                    {tx.currency}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs mt-1 truncate" style={{ color: 'rgba(244,240,234,0.4)' }}>
                                            {tx.description || cfg.label}
                                        </p>
                                        <p className="text-[10px] mt-0.5" style={{ color: 'rgba(244,240,234,0.2)' }}>
                                            {formatTime(tx.timestamp)}
                                        </p>
                                    </div>
                                    <span className="text-sm font-mono font-semibold tabular-nums shrink-0"
                                        style={{ color: isPositive ? '#93B59D' : '#ef4444' }}>
                                        {isPositive ? '+' : '-'}{formatPrice(tx.amount)}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    }

    // ─── Main Shift View ────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 flex flex-col safe-top safe-bottom" style={{ background: '#121413' }}>
            {/* Header */}
            <header className="px-4 pt-3 pb-3 flex items-center gap-3 shrink-0"
                style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                <button onClick={() => navigate('/')}
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}>
                    <Menu className="w-4.5 h-4.5" style={{ color: '#F4F0EA' }} strokeWidth={2} />
                </button>
                <h1 className="text-lg font-semibold flex-1" style={{ color: '#F4F0EA' }}>Shift</h1>
                <button onClick={refreshAll}
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}>
                    <Clock className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.4)' }} />
                </button>
            </header>

            {loadingStatus ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 rounded-full animate-spin"
                        style={{ borderColor: 'rgba(147,181,157,0.2)', borderTopColor: '#93B59D' }} />
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto">

                    {/* ── Action Buttons ─────────────────────────────────────── */}
                    <div className="px-4 pt-4 pb-2 space-y-2">
                        <button
                            onClick={() => { setCashModalType('EXPENSE'); setCashCurrency(activeTab === 'physical' ? 'USD' : 'VES'); setShowCashModal(true); }}
                            className="w-full py-3.5 rounded-xl text-sm font-semibold text-center transition-all active:scale-[0.98]"
                            style={{ border: '1.5px solid #93B59D', color: '#93B59D' }}>
                            CASH MANAGEMENT
                        </button>
                    </div>

                    {/* ── Shift Info ─────────────────────────────────────────── */}
                    <div className="px-4 pt-3 pb-4 space-y-1.5" style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                        <div className="flex items-center justify-between">
                            <span className="text-sm" style={{ color: 'rgba(244,240,234,0.5)' }}>Shift number: 1</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm" style={{ color: 'rgba(244,240,234,0.5)' }}>
                                Shift opened: {(physicalSession as any)?.employee?.fullName || employee?.fullName || 'Staff'}
                            </span>
                            <span className="text-sm font-mono" style={{ color: 'rgba(244,240,234,0.5)' }}>
                                {physicalSession ? formatDateTime(physicalSession.startedAt) : '—'}
                            </span>
                        </div>
                        {physicalSession && (
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#93B59D' }} />
                                <span className="text-xs" style={{ color: 'rgba(244,240,234,0.3)' }}>
                                    Abierto hace {timeSince(physicalSession.startedAt)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* ── Register Tab Toggle ───────────────────────────────── */}
                    <div className="px-4 pt-4 pb-2">
                        <div className="flex rounded-lg overflow-hidden"
                            style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}>
                            <button
                                onClick={() => setActiveTab('physical')}
                                className="flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider text-center transition-all"
                                style={{
                                    background: activeTab === 'physical' ? 'rgba(245,158,11,0.12)' : 'transparent',
                                    color: activeTab === 'physical' ? '#f59e0b' : 'rgba(244,240,234,0.35)',
                                    borderRight: '1px solid rgba(244,240,234,0.06)',
                                }}>
                                <Banknote className="w-3.5 h-3.5 inline mr-1.5" style={{ verticalAlign: '-2px' }} />
                                USD / COP
                            </button>
                            <button
                                onClick={() => setActiveTab('electronic')}
                                className="flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider text-center transition-all"
                                style={{
                                    background: activeTab === 'electronic' ? 'rgba(59,130,246,0.12)' : 'transparent',
                                    color: activeTab === 'electronic' ? '#3b82f6' : 'rgba(244,240,234,0.35)',
                                }}>
                                <CreditCard className="w-3.5 h-3.5 inline mr-1.5" style={{ verticalAlign: '-2px' }} />
                                VES
                            </button>
                        </div>
                    </div>

                    {/* ── Cash Drawer Section ───────────────────────────────── */}
                    <div className="px-4 pt-2">
                        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#93B59D' }}>
                            Cash drawer
                        </p>
                        <div className="space-y-0">
                            {[
                                { label: 'Starting cash', value: auditData?.startingCash || 0 },
                                { label: 'Cash payments', value: auditData?.breakdown?.sales || 0 },
                                { label: 'Cash refunds', value: 0 },
                                { label: 'Paid in', value: auditData?.breakdown?.deposits || 0 },
                                { label: 'Paid out', value: (auditData?.breakdown?.expenses || 0) + (auditData?.breakdown?.purchases || 0) + (auditData?.breakdown?.withdrawals || 0) },
                            ].map((row, i) => (
                                <div key={i} className="flex items-center justify-between py-3"
                                    style={{ borderBottom: '1px solid rgba(244,240,234,0.04)' }}>
                                    <span className="text-sm" style={{ color: 'rgba(244,240,234,0.6)' }}>{row.label}</span>
                                    <span className="text-sm font-mono tabular-nums" style={{ color: 'rgba(244,240,234,0.6)' }}>
                                        {formatPrice(row.value)}
                                    </span>
                                </div>
                            ))}
                            <div className="flex items-center justify-between py-3"
                                style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                                <span className="text-sm font-bold" style={{ color: '#F4F0EA' }}>Expected cash amount</span>
                                <span className="text-sm font-bold font-mono tabular-nums" style={{ color: '#F4F0EA' }}>
                                    {formatPrice(auditData?.expectedCash || 0)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ── Sales Summary Section ─────────────────────────────── */}
                    <div className="px-4 pt-6">
                        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#93B59D' }}>
                            Sales summary
                        </p>
                        <div className="space-y-0">
                            <div className="flex items-center justify-between py-3"
                                style={{ borderBottom: '1px solid rgba(244,240,234,0.04)' }}>
                                <span className="text-sm font-bold" style={{ color: '#F4F0EA' }}>Gross sales</span>
                                <span className="text-sm font-bold font-mono tabular-nums" style={{ color: '#F4F0EA' }}>
                                    {formatPrice(combinedSales)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-3"
                                style={{ borderBottom: '1px solid rgba(244,240,234,0.04)' }}>
                                <span className="text-sm" style={{ color: 'rgba(244,240,234,0.6)' }}>Refunds</span>
                                <span className="text-sm font-mono tabular-nums" style={{ color: 'rgba(244,240,234,0.6)' }}>
                                    {formatPrice(0)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-3"
                                style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                                <span className="text-sm" style={{ color: 'rgba(244,240,234,0.6)' }}>Discounts</span>
                                <span className="text-sm font-mono tabular-nums" style={{ color: 'rgba(244,240,234,0.6)' }}>
                                    {formatPrice(0)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-3"
                                style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                                <span className="text-sm font-bold" style={{ color: '#F4F0EA' }}>Net sales</span>
                                <span className="text-sm font-bold font-mono tabular-nums" style={{ color: '#F4F0EA' }}>
                                    {formatPrice(combinedSales)}
                                </span>
                            </div>

                            {/* Payment method breakdown */}
                            {physicalSession && (
                                <div className="flex items-center justify-between py-3"
                                    style={{ borderBottom: '1px solid rgba(244,240,234,0.04)' }}>
                                    <span className="text-sm" style={{ color: 'rgba(244,240,234,0.6)' }}>Cash</span>
                                    <span className="text-sm font-mono tabular-nums" style={{ color: 'rgba(244,240,234,0.6)' }}>
                                        {formatPrice(auditData && activeTab === 'physical' ? auditData.breakdown.sales : (otherAudit && activeTab === 'electronic' ? otherAudit.breakdown.sales : 0))}
                                    </span>
                                </div>
                            )}
                            {electronicSession && (
                                <div className="flex items-center justify-between py-3"
                                    style={{ borderBottom: '1px solid rgba(244,240,234,0.04)' }}>
                                    <span className="text-sm" style={{ color: 'rgba(244,240,234,0.6)' }}>Transferencias</span>
                                    <span className="text-sm font-mono tabular-nums" style={{ color: 'rgba(244,240,234,0.6)' }}>
                                        {formatPrice(activeTab === 'electronic' ? (auditData?.breakdown?.sales || 0) : (otherAudit?.breakdown?.sales || 0))}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Quick Actions ──────────────────────────────────────── */}
                    <div className="px-4 pt-6 pb-3">
                        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(244,240,234,0.3)' }}>
                            Quick actions
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => {
                                    setCashModalType('EXPENSE');
                                    setCashCurrency(activeTab === 'physical' ? 'USD' : 'VES');
                                    setShowCashModal(true);
                                }}
                                className="flex flex-col items-center gap-2 py-4 rounded-xl transition-all active:scale-[0.97]"
                                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
                                <TrendingDown className="w-5 h-5" style={{ color: '#ef4444' }} />
                                <span className="text-xs font-semibold" style={{ color: 'rgba(244,240,234,0.5)' }}>Registrar Gasto</span>
                            </button>
                            <button
                                onClick={() => {
                                    setCashModalType('DEPOSIT');
                                    setCashCurrency(activeTab === 'physical' ? 'USD' : 'VES');
                                    setShowCashModal(true);
                                }}
                                className="flex flex-col items-center gap-2 py-4 rounded-xl transition-all active:scale-[0.97]"
                                style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}>
                                <TrendingUp className="w-5 h-5" style={{ color: '#3b82f6' }} />
                                <span className="text-xs font-semibold" style={{ color: 'rgba(244,240,234,0.5)' }}>Ingreso</span>
                            </button>
                        </div>
                    </div>

                    {/* ── View Transactions Button ──────────────────────────── */}
                    <div className="px-4 pb-8">
                        <button onClick={() => setShowTransactions(true)}
                            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all active:scale-[0.98]"
                            style={{ background: 'rgba(244,240,234,0.03)', border: '1px solid rgba(244,240,234,0.06)' }}>
                            <div className="flex items-center gap-3">
                                <Clock className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.35)' }} />
                                <span className="text-sm" style={{ color: 'rgba(244,240,234,0.6)' }}>
                                    Ver movimientos ({auditData?.transactionCount || 0})
                                </span>
                            </div>
                            <ChevronRight className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.2)' }} />
                        </button>
                    </div>

                </div>
            )}

            {/* ═══ Cash Movement Modal ═══ */}
            {showCashModal && (
                <>
                    <div className="fixed inset-0 bg-black/70 z-50 animate-fade-in" onClick={() => setShowCashModal(false)} />
                    <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up safe-bottom"
                        style={{ background: '#1a1d1b', borderTopLeftRadius: 20, borderTopRightRadius: 20, border: '1px solid rgba(244,240,234,0.06)' }}>
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-5 pt-5 pb-3">
                            <h2 className="text-base font-semibold" style={{ color: '#F4F0EA' }}>
                                {cashModalType === 'EXPENSE' ? 'Registrar Gasto' : 'Registrar Ingreso'}
                            </h2>
                            <button onClick={() => setShowCashModal(false)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ background: 'rgba(244,240,234,0.06)' }}>
                                <X className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.4)' }} />
                            </button>
                        </div>

                        {/* Register info */}
                        <div className="px-5 pb-3">
                            <span className="text-xs px-2 py-1 rounded-md font-medium"
                                style={{
                                    background: activeTab === 'physical' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)',
                                    color: activeTab === 'physical' ? '#f59e0b' : '#3b82f6',
                                }}>
                                {activeTab === 'physical' ? 'Caja Física' : 'Caja Electrónica'}
                            </span>
                        </div>

                        {/* Currency selector */}
                        <div className="px-5 pb-3 flex gap-2">
                            {(activeTab === 'physical' ? ['USD', 'COP'] : ['VES', 'USD']).map(curr => (
                                <button key={curr}
                                    onClick={() => setCashCurrency(curr)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                    style={{
                                        background: cashCurrency === curr ? 'rgba(147,181,157,0.15)' : 'rgba(244,240,234,0.04)',
                                        color: cashCurrency === curr ? '#93B59D' : 'rgba(244,240,234,0.4)',
                                        border: `1px solid ${cashCurrency === curr ? 'rgba(147,181,157,0.3)' : 'rgba(244,240,234,0.06)'}`,
                                    }}>
                                    {curr}
                                </button>
                            ))}
                        </div>

                        {/* Amount input */}
                        <div className="px-5 pb-3">
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-mono"
                                    style={{ color: 'rgba(244,240,234,0.3)' }}>
                                    {cashCurrency === 'USD' ? '$' : cashCurrency === 'VES' ? 'Bs' : '$'}
                                </span>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    value={cashAmount}
                                    onChange={e => setCashAmount(e.target.value)}
                                    autoFocus
                                    className="w-full pl-10 pr-4 py-4 rounded-xl text-xl font-mono font-bold text-right focus:outline-none"
                                    style={{
                                        background: 'rgba(244,240,234,0.04)',
                                        border: '1px solid rgba(244,240,234,0.08)',
                                        color: '#F4F0EA',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div className="px-5 pb-4">
                            <input
                                type="text"
                                placeholder="Descripción (opcional)"
                                value={cashDescription}
                                onChange={e => setCashDescription(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
                                style={{
                                    background: 'rgba(244,240,234,0.04)',
                                    border: '1px solid rgba(244,240,234,0.06)',
                                    color: '#F4F0EA',
                                }}
                            />
                        </div>

                        {/* Submit button */}
                        <div className="px-5 pb-5">
                            <button
                                onClick={handleCashMovement}
                                disabled={!cashAmount || submitting}
                                className="w-full py-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-40"
                                style={{
                                    background: cashModalType === 'EXPENSE'
                                        ? 'rgba(239,68,68,0.15)'
                                        : 'rgba(59,130,246,0.15)',
                                    color: cashModalType === 'EXPENSE' ? '#ef4444' : '#3b82f6',
                                    border: `1px solid ${cashModalType === 'EXPENSE' ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.25)'}`,
                                }}>
                                {submitting ? (
                                    <div className="w-5 h-5 border-2 rounded-full animate-spin mx-auto"
                                        style={{ borderColor: 'rgba(244,240,234,0.1)', borderTopColor: cashModalType === 'EXPENSE' ? '#ef4444' : '#3b82f6' }} />
                                ) : (
                                    `Confirmar ${cashModalType === 'EXPENSE' ? 'Gasto' : 'Ingreso'}`
                                )}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
