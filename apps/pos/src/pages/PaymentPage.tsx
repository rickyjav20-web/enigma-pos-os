import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, DollarSign, Smartphone, Building2, Wallet, CreditCard, Banknote, MapPin } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

type PayMethod = 'cash' | 'bolivares' | 'zelle' | 'binance' | 'bancolombia' | 'card';

const METHODS: { id: PayMethod; label: string; icon: typeof DollarSign }[] = [
    { id: 'cash', label: 'Efectivo', icon: Banknote },
    { id: 'bolivares', label: 'Bolívares', icon: Wallet },
    { id: 'zelle', label: 'Zelle', icon: Smartphone },
    { id: 'binance', label: 'Binance', icon: DollarSign },
    { id: 'bancolombia', label: 'Bancolombia', icon: Building2 },
    { id: 'card', label: 'Tarjeta', icon: CreditCard },
];

export default function PaymentPage() {
    const navigate = useNavigate();
    const { items, total, clearCart, orderType, ticketName, tableName } = useCartStore();
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
                ? 'transfer' : method === 'card' ? 'card' : 'cash';

            const payload = {
                items: items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
                paymentMethod: apiMethod,
                notes: `POS | ${method} | ${orderType} | ${ticketName}${tableName ? ` | ${tableName}` : ''} | ${employee?.fullName || ''}`,
                sessionId: localStorage.getItem('wave_pos_session') || 'pos-mobile',
            };

            await api.post('/sales', payload);
            setSuccess(true);
            setTimeout(() => { clearCart(); navigate('/'); }, 1500);
        } catch (err) {
            console.error('[POS] Payment error:', err);
            alert('Error procesando el pago. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-dvh flex flex-col items-center justify-center p-6 animate-fade-in" style={{ background: '#121413' }}>
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5 animate-scale-in"
                    style={{ background: 'rgba(28,64,46,0.3)' }}>
                    <Check className="w-10 h-10" style={{ color: '#93B59D' }} strokeWidth={3} />
                </div>
                <h2 className="text-2xl font-bold mb-2" style={{ color: '#F4F0EA' }}>¡Listo!</h2>
                <p className="font-mono text-3xl font-bold mb-2" style={{ color: '#93B59D' }}>${cartTotal.toFixed(2)}</p>
                <p className="text-sm" style={{ color: 'rgba(244,240,234,0.3)' }}>Venta registrada</p>
            </div>
        );
    }

    return (
        <div className="min-h-dvh flex flex-col safe-top safe-bottom" style={{ background: '#121413' }}>
            <header className="px-4 pt-3 pb-2 flex items-center gap-3">
                <button onClick={() => navigate('/')}
                    className="w-9 h-9 rounded-lg flex items-center justify-center press"
                    style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}>
                    <ArrowLeft className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.5)' }} />
                </button>
                <div className="flex-1">
                    <h1 className="text-[15px] font-semibold" style={{ color: '#F4F0EA' }}>Cobrar</h1>
                    <div className="flex items-center gap-1.5">
                        <p className="text-[11px]" style={{ color: 'rgba(244,240,234,0.3)' }}>{ticketName}</p>
                        {tableName && (
                            <>
                                <span className="text-[10px]" style={{ color: 'rgba(244,240,234,0.1)' }}>·</span>
                                <MapPin className="w-3 h-3" style={{ color: '#93B59D', verticalAlign: '-1px' }} />
                                <span className="text-[11px]" style={{ color: '#93B59D' }}>{tableName}</span>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1 px-4 space-y-5 overflow-y-auto pb-28">
                {/* Total */}
                <div className="text-center py-5 animate-slide-up">
                    <p className="text-xs uppercase tracking-widest mb-2" style={{ color: 'rgba(244,240,234,0.25)' }}>Total a cobrar</p>
                    <p className="text-5xl font-bold font-mono tabular-nums tracking-tight" style={{ color: '#F4F0EA' }}>
                        ${cartTotal.toFixed(2)}
                    </p>
                    <p className="text-xs mt-2" style={{ color: 'rgba(244,240,234,0.2)' }}>
                        {items.reduce((s, i) => s + i.quantity, 0)} items · {orderType === 'dine_in' ? 'Comer Aquí' : 'Para Llevar'}
                    </p>
                </div>

                {/* Methods */}
                <div className="space-y-2 animate-slide-up" style={{ animationDelay: '0.05s' }}>
                    <p className="text-[10px] uppercase tracking-widest font-semibold px-1" style={{ color: 'rgba(244,240,234,0.2)' }}>Método de Pago</p>
                    <div className="grid grid-cols-2 gap-2">
                        {METHODS.map(m => {
                            const Icon = m.icon;
                            const active = method === m.id;
                            return (
                                <button key={m.id} onClick={() => setMethod(m.id)}
                                    className="p-3.5 rounded-xl flex items-center gap-3 transition-all press"
                                    style={{
                                        background: active ? 'rgba(28,64,46,0.15)' : 'rgba(244,240,234,0.03)',
                                        border: `1px solid ${active ? 'rgba(147,181,157,0.2)' : 'rgba(244,240,234,0.06)'}`,
                                    }}>
                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                                        style={{ background: active ? 'rgba(28,64,46,0.3)' : 'rgba(244,240,234,0.04)' }}>
                                        <Icon className="w-4 h-4" style={{ color: active ? '#93B59D' : 'rgba(244,240,234,0.4)' }} />
                                    </div>
                                    <span className="text-[13px] font-medium" style={{ color: active ? '#93B59D' : 'rgba(244,240,234,0.4)' }}>
                                        {m.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Summary */}
                <div className="space-y-2 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    <p className="text-[10px] uppercase tracking-widest font-semibold px-1" style={{ color: 'rgba(244,240,234,0.2)' }}>Resumen</p>
                    <div className="rounded-xl p-3 space-y-1"
                        style={{ background: 'rgba(244,240,234,0.03)', border: '1px solid rgba(244,240,234,0.06)' }}>
                        {items.map(item => (
                            <div key={item.productId} className="flex items-center justify-between text-[13px] py-1">
                                <span className="truncate flex-1" style={{ color: 'rgba(244,240,234,0.45)' }}>{item.name} × {item.quantity}</span>
                                <span className="font-mono ml-2 tabular-nums" style={{ color: 'rgba(244,240,234,0.6)' }}>${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* Pay */}
            <div className="fixed bottom-0 left-0 right-0 z-30 p-4 safe-bottom">
                <button onClick={handlePay} disabled={loading || items.length === 0}
                    className="w-full py-4 rounded-2xl font-bold text-lg press flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                    style={{ background: 'linear-gradient(135deg, #1C402E, #255639)', color: '#F4F0EA', boxShadow: '0 8px 32px rgba(28,64,46,0.4)' }}>
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Confirmar ${cartTotal.toFixed(2)}</>}
                </button>
            </div>
        </div>
    );
}
