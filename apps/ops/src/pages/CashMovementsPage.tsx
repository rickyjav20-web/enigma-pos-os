
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, X, Loader2, DollarSign, Wallet, ShoppingCart, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
const TENANT_HEADER = { 'x-tenant-id': 'enigma_hq', 'Content-Type': 'application/json' };

interface AuditData {
    startingCash: number;
    transactionsTotal: number;
    expectedCash: number;
    breakdown?: { sales: number; purchases: number; expenses: number; other: number };
    transactionCount: number;
}

export default function CashMovementsPage() {
    const { session } = useAuth();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [auditData, setAuditData] = useState<AuditData | null>(null);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [txType, setTxType] = useState<'EXPENSE' | 'DEPOSIT'>('EXPENSE');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (session?.id) {
            fetchTransactions();
            fetchAudit();
        }
    }, [session]);

    const fetchTransactions = async () => {
        try {
            const res = await fetch(`${API_URL}/register/transactions/${session?.id}`, {
                headers: TENANT_HEADER
            });
            const data = await res.json();
            setTransactions(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAudit = async () => {
        try {
            const res = await fetch(`${API_URL}/register/audit/${session?.id}`, {
                headers: TENANT_HEADER
            });
            const data = await res.json();
            setAuditData(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleTransaction = async () => {
        if (!amount || !description) return;
        setIsSubmitting(true);

        const val = parseFloat(amount);
        const finalAmount = txType === 'EXPENSE' ? -Math.abs(val) : Math.abs(val);

        try {
            await fetch(`${API_URL}/register/transaction`, {
                method: 'POST',
                headers: TENANT_HEADER,
                body: JSON.stringify({
                    sessionId: session?.id,
                    amount: finalAmount,
                    type: txType,
                    description: description
                })
            });
            setShowModal(false);
            setAmount('');
            setDescription('');
            fetchTransactions();
            fetchAudit(); // Refresh balance
        } catch (e) {
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const getTypeStyle = (type: string, amount: number) => {
        if (type === 'SALE') return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Venta', icon: <Receipt className="w-5 h-5" /> };
        if (type === 'PURCHASE') return { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Compra Proveedor', icon: <ShoppingCart className="w-5 h-5" /> };
        if (type === 'EXPENSE') return { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Gasto', icon: <ArrowUpRight className="w-5 h-5" /> };
        if (type === 'DEPOSIT') return { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Ingreso', icon: <ArrowDownLeft className="w-5 h-5" /> };
        return { bg: amount < 0 ? 'bg-red-500/10' : 'bg-emerald-500/10', text: amount < 0 ? 'text-red-400' : 'text-emerald-400', label: type, icon: amount < 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" /> };
    };

    return (
        <div className="min-h-screen bg-enigma-black p-4 pb-24 text-white">
            <header className="flex items-center gap-4 mb-6">
                <Link to="/" className="p-2 bg-white/5 rounded-lg active:scale-95 transition-transform">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-xl font-bold">Movimientos de Caja</h1>
                    <p className="text-sm text-white/50">Sesión Actual</p>
                </div>
            </header>

            {/* Running Balance Card */}
            {auditData && (
                <div className="mb-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-enigma-gray border border-emerald-500/20 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs text-white/50 uppercase tracking-wider">Saldo Actual</span>
                        </div>
                        <span className="text-2xl font-bold font-mono text-white">
                            ${auditData.expectedCash.toFixed(2)}
                        </span>
                    </div>
                    <div className="flex gap-4 mt-3 text-xs">
                        <span className="text-white/40">
                            Fondo: <span className="font-mono text-white/60">${auditData.startingCash.toFixed(2)}</span>
                        </span>
                        {auditData.breakdown && (
                            <>
                                <span className="text-emerald-400/70">
                                    Ventas: +${auditData.breakdown.sales.toFixed(2)}
                                </span>
                                <span className="text-red-400/70">
                                    Salidas: ${(auditData.breakdown.expenses + auditData.breakdown.purchases).toFixed(2)}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                    onClick={() => { setTxType('EXPENSE'); setShowModal(true); }}
                    className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex flex-col items-center gap-2 hover:bg-red-500/20 transition-colors"
                >
                    <div className="p-2 rounded-full bg-red-500/20 text-red-400">
                        <ArrowUpRight className="w-6 h-6" />
                    </div>
                    <span className="font-medium text-red-200">Registrar Gasto</span>
                    <span className="text-xs text-white/30">Hielo, taxi, gastos menores</span>
                </button>

                <button
                    onClick={() => { setTxType('DEPOSIT'); setShowModal(true); }}
                    className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center gap-2 hover:bg-emerald-500/20 transition-colors"
                >
                    <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-400">
                        <ArrowDownLeft className="w-6 h-6" />
                    </div>
                    <span className="font-medium text-emerald-200">Ingreso Efectivo</span>
                    <span className="text-xs text-white/30">Fondo adicional, cambio</span>
                </button>
            </div>

            {/* List */}
            <div className="space-y-3">
                <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">
                    Historial ({transactions.length})
                </h3>

                {isLoading ? <Loader2 className="w-8 h-8 animate-spin mx-auto text-white/30" /> : (
                    transactions.map(tx => {
                        const style = getTypeStyle(tx.type, tx.amount);
                        return (
                            <div key={tx.id} className="p-4 rounded-xl bg-enigma-gray border border-white/5 flex justify-between items-center">
                                <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-lg ${style.bg} ${style.text}`}>
                                        {style.icon}
                                    </div>
                                    <div>
                                        <p className="font-medium">{tx.description || 'Movimiento'}</p>
                                        <p className={`text-xs ${style.text} capitalize`}>
                                            {style.label}
                                        </p>
                                        <p className="text-xs text-white/30 font-mono mt-1">
                                            {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                <span className={`font-mono font-bold text-lg ${tx.amount < 0 ? 'text-white' : 'text-emerald-400'}`}>
                                    {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                                </span>
                            </div>
                        );
                    })
                )}

                {transactions.length === 0 && !isLoading && (
                    <div className="text-center py-12 text-white/30 space-y-2">
                        <Wallet className="w-12 h-12 mx-auto opacity-30" />
                        <p>No hay movimientos registrados en esta sesión.</p>
                        <p className="text-xs">Registra ventas, gastos o compras para verlos aquí.</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-sm bg-enigma-gray rounded-3xl p-6 space-y-4 border border-white/10 shadow-2xl">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-lg">
                                {txType === 'EXPENSE' ? '📤 Registrar Salida' : '📥 Registrar Entrada'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Current balance context */}
                        {auditData && (
                            <div className="text-xs text-white/40 bg-white/5 rounded-lg p-2 flex justify-between">
                                <span>Saldo actual:</span>
                                <span className="font-mono text-white/60">${auditData.expectedCash.toFixed(2)}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-white/50 block mb-1">Monto</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-3.5 w-5 h-5 text-white/30" />
                                    <input
                                        type="number"
                                        autoFocus
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl p-3 pl-10 text-lg font-mono"
                                        placeholder="0.00"
                                    />
                                </div>
                                {/* Preview new balance */}
                                {amount && auditData && (
                                    <p className="text-xs text-white/30 mt-1 text-right">
                                        Nuevo saldo: <span className="font-mono text-white/50">
                                            ${(auditData.expectedCash + (txType === 'EXPENSE' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount)))).toFixed(2)}
                                        </span>
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="text-xs text-white/50 block mb-1">Descripción / Motivo</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 h-20 resize-none"
                                    placeholder={txType === 'EXPENSE' ? "Ej: Hielo, Taxi, Reparación..." : "Ej: Fondo adicional, Cambio..."}
                                />
                            </div>

                            <button
                                onClick={handleTransaction}
                                disabled={!amount || !description || isSubmitting}
                                className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2
                                    ${txType === 'EXPENSE' ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}
                                    disabled:opacity-50 disabled:cursor-not-allowed transition-all
                                `}
                            >
                                {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckIcon />}
                                Confirmar {txType === 'EXPENSE' ? 'Gasto' : 'Ingreso'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function CheckIcon() {
    return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
}
