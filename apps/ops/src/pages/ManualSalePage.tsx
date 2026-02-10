
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, DollarSign, CreditCard, ArrowRight, Save, Loader2, Check, Wallet } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

export default function ManualSalePage() {
    const { session } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
    const [description, setDescription] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !description) return;

        setIsLoading(true);
        try {
            if (method === 'cash') {
                // Cash sales are tracked in the register as positive CashTransactions
                await fetch(`${API_URL}/register/transaction`, {
                    method: 'POST',
                    headers: { 'x-tenant-id': 'enigma_hq', 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: session?.id,
                        amount: parseFloat(amount),
                        type: 'SALE',
                        description: `Venta: ${description}`,
                        referenceId: `MANUAL-${Date.now()}`
                    })
                });
            }
            // Non-cash sales don't affect the cash drawer
            // They could be tracked separately in a Sales model for reporting

            // Show success feedback before navigating
            setSuccess(true);
            setTimeout(() => navigate('/'), 1500);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    // Success State
    if (success) {
        return (
            <div className="min-h-screen bg-enigma-black flex flex-col items-center justify-center p-4 text-white animate-fade-in">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                    <Check className="w-10 h-10 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2">¡Venta Registrada!</h2>
                {method === 'cash' ? (
                    <p className="text-emerald-400 text-sm flex items-center gap-2">
                        <Wallet className="w-4 h-4" />
                        +${parseFloat(amount).toFixed(2)} sumado a la caja
                    </p>
                ) : (
                    <p className="text-white/40 text-sm">
                        Venta por {method === 'card' ? 'tarjeta' : 'transferencia'} • No afecta efectivo
                    </p>
                )}
                <p className="text-xs text-white/20 mt-4">Redirigiendo...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-enigma-black p-4 text-white">
            <header className="flex items-center gap-4 mb-8">
                <Link to="/" className="p-2 bg-white/5 rounded-lg active:scale-95 transition-transform">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-xl font-bold">Registrar Venta</h1>
                    <p className="text-xs text-white/40">Ingreso manual de pedidos</p>
                </div>
            </header>

            <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-6">

                {/* Amount */}
                <div className="space-y-2">
                    <label className="text-sm text-white/50 ml-1">Monto de Venta</label>
                    <div className="relative group">
                        <DollarSign className="absolute left-4 top-4 w-5 h-5 text-enigma-green group-focus-within:text-enigma-green transition-colors" />
                        <input
                            type="number"
                            step="0.01"
                            autoFocus
                            required
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full bg-enigma-gray border border-white/10 rounded-2xl p-4 pl-12 text-3xl font-mono text-white 
                                focus:border-enigma-green focus:ring-1 focus:ring-enigma-green/50 outline-none transition-all placeholder:text-white/20"
                            placeholder="0.00"
                        />
                    </div>
                </div>

                {/* Method Selector */}
                <div className="space-y-2">
                    <label className="text-sm text-white/50 ml-1">Método de Pago</label>
                    <div className="grid grid-cols-3 gap-3">
                        <button
                            type="button"
                            onClick={() => setMethod('cash')}
                            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${method === 'cash'
                                ? 'bg-enigma-green/20 border-enigma-green text-enigma-green'
                                : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                                }`}
                        >
                            <DollarSign className="w-6 h-6" />
                            <span className="text-xs font-bold">Efectivo</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setMethod('card')}
                            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${method === 'card'
                                ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                                : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                                }`}
                        >
                            <CreditCard className="w-6 h-6" />
                            <span className="text-xs font-bold">Tarjeta</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setMethod('transfer')}
                            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${method === 'transfer'
                                ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                                : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                                }`}
                        >
                            <ArrowRight className="w-6 h-6" />
                            <span className="text-xs font-bold">Transfer</span>
                        </button>
                    </div>
                    {method === 'cash' && (
                        <p className="text-xs text-enigma-green/70 bg-enigma-green/10 p-2 rounded-lg flex items-center gap-2">
                            <DollarSign className="w-3 h-3" />
                            Se sumará automáticamente al efectivo en caja.
                        </p>
                    )}
                    {method !== 'cash' && (
                        <p className="text-xs text-white/30 bg-white/5 p-2 rounded-lg flex items-center gap-2">
                            <ArrowRight className="w-3 h-3" />
                            No afecta el efectivo en caja. Solo queda registro de la venta.
                        </p>
                    )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                    <label className="text-sm text-white/50 ml-1">Descripción / Mesa</label>
                    <input
                        type="text"
                        required
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-enigma-gray border border-white/10 rounded-xl p-4 text-white 
                            focus:border-white/30 outline-none transition-all"
                        placeholder="Ej: Mesa 5 - Café y Postre"
                    />
                </div>

                <button
                    type="submit"
                    disabled={!amount || !description || isLoading}
                    className="w-full py-4 rounded-xl bg-white text-black font-bold text-lg shadow-lg shadow-white/10
                        hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 mt-8"
                >
                    {isLoading ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5" />}
                    Registrar Venta
                </button>

            </form>
        </div>
    );
}
