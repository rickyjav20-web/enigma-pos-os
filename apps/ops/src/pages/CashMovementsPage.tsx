
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrencies } from '../hooks/useCurrencies';
import CurrencyInput, { CurrencyValue } from '../components/CurrencyInput';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, X, Loader2, Wallet, ShoppingCart, Receipt, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
const TENANT_HEADER = { 'x-tenant-id': 'enigma_hq', 'Content-Type': 'application/json' };

type RegisterType = 'PHYSICAL' | 'ELECTRONIC';

interface AuditData {
    startingCash: number;
    transactionsTotal: number;
    expectedCash: number;
    breakdown?: { sales: number; purchases: number; expenses: number; other: number };
    transactionCount: number;
}

export default function CashMovementsPage() {
    const { session, electronicSession } = useAuth();
    const { currencies, getRate } = useCurrencies();

    const [activeRegister, setActiveRegister] = useState<RegisterType>('PHYSICAL');
    const [transactions, setTransactions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [auditData, setAuditData] = useState<AuditData | null>(null);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [txType, setTxType] = useState<'EXPENSE' | 'DEPOSIT'>('EXPENSE');
    const [currencyVal, setCurrencyVal] = useState<CurrencyValue>({ currency: 'USD', amountLocal: 0, amountUSD: 0, exchangeRate: 1 });
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Inventory State
    const [linkInventory, setLinkInventory] = useState(false);
    const [supplyItems, setSupplyItems] = useState<any[]>([]);
    const [selectedSupplyItem, setSelectedSupplyItem] = useState('');
    const [purchaseQuantity, setPurchaseQuantity] = useState('');
    const [purchaseUnitCost, setPurchaseUnitCost] = useState('');

    const currentSessionId = activeRegister === 'PHYSICAL' ? session?.id : electronicSession?.id;

    useEffect(() => {
        if (currentSessionId) {
            fetchTransactions();
            fetchAudit();
        }
        fetchSupplyItems();
    }, [activeRegister, currentSessionId]);

    // When switching registers, reset currency default
    useEffect(() => {
        if (activeRegister === 'ELECTRONIC') {
            setCurrencyVal({ currency: 'VES', amountLocal: 0, amountUSD: 0, exchangeRate: getRate('VES') });
        } else {
            setCurrencyVal({ currency: 'USD', amountLocal: 0, amountUSD: 0, exchangeRate: 1 });
        }
    }, [activeRegister]);

    const fetchTransactions = async () => {
        if (!currentSessionId) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/register/transactions/${currentSessionId}`, { headers: TENANT_HEADER });
            const data = await res.json();
            setTransactions(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAudit = async () => {
        if (!currentSessionId) return;
        try {
            const res = await fetch(`${API_URL}/register/audit/${currentSessionId}`, { headers: TENANT_HEADER });
            const data = await res.json();
            setAuditData(data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchSupplyItems = async () => {
        try {
            const res = await fetch(`${API_URL}/products/supply-items`, { headers: TENANT_HEADER });
            const data = await res.json();
            setSupplyItems(data);
        } catch (e) {
            console.error("Failed to load supply items", e);
        }
    };

    // Auto-calc amount from inventory fields
    useEffect(() => {
        if (linkInventory && purchaseQuantity && purchaseUnitCost) {
            const total = parseFloat(purchaseQuantity) * parseFloat(purchaseUnitCost);
            setCurrencyVal(prev => ({ ...prev, amountLocal: total, amountUSD: total }));
        }
    }, [purchaseQuantity, purchaseUnitCost, linkInventory]);

    const handleTransaction = async () => {
        if (!currencyVal.amountUSD || !description || !currentSessionId) return;
        setIsSubmitting(true);

        const finalAmount = txType === 'EXPENSE'
            ? -Math.abs(currencyVal.amountUSD)
            : Math.abs(currencyVal.amountUSD);

        try {
            await fetch(`${API_URL}/register/transaction`, {
                method: 'POST',
                headers: TENANT_HEADER,
                body: JSON.stringify({
                    sessionId: currentSessionId,
                    amount: finalAmount,
                    type: txType,
                    description,
                    currency: currencyVal.currency,
                    amountLocal: txType === 'EXPENSE'
                        ? -Math.abs(currencyVal.amountLocal)
                        : Math.abs(currencyVal.amountLocal),
                    exchangeRate: currencyVal.exchangeRate,
                    supplyItemId: (linkInventory && txType === 'EXPENSE') ? selectedSupplyItem : undefined,
                    quantity: (linkInventory && txType === 'EXPENSE') ? parseFloat(purchaseQuantity) : undefined,
                    unitCost: (linkInventory && txType === 'EXPENSE') ? parseFloat(purchaseUnitCost) : undefined
                })
            });
            setShowModal(false);
            setCurrencyVal({ currency: activeRegister === 'ELECTRONIC' ? 'VES' : 'USD', amountLocal: 0, amountUSD: 0, exchangeRate: 1 });
            setDescription('');
            setLinkInventory(false);
            setPurchaseQuantity('');
            setSelectedSupplyItem('');
            fetchTransactions();
            fetchAudit();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatUSD = (n: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

    const getTypeStyle = (type: string, amount: number) => {
        if (type === 'SALE') return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Venta', icon: <Receipt className="w-5 h-5" /> };
        if (type === 'PURCHASE') return { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Compra', icon: <ShoppingCart className="w-5 h-5" /> };
        if (type === 'EXPENSE') return { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Gasto', icon: <ArrowUpRight className="w-5 h-5" /> };
        if (type === 'DEPOSIT') return { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Ingreso', icon: <ArrowDownLeft className="w-5 h-5" /> };
        return { bg: amount < 0 ? 'bg-red-500/10' : 'bg-emerald-500/10', text: amount < 0 ? 'text-red-400' : 'text-emerald-400', label: type, icon: amount < 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" /> };
    };

    const allowedCurrencies = activeRegister === 'ELECTRONIC' ? ['VES'] : ['USD', 'COP'];
    const defaultCurrency = activeRegister === 'ELECTRONIC' ? 'VES' : 'USD';

    return (
        <div className="min-h-screen bg-enigma-black p-4 pb-24 text-white">
            <header className="flex items-center gap-4 mb-5">
                <Link to="/" className="p-2 bg-white/5 rounded-lg active:scale-95 transition-transform">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-xl font-bold">Movimientos de Caja</h1>
                </div>
            </header>

            {/* Toggle Fisica / Electronica */}
            <div className="flex gap-2 mb-5 p-1 bg-white/5 rounded-xl">
                <button
                    onClick={() => setActiveRegister('PHYSICAL')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all
                        ${activeRegister === 'PHYSICAL'
                            ? 'bg-amber-500/20 text-amber-300 shadow'
                            : 'text-white/40 hover:text-white/60'
                        }`}
                >
                    <Wallet className="w-4 h-4" />
                    <span>Caja Fisica</span>
                    {session && (
                        <span className="text-xs font-mono opacity-70">{formatUSD(0)}</span>
                    )}
                </button>
                <button
                    onClick={() => setActiveRegister('ELECTRONIC')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all
                        ${activeRegister === 'ELECTRONIC'
                            ? 'bg-blue-500/20 text-blue-300 shadow'
                            : 'text-white/40 hover:text-white/60'
                        }`}
                >
                    <Smartphone className="w-4 h-4" />
                    <span>Caja Electronica</span>
                </button>
            </div>

            {/* Running Balance Card */}
            {auditData && (
                <div className={`mb-5 rounded-2xl p-4 border ${activeRegister === 'PHYSICAL'
                    ? 'bg-gradient-to-br from-amber-500/10 to-enigma-gray border-amber-500/20'
                    : 'bg-gradient-to-br from-blue-500/10 to-enigma-gray border-blue-500/20'
                    }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {activeRegister === 'PHYSICAL'
                                ? <Wallet className="w-4 h-4 text-amber-400" />
                                : <Smartphone className="w-4 h-4 text-blue-400" />
                            }
                            <span className="text-xs text-white/50 uppercase tracking-wider">
                                Saldo {activeRegister === 'PHYSICAL' ? 'Fisica' : 'Electronica'}
                            </span>
                        </div>
                        <span className="text-2xl font-bold font-mono text-white">
                            {formatUSD(auditData.expectedCash)}
                        </span>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs">
                        <span className="text-white/40">
                            Fondo: <span className="font-mono text-white/60">{formatUSD(auditData.startingCash)}</span>
                        </span>
                        {auditData.breakdown && (
                            <>
                                <span className="text-emerald-400/70">
                                    +{formatUSD(auditData.breakdown.sales)}
                                </span>
                                <span className="text-red-400/70">
                                    {formatUSD(auditData.breakdown.expenses + auditData.breakdown.purchases)}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 mb-5">
                <button
                    onClick={() => { setTxType('EXPENSE'); setShowModal(true); }}
                    className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex flex-col items-center gap-2 hover:bg-red-500/20 transition-colors"
                >
                    <div className="p-2 rounded-full bg-red-500/20 text-red-400">
                        <ArrowUpRight className="w-6 h-6" />
                    </div>
                    <span className="font-medium text-red-200">Registrar Gasto</span>
                    <span className="text-xs text-white/30">Salida de caja</span>
                </button>

                <button
                    onClick={() => { setTxType('DEPOSIT'); setShowModal(true); }}
                    className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center gap-2 hover:bg-emerald-500/20 transition-colors"
                >
                    <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-400">
                        <ArrowDownLeft className="w-6 h-6" />
                    </div>
                    <span className="font-medium text-emerald-200">Ingreso</span>
                    <span className="text-xs text-white/30">Entrada de caja</span>
                </button>
            </div>

            {/* Transaction List */}
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
                                        <div className="flex items-center gap-2">
                                            <p className={`text-xs ${style.text} capitalize`}>{style.label}</p>
                                            {tx.currency && tx.currency !== 'USD' && (
                                                <span className="text-[10px] bg-white/10 px-1.5 rounded text-white/50 font-mono">{tx.currency}</span>
                                            )}
                                            {tx.supplyItemId && <span className="text-[10px] bg-white/10 px-1.5 rounded text-white/50">STOCK</span>}
                                        </div>
                                        {tx.amountLocal && tx.currency !== 'USD' && (
                                            <p className="text-xs text-white/30 font-mono">
                                                {tx.currency === 'VES' ? 'Bs.' : '$'}{Math.abs(tx.amountLocal).toFixed(2)} {tx.currency}
                                            </p>
                                        )}
                                        <p className="text-xs text-white/30 font-mono mt-0.5">
                                            {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                <span className={`font-mono font-bold text-lg ${tx.amount < 0 ? 'text-white' : 'text-emerald-400'}`}>
                                    {tx.amount > 0 ? '+' : ''}{formatUSD(tx.amount)}
                                </span>
                            </div>
                        );
                    })
                )}

                {transactions.length === 0 && !isLoading && (
                    <div className="text-center py-12 text-white/30 space-y-2">
                        <Wallet className="w-12 h-12 mx-auto opacity-30" />
                        <p>No hay movimientos en esta caja.</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-enigma-gray rounded-3xl p-6 space-y-4 border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-lg">
                                    {txType === 'EXPENSE' ? '📤 Salida' : '📥 Entrada'}
                                </h3>
                                <p className="text-xs text-white/30">
                                    {activeRegister === 'PHYSICAL' ? 'Caja Fisica (USD / COP)' : 'Caja Electronica (Bs.)'}
                                </p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {auditData && (
                            <div className="text-xs text-white/40 bg-white/5 rounded-lg p-2 flex justify-between">
                                <span>Saldo actual:</span>
                                <span className="font-mono text-white/60">{formatUSD(auditData.expectedCash)}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Inventory Toggle (expense only) */}
                            {txType === 'EXPENSE' && (
                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                                    <div className="flex items-center gap-2">
                                        <ShoppingCart className="w-4 h-4 text-amber-400" />
                                        <span className="text-sm font-medium">Compra de Insumo?</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={linkInventory} onChange={e => setLinkInventory(e.target.checked)} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                    </label>
                                </div>
                            )}

                            {linkInventory && txType === 'EXPENSE' ? (
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-white/50 block mb-1">Insumo</label>
                                        <select
                                            value={selectedSupplyItem}
                                            onChange={e => setSelectedSupplyItem(e.target.value)}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm"
                                        >
                                            <option value="">Seleccionar...</option>
                                            {supplyItems.map(item => (
                                                <option key={item.id} value={item.id}>
                                                    {item.name} ({item.currentCost ? `$${item.currentCost}` : 'N/A'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-white/50 block mb-1">Cantidad</label>
                                            <input type="number" value={purchaseQuantity} onChange={e => setPurchaseQuantity(e.target.value)}
                                                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm" placeholder="0.0" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-white/50 block mb-1">Costo Unitario (USD)</label>
                                            <input type="number" value={purchaseUnitCost} onChange={e => setPurchaseUnitCost(e.target.value)}
                                                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm" placeholder="0.00" />
                                        </div>
                                    </div>
                                    {currencyVal.amountUSD > 0 && (
                                        <div className="text-center p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                            <span className="text-xs text-amber-400">Total: </span>
                                            <span className="font-mono font-bold text-amber-300">{formatUSD(currencyVal.amountUSD)}</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <CurrencyInput
                                    currencies={currencies}
                                    allowedCodes={allowedCurrencies}
                                    defaultCurrency={defaultCurrency}
                                    label="Monto"
                                    onChange={setCurrencyVal}
                                />
                            )}

                            <div>
                                <label className="text-xs text-white/50 block mb-1">Descripcion / Motivo</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 h-20 resize-none"
                                    placeholder={txType === 'EXPENSE' ? "Ej: Hielo, Taxi..." : "Ej: Fondo adicional..."}
                                />
                            </div>

                            <button
                                onClick={handleTransaction}
                                disabled={!currencyVal.amountUSD || !description || isSubmitting || (linkInventory && (!selectedSupplyItem || !purchaseQuantity))}
                                className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2
                                    ${txType === 'EXPENSE' ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}
                                    disabled:opacity-50 transition-all`}
                            >
                                {isSubmitting
                                    ? <Loader2 className="animate-spin w-5 h-5" />
                                    : <CheckIcon />
                                }
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
    return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>;
}
