import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Zap, LogOut, ClipboardList, ChevronRight, MoreHorizontal } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useCartStore } from '../stores/cartStore';
import { useAuth } from '../context/AuthContext';

interface Product {
    id: string;
    name: string;
    price: number;
    categoryId?: string;
    category?: string;
    isActive: boolean;
}

// Category colors — curated palette
const CAT_COLORS: Record<string, string> = {};
const PALETTE = [
    '#7c3aed', '#f59e0b', '#ef4444', '#10b981', '#3b82f6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#e879f9', '#facc15', '#fb7185',
];
function getCatColor(cat: string): string {
    if (!CAT_COLORS[cat]) {
        let hash = 0;
        for (let i = 0; i < cat.length; i++) hash = cat.charCodeAt(i) + ((hash << 5) - hash);
        CAT_COLORS[cat] = PALETTE[Math.abs(hash) % PALETTE.length];
    }
    return CAT_COLORS[cat];
}

export default function SaleScreen() {
    const navigate = useNavigate();
    const { logout, employee } = useAuth();
    const { items, addItem, ticketName, setTicketName, total, itemCount, clearCart } = useCartStore();

    const [search, setSearch] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [editingName, setEditingName] = useState(false);

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
            const cat = p.categoryId || p.category || 'General';
            cats.add(cat);
        });
        return Array.from(cats).sort();
    }, [products]);

    // Filter products
    const filtered = useMemo(() => {
        let list = products.filter(p => p.isActive);
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(p => p.name.toLowerCase().includes(q));
        }
        if (activeCategory) {
            list = list.filter(p => (p.categoryId || p.category || 'General') === activeCategory);
        }
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [products, search, activeCategory]);

    const cartTotal = total();
    const cartCount = itemCount();
    const hasItems = cartCount > 0;

    return (
        <div className="min-h-dvh flex flex-col safe-top safe-bottom" style={{ background: '#0f0f14' }}>

            {/* ═══ Header — WAVE Branding ═══ */}
            <header className="px-4 pt-3 pb-2 flex items-center gap-3">
                {/* Logo + Ticket */}
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(124,58,237,0.08))' }}>
                        <Zap className="w-4.5 h-4.5 text-purple-400" strokeWidth={2.5} />
                    </div>

                    {editingName ? (
                        <input
                            type="text"
                            value={ticketName}
                            onChange={e => setTicketName(e.target.value)}
                            onBlur={() => setEditingName(false)}
                            onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
                            autoFocus
                            className="bg-transparent border-b border-purple-400/40 text-white font-semibold text-[15px] outline-none flex-1 min-w-0 py-0.5"
                        />
                    ) : (
                        <button
                            onClick={() => setEditingName(true)}
                            className="flex items-center gap-2 min-w-0"
                        >
                            <span className="text-white font-semibold text-[15px] truncate">{ticketName}</span>
                            {cartCount > 0 && (
                                <span className="shrink-0 bg-purple-500/20 text-purple-300 text-[11px] font-bold px-2 py-0.5 rounded-full border border-purple-500/20 animate-badge-pop">
                                    {cartCount}
                                </span>
                            )}
                        </button>
                    )}
                </div>

                {/* Search toggle */}
                <button
                    onClick={() => setShowSearch(!showSearch)}
                    className="w-9 h-9 rounded-xl glass flex items-center justify-center press"
                >
                    <Search className="w-4 h-4 text-white/50" />
                </button>

                {/* Menu */}
                <button
                    onClick={() => setShowMenu(true)}
                    className="w-9 h-9 rounded-xl glass flex items-center justify-center press"
                >
                    <MoreHorizontal className="w-4 h-4 text-white/50" />
                </button>
            </header>

            {/* ═══ Search Bar (expandable) ═══ */}
            {showSearch && (
                <div className="px-4 pb-2 animate-slide-up">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                            type="text"
                            placeholder="Buscar producto..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                            className="w-full glass rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-purple-500/30 transition-colors"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                                <X className="w-4 h-4 text-white/30" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ Category Chips (horizontal scroll) ═══ */}
            <div className="px-4 pb-2">
                <div className="flex gap-2 overflow-x-auto category-scroll py-1">
                    <button
                        onClick={() => setActiveCategory(null)}
                        className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all press border ${!activeCategory
                                ? 'cat-chip-active'
                                : 'bg-white/[0.03] text-white/50 border-white/[0.06] hover:border-white/10'
                            }`}
                    >
                        Todos
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all press border flex items-center gap-1.5 ${activeCategory === cat
                                    ? 'cat-chip-active'
                                    : 'bg-white/[0.03] text-white/50 border-white/[0.06] hover:border-white/10'
                                }`}
                        >
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getCatColor(cat) }} />
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* ═══ Product List ═══ */}
            <main className="flex-1 overflow-y-auto px-4 pb-28">
                {isLoading ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="w-7 h-7 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-white/30 animate-fade-in">
                        <Search className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-sm">No se encontraron productos</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {filtered.map((product, idx) => {
                            const inCart = items.find(i => i.productId === product.id);
                            const cat = product.categoryId || product.category || 'General';
                            const catColor = getCatColor(cat);
                            return (
                                <button
                                    key={product.id}
                                    onClick={() => addItem({ id: product.id, name: product.name, price: product.price, category: cat })}
                                    className={`product-row w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${inCart ? 'glass-strong' : ''
                                        }`}
                                    style={{ animationDelay: `${Math.min(idx * 0.02, 0.3)}s` }}
                                >
                                    {/* Category accent bar + dot */}
                                    <div className="relative w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
                                        style={{ backgroundColor: `${catColor}15` }}>
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: catColor }} />
                                    </div>

                                    {/* Name */}
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[14px] text-white/90 leading-tight block truncate">{product.name}</span>
                                    </div>

                                    {/* Cart quantity badge */}
                                    {inCart && (
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-purple-500 text-white text-[11px] font-bold flex items-center justify-center animate-badge-pop shadow-lg shadow-purple-500/20">
                                            {inCart.quantity}
                                        </span>
                                    )}

                                    {/* Price */}
                                    <span className="text-[14px] text-white/50 shrink-0 font-mono tabular-nums">
                                        ${product.price.toFixed(2)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* ═══ Bottom Action Bar — WAVE Twist ═══ */}
            <div className="fixed bottom-0 left-0 right-0 z-30 safe-bottom">
                {/* Glass backdrop */}
                <div className="mx-3 mb-3 rounded-2xl overflow-hidden glass-strong"
                    style={{ boxShadow: hasItems ? '0 -4px 32px rgba(124,58,237,0.12)' : '0 -2px 16px rgba(0,0,0,0.3)' }}>
                    <div className="flex gap-0">
                        {/* Left button — SAVE or OPEN TICKETS */}
                        <button
                            onClick={() => navigate('/tickets')}
                            className="flex-1 py-4 px-3 btn-save text-center press transition-all"
                        >
                            <div className="flex items-center justify-center gap-2">
                                <ClipboardList className="w-4 h-4 text-white/40" />
                                <span className="text-[13px] font-semibold text-white/60 uppercase tracking-wider">
                                    {hasItems ? 'Save' : 'Tickets'}
                                </span>
                            </div>
                        </button>

                        {/* Divider */}
                        <div className="w-px bg-white/[0.06]" />

                        {/* Right button — CHARGE */}
                        <button
                            onClick={() => hasItems && navigate('/payment')}
                            className={`flex-[1.3] py-4 px-4 text-center transition-all press ${hasItems ? 'btn-charge' : 'bg-white/[0.03]'
                                }`}
                        >
                            <p className={`text-[11px] font-semibold uppercase tracking-widest ${hasItems ? 'text-white/80' : 'text-white/25'}`}>
                                Charge
                            </p>
                            <p className={`text-xl font-bold font-mono tabular-nums mt-0.5 ${hasItems ? 'text-white' : 'text-white/20'}`}>
                                ${cartTotal.toFixed(2)}
                            </p>
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══ Side Menu ═══ */}
            {showMenu && (
                <>
                    <div className="fixed inset-0 bg-black/70 z-50 animate-fade-in" onClick={() => setShowMenu(false)} />
                    <div className="fixed right-0 top-0 bottom-0 w-72 z-50 animate-slide-right" style={{ animationDirection: 'normal', background: '#141420' }}>
                        {/* wave gradient top */}
                        <div className="h-32 relative overflow-hidden">
                            <div className="absolute inset-0" style={{
                                background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(124,58,237,0.03) 100%)'
                            }} />
                            <div className="absolute bottom-0 left-0 right-0 p-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-full flex items-center justify-center"
                                        style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                                        <span className="text-white font-bold text-lg">
                                            {(employee?.fullName || 'S')[0].toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-white font-semibold text-sm">{employee?.fullName || 'Staff'}</p>
                                        <p className="text-white/40 text-xs">{employee?.role || 'Employee'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Menu items */}
                        <div className="p-3 space-y-1">
                            <button
                                onClick={() => { clearCart(); setShowMenu(false); }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 text-sm hover:bg-white/5 active:bg-white/10 transition-colors"
                            >
                                <Zap className="w-4 h-4 text-purple-400" />
                                Nuevo Ticket
                            </button>
                            <button
                                onClick={() => { setShowMenu(false); navigate('/tickets'); }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 text-sm hover:bg-white/5 active:bg-white/10 transition-colors"
                            >
                                <ClipboardList className="w-4 h-4 text-amber-400" />
                                Tickets Abiertos
                            </button>
                        </div>

                        {/* Logout */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/[0.06]">
                            <button
                                onClick={() => { logout(); navigate('/login'); }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400/70 text-sm hover:bg-red-400/5 active:bg-red-400/10 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                Cerrar Sesión
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
