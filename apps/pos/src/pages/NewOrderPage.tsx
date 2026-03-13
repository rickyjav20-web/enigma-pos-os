import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, X, ShoppingBag, ChevronRight, Minus, Plus, Trash2, UserPlus, MessageSquare, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useCartStore } from '../stores/cartStore';

interface Product {
    id: string;
    name: string;
    price: number;
    categoryId?: string;
    isActive: boolean;
}

export default function NewOrderPage() {
    const navigate = useNavigate();
    const { items, addItem, removeItem, updateQuantity, updateItemNotes, total, itemCount, orderType, setOrderType, clearCart } = useCartStore();

    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [showCart, setShowCart] = useState(false);
    const [editingNotesFor, setEditingNotesFor] = useState<string | null>(null);
    const [draftItemNote, setDraftItemNote] = useState('');

    // Fetch products
    const { data: productsData, isLoading } = useQuery({
        queryKey: ['pos-products'],
        queryFn: async () => {
            const { data } = await api.get('/products');
            return (data?.data || []) as Product[];
        },
        staleTime: 60_000,
    });

    const products = productsData || [];

    // Extract unique categories
    const categories = useMemo(() => {
        const cats = new Set<string>();
        products.forEach(p => {
            if (p.categoryId) cats.add(p.categoryId);
        });
        return ['Todos', ...Array.from(cats).sort()];
    }, [products]);

    // Filter products
    const filtered = useMemo(() => {
        let list = products.filter(p => p.isActive);
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(p => p.name.toLowerCase().includes(q));
        }
        if (activeCategory && activeCategory !== 'Todos') {
            list = list.filter(p => p.categoryId === activeCategory);
        }
        return list;
    }, [products, search, activeCategory]);

    const cartTotal = total();
    const cartCount = itemCount();

    return (
        <div className="min-h-dvh bg-wave-dark flex flex-col safe-top safe-bottom relative">

            {/* ═══ Header ═══ */}
            <header className="px-4 pt-3 pb-2 flex items-center gap-3 z-20">
                <button onClick={() => { clearCart(); navigate('/'); }} className="w-10 h-10 rounded-xl bg-wave-gray border border-wave-border flex items-center justify-center press">
                    <ArrowLeft className="w-5 h-5 text-wave-text-secondary" />
                </button>

                {/* Search */}
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wave-text-muted" />
                    <input
                        type="text"
                        placeholder="Buscar producto..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-wave-gray border border-wave-border rounded-xl pl-9 pr-8 py-2.5 text-sm text-white placeholder-wave-text-muted focus:outline-none focus:border-wave-purple/50 transition-colors"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                            <X className="w-4 h-4 text-wave-text-muted" />
                        </button>
                    )}
                </div>

                {/* Customer button (placeholder) */}
                <button className="w-10 h-10 rounded-xl bg-wave-gray border border-wave-border flex items-center justify-center press">
                    <UserPlus className="w-4 h-4 text-wave-text-muted" />
                </button>
            </header>

            {/* ═══ Order Type Toggle ═══ */}
            <div className="px-4 pb-2 flex gap-2">
                {(['dine_in', 'takeaway'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setOrderType(t)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all press ${orderType === t
                            ? 'bg-wave-purple/20 text-wave-purple border border-wave-purple/30'
                            : 'bg-wave-gray text-wave-text-muted border border-wave-border'
                            }`}
                    >
                        {t === 'dine_in' ? '🍽  Comer Aquí' : '📦  Para Llevar'}
                    </button>
                ))}
            </div>

            {/* ═══ Category Tabs ═══ */}
            <div className="px-4 pb-2">
                <div className="flex gap-2 overflow-x-auto category-scroll py-1">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat === 'Todos' ? null : cat)}
                            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all press ${(cat === 'Todos' && !activeCategory) || activeCategory === cat
                                ? 'bg-wave-purple text-white shadow-[0_0_12px_rgba(124,58,237,0.3)]'
                                : 'bg-wave-gray text-wave-text-muted border border-wave-border'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* ═══ Product Grid ═══ */}
            <main className="flex-1 px-4 pb-24 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="w-8 h-8 border-2 border-wave-purple/30 border-t-wave-purple rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-wave-text-muted">
                        <Search className="w-10 h-10 mb-2 opacity-30" />
                        <p className="text-sm">No se encontraron productos</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2.5">
                        {filtered.map(product => {
                            const inCart = items.find(i => i.productId === product.id);
                            return (
                                <button
                                    key={product.id}
                                    onClick={() => addItem({ id: product.id, name: product.name, price: product.price, category: product.categoryId })}
                                    className={`relative p-3.5 rounded-2xl text-left transition-all press border ${inCart
                                        ? 'bg-wave-purple/10 border-wave-purple/30'
                                        : 'bg-wave-gray/60 border-wave-border hover:border-wave-purple/20'
                                        }`}
                                >
                                    <p className="text-sm font-semibold leading-tight line-clamp-2 mb-1">{product.name}</p>
                                    <p className="text-[11px] text-wave-text-muted uppercase tracking-wider mb-2">{product.categoryId || 'General'}</p>
                                    <p className="text-base font-bold font-mono text-wave-green">${product.price.toFixed(2)}</p>

                                    {/* In-cart badge */}
                                    {inCart && (
                                        <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-wave-purple flex items-center justify-center animate-badge-pop shadow-lg">
                                            <span className="text-[11px] font-bold">{inCart.quantity}</span>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* ═══ Cart FAB ═══ */}
            {cartCount > 0 && !showCart && (
                <div className="fixed bottom-4 left-4 right-4 z-30 animate-slide-up">
                    <button
                        onClick={() => setShowCart(true)}
                        className="w-full py-4 px-5 rounded-2xl bg-wave-purple flex items-center gap-3 press shadow-[0_8px_32px_rgba(124,58,237,0.4)]"
                    >
                        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                            <ShoppingBag className="w-4 h-4" />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-bold">{cartCount} {cartCount === 1 ? 'item' : 'items'}</p>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-lg font-bold font-mono">${cartTotal.toFixed(2)}</span>
                            <ChevronRight className="w-5 h-5 opacity-60" />
                        </div>
                    </button>
                </div>
            )}

            {/* ═══ Cart Sheet ═══ */}
            {showCart && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 bg-black/60 z-40 animate-fade-in" onClick={() => setShowCart(false)} />

                    {/* Cart Panel */}
                    <div className="fixed bottom-0 left-0 right-0 z-50 bg-wave-dark rounded-t-3xl border-t border-wave-border animate-slide-up-full max-h-[85dvh] flex flex-col">
                        {/* Handle */}
                        <div className="flex justify-center pt-3 pb-2">
                            <div className="w-10 h-1 rounded-full bg-white/10" />
                        </div>

                        <div className="px-5 pb-2 flex items-center justify-between">
                            <h2 className="text-lg font-bold">Tu Orden</h2>
                            <button onClick={() => setShowCart(false)} className="w-8 h-8 rounded-lg bg-wave-gray flex items-center justify-center">
                                <X className="w-4 h-4 text-wave-text-muted" />
                            </button>
                        </div>

                        {/* Items */}
                        <div className="flex-1 overflow-y-auto px-5 space-y-2 py-2">
                            {items.map(item => (
                                <div key={item.lineId} className="p-3 rounded-xl bg-wave-gray/60 border border-wave-border animate-fade-in">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate">{item.name}</p>
                                            <p className="text-xs text-wave-text-muted font-mono">${item.price.toFixed(2)} c/u</p>
                                            {item.notes && editingNotesFor !== item.lineId && (
                                                <p className="text-[11px] italic text-wave-green/70 mt-0.5 truncate">{item.notes}</p>
                                            )}
                                        </div>

                                        {/* Note button */}
                                        <button
                                            onClick={() => {
                                                if (editingNotesFor === item.lineId) {
                                                    setEditingNotesFor(null);
                                                } else {
                                                    setEditingNotesFor(item.lineId);
                                                    setDraftItemNote(item.notes || '');
                                                }
                                            }}
                                            className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center press"
                                        >
                                            <MessageSquare className="w-3.5 h-3.5" style={{ color: item.notes ? '#10b981' : 'rgba(255,255,255,0.3)' }} />
                                        </button>

                                        {/* Quantity Controls */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => updateQuantity(item.lineId, -1)}
                                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center press"
                                            >
                                                <Minus className="w-3.5 h-3.5" />
                                            </button>
                                            <span className="text-sm font-bold font-mono w-5 text-center">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.lineId, 1)}
                                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center press"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        <div className="text-right ml-1">
                                            <p className="text-sm font-bold font-mono">${(item.price * item.quantity).toFixed(2)}</p>
                                            <button onClick={() => removeItem(item.lineId)} className="mt-0.5">
                                                <Trash2 className="w-3.5 h-3.5 text-wave-red/60 hover:text-wave-red" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Inline note editor */}
                                    {editingNotesFor === item.lineId && (
                                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-wave-border/30">
                                            <input
                                                autoFocus
                                                type="text"
                                                placeholder="Nota: sin chocolate, extra queso..."
                                                value={draftItemNote}
                                                onChange={e => setDraftItemNote(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        updateItemNotes(item.lineId, draftItemNote);
                                                        setEditingNotesFor(null);
                                                    }
                                                }}
                                                className="flex-1 bg-black/30 border border-wave-border/50 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-wave-text-muted/50 focus:outline-none focus:border-wave-green/40"
                                            />
                                            <button
                                                onClick={() => { updateItemNotes(item.lineId, draftItemNote); setEditingNotesFor(null); }}
                                                className="w-7 h-7 rounded-lg bg-wave-green/20 flex items-center justify-center press"
                                            >
                                                <Check className="w-3.5 h-3.5 text-wave-green" />
                                            </button>
                                            <button
                                                onClick={() => setEditingNotesFor(null)}
                                                className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center press"
                                            >
                                                <X className="w-3.5 h-3.5 text-wave-text-muted" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Footer — Total & Pay */}
                        <div className="p-5 border-t border-wave-border space-y-3 safe-bottom">
                            <div className="flex items-end justify-between">
                                <span className="text-wave-text-muted text-sm">Total</span>
                                <span className="text-3xl font-bold font-mono text-wave-green">${cartTotal.toFixed(2)}</span>
                            </div>

                            <button
                                onClick={() => { setShowCart(false); navigate('/payment'); }}
                                className="w-full py-4 rounded-2xl bg-wave-green font-bold text-lg press shadow-[0_8px_24px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2"
                            >
                                Cobrar ${cartTotal.toFixed(2)}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
