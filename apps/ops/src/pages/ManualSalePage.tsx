
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Check, Search, Trash2, ShoppingCart, GripHorizontal, List } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

interface Product {
    id: string;
    name: string;
    price: number;
    category?: string;
}

interface CartItem {
    product: Product;
    quantity: number;
}

export default function ManualSalePage() {
    const { session } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    // POS State
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showPayment, setShowPayment] = useState(false);
    const [method, setMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            const res = await fetch(`${API_URL}/products?limit=100`, {
                headers: { 'x-tenant-id': 'enigma_hq' }
            });
            const data = await res.json();
            setProducts(data.products || data || []); // Handle different API response structures
        } catch (e) {
            console.error(e);
        }
    };

    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { product, quantity: 1 }];
        });
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(item => item.product.id !== productId));
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.product.id === productId) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const total = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setIsLoading(true);

        try {
            const payload = {
                sessionId: session?.id,
                items: cart.map(item => ({
                    productId: item.product.id,
                    quantity: item.quantity,
                    price: item.product.price
                })),
                paymentMethod: method,
                notes: notes
            };

            const res = await fetch(`${API_URL}/sales`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': 'enigma_hq'
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => navigate('/'), 1500);
            } else {
                alert("Error registering sale");
            }
        } catch (e) {
            console.error(e);
            alert("Error connecting to server");
        } finally {
            setIsLoading(false);
        }
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Success View
    if (success) {
        return (
            <div className="min-h-screen bg-enigma-black flex flex-col items-center justify-center p-4 text-white animate-fade-in">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                    <Check className="w-10 h-10 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2">¡Venta Exitosa!</h2>
                <p className="text-emerald-400 font-mono text-xl mb-4">${total.toFixed(2)}</p>
                <p className="text-white/40 text-sm">Inventario actualizado.</p>
            </div>
        );
    }

    return (
        <div className="h-screen bg-enigma-black text-white flex overflow-hidden">
            {/* LEFT: Product Catalog */}
            <div className={`flex-1 flex flex-col ${showPayment ? 'opacity-50 pointer-events-none' : ''}`}>
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <Link to="/" className="p-2 bg-white/5 rounded-lg hover:bg-white/10">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex-1 mx-4 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                            type="text"
                            placeholder="Buscar productos..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-enigma-gray pl-10 pr-4 py-2 rounded-xl border border-white/10 text-sm focus:outline-none focus:border-enigma-purple text-white"
                        />
                    </div>
                    <button
                        onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                        className="p-2 bg-white/5 rounded-lg text-white/50 hover:text-white"
                    >
                        {viewMode === 'grid' ? <List className="w-5 h-5" /> : <GripHorizontal className="w-5 h-5" />}
                    </button>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className={viewMode === 'grid' ? "grid grid-cols-3 gap-3" : "space-y-2"}>
                        {filteredProducts.map(product => (
                            <button
                                key={product.id}
                                onClick={() => addToCart(product)}
                                className={`
                                    bg-enigma-gray/50 border border-white/5 hover:border-enigma-purple/50 hover:bg-enigma-gray 
                                    transition-all active:scale-[0.98] text-left w-full
                                    ${viewMode === 'grid' ? 'p-4 rounded-xl flex flex-col justify-between h-32' : 'p-3 rounded-lg flex items-center justify-between'}
                                `}
                            >
                                <div>
                                    <p className="font-bold text-sm leading-tight mb-1 truncate">{product.name}</p>
                                    <p className="text-[10px] text-white/40 uppercase tracking-wider">{product.category || 'General'}</p>
                                </div>
                                <p className="font-mono text-enigma-green text-sm">${product.price.toFixed(2)}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* RIGHT: Cart & Checkout */}
            <div className="w-[400px] bg-enigma-gray border-l border-white/5 flex flex-col shadow-2xl z-50">
                <div className="p-4 border-b border-white/5">
                    <h2 className="font-bold flex items-center gap-2 text-white">
                        <ShoppingCart className="w-5 h-5 text-enigma-purple" />
                        Orden Actual
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-white/20">
                            <ShoppingCart className="w-12 h-12 mb-2" />
                            <p className="text-sm">Carrito vacío</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.product.id} className="bg-black/20 p-3 rounded-xl flex items-center justify-between animate-fade-in">
                                <div className="flex-1">
                                    <p className="font-medium text-sm text-white">{item.product.name}</p>
                                    <p className="text-xs text-white/50">${item.product.price.toFixed(2)} c/u</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => updateQuantity(item.product.id, -1)}
                                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center font-bold text-white"
                                    >-</button>
                                    <span className="font-mono w-4 text-center text-white">{item.quantity}</span>
                                    <button
                                        onClick={() => updateQuantity(item.product.id, 1)}
                                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center font-bold text-white"
                                    >+</button>
                                </div>
                                <div className="ml-4 text-right">
                                    <p className="font-mono text-sm text-white">${(item.product.price * item.quantity).toFixed(2)}</p>
                                    <button onClick={() => removeFromCart(item.product.id)} className="text-white/20 hover:text-red-400 mt-1">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer / Payment */}
                <div className="p-4 bg-black/20 border-t border-white/5 space-y-4">
                    <div className="flex justify-between items-end">
                        <span className="text-white/50 text-sm">Total a Pagar</span>
                        <span className="text-3xl font-bold font-mono text-enigma-green">${total.toFixed(2)}</span>
                    </div>

                    {showPayment ? (
                        <div className="space-y-3 animate-slide-up">
                            <div className="grid grid-cols-3 gap-2">
                                {['cash', 'card', 'transfer'].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setMethod(m as any)}
                                        className={`p-2 rounded-lg text-xs font-bold uppercase transition-all ${method === m ? 'bg-enigma-purple text-white' : 'bg-white/5 text-white/50'}`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>

                            {/* Notes Field to use setNotes */}
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Notas de venta (opcional)..."
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-enigma-purple resize-none h-16"
                            />

                            <button
                                onClick={handleCheckout}
                                disabled={isLoading}
                                className="w-full py-4 bg-enigma-green rounded-xl font-bold text-lg text-white hover:bg-enigma-green/80 flex items-center justify-center gap-2 transition-all"
                            >
                                {isLoading ? <Loader2 className="animate-spin" /> : 'Confirmar Cobro'}
                            </button>
                            <button onClick={() => setShowPayment(false)} className="w-full text-xs text-white/40 hover:text-white py-2">Cancelar</button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowPayment(true)}
                            disabled={cart.length === 0}
                            className="w-full py-4 bg-enigma-purple rounded-xl font-bold text-lg text-white hover:bg-enigma-purple/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            Pagar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
