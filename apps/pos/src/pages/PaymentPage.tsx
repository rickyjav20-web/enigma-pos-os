import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, DollarSign, Smartphone, Building2, Wallet, CreditCard, Banknote } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

type PayMethod = 'cash' | 'bolivares' | 'zelle' | 'binance' | 'bancolombia' | 'card';

const METHODS: { id: PayMethod; label: string; icon: typeof DollarSign; gradient: string }[] = [
    { id: 'cash', label: 'Efectivo', icon: Banknote, gradient: 'from-emerald-500/15 to-emerald-500/5' },
    { id: 'bolivares', label: 'Bolívares', icon: Wallet, gradient: 'from-blue-500/15 to-blue-500/5' },
    { id: 'zelle', label: 'Zelle', icon: Smartphone, gradient: 'from-violet-500/15 to-violet-500/5' },
    { id: 'binance', label: 'Binance', icon: DollarSign, gradient: 'from-yellow-500/15 to-yellow-500/5' },
    { id: 'bancolombia', label: 'Bancolombia', icon: Building2, gradient: 'from-sky-500/15 to-sky-500/5' },
    { id: 'card', label: 'Tarjeta', icon: CreditCard, gradient: 'from-purple-500/15 to-purple-500/5' },
];

export default function PaymentPage() {
    const navigate = useNavigate();
    const { items, total, clearCart, orderType, ticketName } = useCartStore();
    const { employee } = useAuth();
    const [method, setMethod] = useState<PayMethod>('cash');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const cartTotal = total();

    const handlePay = async () => {
        if (items.length === 0 || loading) return;
        setLoading(true);

        try {
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
                notes: `POS Mobile | ${method} | ${orderType} | ${ticketName} | Staff: ${employee?.fullName || 'unknown'}`,
                sessionId: localStorage.getItem('wave_pos_session') || 'pos-mobile',
            };

            await api.post('/sales', payload);
            setSuccess(true);

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
            <div className="min-h-dvh flex flex-col items-center justify-center p-6 animate-fade-in" style={{ background: '#0f0f14' }}>
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5 animate-scale-in"
                    style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))' }}>
                    <Check className="w-10 h-10 text-emerald-400" strokeWidth={3} />
                </div>
                <h2 className="text-2xl font-bold mb-2">¡Listo!</h2>
                <p className="text-emerald-400 font-mono text-3xl font-bold mb-2">${cartTotal.toFixed(2)}</p>
                <p className="text-white/30 text-sm">Venta registrada</p>
            </div>
        );
    }

    return (
        <div className="min-h-dvh flex flex-col safe-top safe-bottom" style={{ background: '#0f0f14' }}>

            {/* Header */}
            <header className="px-4 pt-3 pb-2 flex items-center gap-3">
                <button onClick={() => navigate('/')} className="w-9 h-9 rounded-xl glass flex items-center justify-center press">
                    <ArrowLeft className="w-4 h-4 text-white/60" />
                </button>
                <div className="flex-1">
                    <h1 className="text-[15px] font-semibold">Cobrar</h1>
                    <p className="text-[11px] text-white/30">{ticketName}</p>
                </div>
            </header>

            <main className="flex-1 px-4 space-y-5 overflow-y-auto pb-28">

                {/* Total Display */}
                <div className="text-center py-5 animate-slide-up">
                    <p className="text-white/30 text-xs uppercase tracking-widest mb-2">Total a cobrar</p>
                    <p className="text-5xl font-bold font-mono tabular-nums tracking-tight"
                        style={{ background: 'linear-gradient(135deg, #fff, rgba(255,255,255,0.6))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        ${cartTotal.toFixed(2)}
                    </p>
                    <p className="text-white/20 text-xs mt-2">
                        {items.reduce((s, i) => s + i.quantity, 0)} items · {orderType === 'dine_in' ? 'Comer Aquí' : 'Para Llevar'}
                    </p>
                </div>

                {/* Payment Methods */}
                <div className="space-y-2 animate-slide-up" style={{ animationDelay: '0.05s' }}>
                    <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold px-1">Método de Pago</p>
                    <div className="grid grid-cols-2 gap-2">
                        {METHODS.map(m => {
                            const Icon = m.icon;
                            const active = method === m.id;
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => setMethod(m.id)}
                                    className={`p-3.5 rounded-xl flex items-center gap-3 transition-all press border ${active
                                        ? 'border-purple-500/30 shadow-[0_0_20px_rgba(124,58,237,0.1)]'
                                        : 'glass'
                                        }`}
                                    style={active ? { background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(124,58,237,0.03))' } : {}}
                                >
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br ${m.gradient}`}>
                                        <Icon className="w-4 h-4 text-white/70" />
                                    </div>
                                    <span className={`text-[13px] font-medium ${active ? 'text-white' : 'text-white/50'}`}>
                                        {m.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Order Summary */}
                <div className="space-y-2 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold px-1">Resumen</p>
                    <div className="glass rounded-xl p-3 space-y-1">
                        {items.map(item => (
                            <div key={item.productId} className="flex items-center justify-between text-[13px] py-1">
                                <span className="text-white/50 truncate flex-1">{item.name} × {item.quantity}</span>
                                <span className="font-mono text-white/70 ml-2 tabular-nums">${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* Pay Button — Fixed bottom */}
            <div className="fixed bottom-0 left-0 right-0 z-30 p-4 safe-bottom">
                <button
                    onClick={handlePay}
                    disabled={loading || items.length === 0}
                    className="w-full py-4 rounded-2xl font-bold text-lg press flex items-center justify-center gap-2 disabled:opacity-40 transition-all text-white"
                    style={{
                        background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                        boxShadow: '0 8px 32px rgba(124,58,237,0.3)',
                    }}
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
