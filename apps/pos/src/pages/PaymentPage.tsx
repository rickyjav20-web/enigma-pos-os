import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, DollarSign, Smartphone, Building2, Wallet, CreditCard, Banknote } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

type PayMethod = 'cash' | 'bolivares' | 'zelle' | 'binance' | 'bancolombia' | 'card';

const METHODS: { id: PayMethod; label: string; icon: typeof DollarSign; color: string }[] = [
    { id: 'cash', label: 'Efectivo', icon: Banknote, color: 'text-wave-green bg-wave-green/15' },
    { id: 'bolivares', label: 'Bolívares', icon: Wallet, color: 'text-wave-blue bg-wave-blue/15' },
    { id: 'zelle', label: 'Zelle', icon: Smartphone, color: 'text-violet-400 bg-violet-400/15' },
    { id: 'binance', label: 'Binance', icon: DollarSign, color: 'text-yellow-400 bg-yellow-400/15' },
    { id: 'bancolombia', label: 'Bancolombia', icon: Building2, color: 'text-sky-400 bg-sky-400/15' },
    { id: 'card', label: 'Tarjeta', icon: CreditCard, color: 'text-wave-purple bg-wave-purple/15' },
];

export default function PaymentPage() {
    const navigate = useNavigate();
    const { items, total, clearCart, orderType } = useCartStore();
    const { employee } = useAuth();
    const [method, setMethod] = useState<PayMethod>('cash');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const cartTotal = total();

    const handlePay = async () => {
        if (items.length === 0 || loading) return;
        setLoading(true);

        try {
            // Map payment method to API format
            const apiMethod = method === 'bolivares' || method === 'zelle' || method === 'binance' || method === 'bancolombia'
                ? 'transfer'
                : method === 'card'
                    ? 'card'
                    : 'cash';

            const payload = {
                items: items.map(i => ({
                    productId: i.productId,
                    quantity: i.quantity,
                    price: i.price,
                })),
                paymentMethod: apiMethod,
                notes: `POS Mobile | ${method} | ${orderType} | Staff: ${employee?.fullName || 'unknown'}`,
                // We need a sessionId — for now use a placeholder
                // In production this will come from the register session
                sessionId: localStorage.getItem('wave_pos_session') || 'pos-mobile',
            };

            await api.post('/sales', payload);
            setSuccess(true);

            // Wait 1.5s then redirect
            setTimeout(() => {
                clearCart();
                navigate('/');
            }, 1500);
        } catch (err) {
            console.error('[POS] Payment error:', err);
            alert('Error procesando el pago. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    // Success state
    if (success) {
        return (
            <div className="min-h-dvh bg-wave-dark flex flex-col items-center justify-center p-6 animate-fade-in">
                <div className="w-20 h-20 rounded-full bg-wave-green/20 flex items-center justify-center mb-5 animate-scale-in">
                    <Check className="w-10 h-10 text-wave-green" strokeWidth={3} />
                </div>
                <h2 className="text-2xl font-bold mb-2">¡Listo!</h2>
                <p className="text-wave-green font-mono text-3xl font-bold mb-2">${cartTotal.toFixed(2)}</p>
                <p className="text-wave-text-muted text-sm">Venta registrada exitosamente</p>
            </div>
        );
    }

    return (
        <div className="min-h-dvh bg-wave-dark flex flex-col safe-top safe-bottom">

            {/* Header */}
            <header className="px-4 pt-3 pb-2 flex items-center gap-3">
                <button onClick={() => navigate('/order/new')} className="w-10 h-10 rounded-xl bg-wave-gray border border-wave-border flex items-center justify-center press">
                    <ArrowLeft className="w-5 h-5 text-wave-text-secondary" />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-bold">Cobrar</h1>
                </div>
            </header>

            <main className="flex-1 px-5 space-y-6 overflow-y-auto pb-4">

                {/* Total Display */}
                <div className="text-center py-4 animate-slide-up">
                    <p className="text-wave-text-muted text-sm mb-1">Total a cobrar</p>
                    <p className="text-5xl font-bold font-mono tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                        ${cartTotal.toFixed(2)}
                    </p>
                    <p className="text-wave-text-muted text-xs mt-1">
                        {items.reduce((s, i) => s + i.quantity, 0)} items · {orderType === 'dine_in' ? 'Comer Aquí' : 'Para Llevar'}
                    </p>
                </div>

                {/* Payment Methods */}
                <div className="space-y-2 animate-slide-up" style={{ animationDelay: '0.05s' }}>
                    <p className="text-xs text-wave-text-muted uppercase tracking-widest font-semibold px-1">Método de Pago</p>
                    <div className="grid grid-cols-2 gap-2.5">
                        {METHODS.map(m => {
                            const Icon = m.icon;
                            const active = method === m.id;
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => setMethod(m.id)}
                                    className={`p-4 rounded-2xl flex items-center gap-3 transition-all press border ${active
                                        ? 'bg-wave-purple/10 border-wave-purple/40 shadow-[0_0_16px_rgba(124,58,237,0.15)]'
                                        : 'bg-wave-gray/60 border-wave-border'
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.color}`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <span className={`text-sm font-semibold ${active ? 'text-white' : 'text-wave-text-secondary'}`}>
                                        {m.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Order Summary */}
                <div className="space-y-2 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    <p className="text-xs text-wave-text-muted uppercase tracking-widest font-semibold px-1">Resumen</p>
                    <div className="glass rounded-2xl p-3 space-y-1.5">
                        {items.map(item => (
                            <div key={item.productId} className="flex items-center justify-between text-sm py-1">
                                <span className="text-wave-text-secondary truncate flex-1">{item.name} × {item.quantity}</span>
                                <span className="font-mono text-white ml-2">${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </div>

            </main>

            {/* Pay Button */}
            <div className="p-5 border-t border-wave-border safe-bottom">
                <button
                    onClick={handlePay}
                    disabled={loading || items.length === 0}
                    className="w-full py-4 rounded-2xl bg-wave-green font-bold text-lg press shadow-[0_8px_24px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>Confirmar ${cartTotal.toFixed(2)}</>
                    )}
                </button>
            </div>
        </div>
    );
}
