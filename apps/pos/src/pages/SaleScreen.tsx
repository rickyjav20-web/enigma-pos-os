import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, X, ChevronDown, MoreVertical, UserPlus, LogOut } from 'lucide-react';
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

// Category colors (deterministic based on name)
const CAT_COLORS = [
    '#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#3b82f6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

function getCategoryColor(cat: string): string {
    let hash = 0;
    for (let i = 0; i < cat.length; i++) hash = cat.charCodeAt(i) + ((hash << 5) - hash);
    return CAT_COLORS[Math.abs(hash) % CAT_COLORS.length];
}

export default function SaleScreen() {
    const navigate = useNavigate();
    const { logout, employee } = useAuth();
    const { items, addItem, ticketName, setTicketName, total, itemCount, clearCart } = useCartStore();

    const [search, setSearch] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [showCatDropdown, setShowCatDropdown] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const nameInputRef = useRef<HTMLInputElement>(null);

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

    const handleSave = () => {
        // Save as open ticket — for now just navigate to tickets
        // In the future this would POST to /sales with status: 'open'
        navigate('/tickets');
    };

    const handleCharge = () => {
        if (!hasItems) return;
        navigate('/payment');
    };

    const handleStartEditName = () => {
        setEditingName(true);
        setTimeout(() => nameInputRef.current?.focus(), 50);
    };

    return (
        <div className="min-h-dvh bg-[#2d2d2d] flex flex-col safe-top safe-bottom">

            {/* ═══ Top Bar ═══ */}
            <header className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10">
                {/* Menu */}
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg active:bg-white/10"
                >
                    <Menu className="w-5 h-5 text-white/80" />
                </button>

                {/* Ticket Name + Count */}
                <div className="flex-1 flex items-center gap-2 min-w-0">
                    {editingName ? (
                        <input
                            ref={nameInputRef}
                            type="text"
                            value={ticketName}
                            onChange={e => setTicketName(e.target.value)}
                            onBlur={() => setEditingName(false)}
                            onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
                            className="bg-transparent border-b border-white/30 text-white font-bold text-base outline-none w-full max-w-[200px] py-0.5"
                        />
                    ) : (
                        <button
                            onClick={handleStartEditName}
                            className="flex items-center gap-2 min-w-0"
                        >
                            <span className="text-white font-bold text-base truncate">
                                {ticketName}
                            </span>
                            <span className="shrink-0 bg-white/20 text-white text-xs font-bold px-1.5 py-0.5 rounded min-w-[20px] text-center">
                                {cartCount}
                            </span>
                        </button>
                    )}
                </div>

                {/* Add Customer */}
                <button className="w-9 h-9 flex items-center justify-center rounded-lg active:bg-white/10">
                    <UserPlus className="w-5 h-5 text-white/60" />
                </button>

                {/* More */}
                <button className="w-9 h-9 flex items-center justify-center rounded-lg active:bg-white/10">
                    <MoreVertical className="w-5 h-5 text-white/60" />
                </button>
            </header>

            {/* ═══ Action Buttons — SAVE / CHARGE ═══ */}
            <div className="flex gap-0 border-b border-white/10">
                {hasItems ? (
                    <button
                        onClick={handleSave}
                        className="flex-1 py-3.5 bg-[#4caf50] text-white font-bold text-sm uppercase tracking-wider active:brightness-90 transition-all"
                    >
                        SAVE
                    </button>
                ) : (
                    <button
                        onClick={() => navigate('/tickets')}
                        className="flex-1 py-3.5 bg-[#4caf50] text-white font-bold text-sm uppercase tracking-wider active:brightness-90 transition-all"
                    >
                        OPEN TICKETS
                    </button>
                )}
                <button
                    onClick={handleCharge}
                    className={`flex-1 py-3.5 font-bold text-sm uppercase tracking-wider transition-all flex flex-col items-center justify-center ${hasItems
                            ? 'bg-[#388e3c] text-white active:brightness-90'
                            : 'bg-[#388e3c]/60 text-white/50'
                        }`}
                >
                    <span>CHARGE</span>
                    <span className="text-base font-bold">${cartTotal.toFixed(2)}</span>
                </button>
            </div>

            {/* ═══ Category Filter + Search ═══ */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
                <div className="relative flex-1">
                    <button
                        onClick={() => setShowCatDropdown(!showCatDropdown)}
                        className="flex items-center gap-2 text-white/80 text-sm py-1.5"
                    >
                        <span>{activeCategory || 'All items'}</span>
                        <ChevronDown className="w-4 h-4" />
                    </button>

                    {/* Category Dropdown */}
                    {showCatDropdown && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowCatDropdown(false)} />
                            <div className="absolute top-full left-0 mt-1 w-56 bg-[#3a3a3a] rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto border border-white/10">
                                <button
                                    onClick={() => { setActiveCategory(null); setShowCatDropdown(false); }}
                                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 transition-colors ${!activeCategory ? 'text-[#4caf50] font-bold' : 'text-white/80'}`}
                                >
                                    All items
                                </button>
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => { setActiveCategory(cat); setShowCatDropdown(false); }}
                                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 transition-colors flex items-center gap-2 ${activeCategory === cat ? 'text-[#4caf50] font-bold' : 'text-white/80'}`}
                                    >
                                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: getCategoryColor(cat) }} />
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Search toggle/input */}
                {showSearch ? (
                    <div className="flex items-center gap-1 flex-1 max-w-[200px]">
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                            className="bg-transparent border-b border-white/30 text-white text-sm outline-none w-full py-1"
                        />
                        <button onClick={() => { setSearch(''); setShowSearch(false); }}>
                            <X className="w-4 h-4 text-white/50" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowSearch(true)}
                        className="w-9 h-9 flex items-center justify-center"
                    >
                        <Search className="w-5 h-5 text-white/60" />
                    </button>
                )}
            </div>

            {/* ═══ Product List ═══ */}
            <main className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="w-7 h-7 border-2 border-white/20 border-t-[#4caf50] rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-white/40">
                        <Search className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-sm">No se encontraron productos</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {filtered.map(product => {
                            const inCart = items.find(i => i.productId === product.id);
                            const cat = product.categoryId || product.category || 'General';
                            return (
                                <button
                                    key={product.id}
                                    onClick={() => addItem({ id: product.id, name: product.name, price: product.price, category: cat })}
                                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-white/5 transition-colors ${inCart ? 'bg-white/[0.03]' : ''
                                        }`}
                                >
                                    {/* Category color dot */}
                                    <div
                                        className="w-8 h-8 rounded-md shrink-0"
                                        style={{ backgroundColor: getCategoryColor(cat) }}
                                    />

                                    {/* Name */}
                                    <span className="flex-1 text-white text-[15px] leading-tight">
                                        {product.name}
                                    </span>

                                    {/* Cart quantity badge */}
                                    {inCart && (
                                        <span className="bg-[#4caf50] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                                            {inCart.quantity}
                                        </span>
                                    )}

                                    {/* Price */}
                                    <span className="text-white/70 text-[15px] shrink-0 font-mono">
                                        ${product.price.toFixed(2)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* ═══ Side Menu Overlay ═══ */}
            {showMenu && (
                <>
                    <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setShowMenu(false)} />
                    <div className="fixed left-0 top-0 bottom-0 w-64 bg-[#333] z-50 shadow-2xl flex flex-col animate-slide-right">
                        {/* User info */}
                        <div className="p-5 border-b border-white/10">
                            <div className="w-12 h-12 rounded-full bg-[#4caf50]/20 flex items-center justify-center mb-3">
                                <span className="text-[#4caf50] font-bold text-lg">
                                    {(employee?.fullName || 'S')[0].toUpperCase()}
                                </span>
                            </div>
                            <p className="text-white font-bold text-sm">{employee?.fullName || 'Staff'}</p>
                            <p className="text-white/50 text-xs">{employee?.role || 'Employee'}</p>
                        </div>

                        {/* Menu items */}
                        <div className="flex-1 py-2">
                            <button
                                onClick={() => { setShowMenu(false); navigate('/tickets'); }}
                                className="w-full text-left px-5 py-3 text-white/80 text-sm hover:bg-white/5 active:bg-white/10"
                            >
                                Open Tickets
                            </button>
                            <button
                                onClick={() => { clearCart(); setShowMenu(false); }}
                                className="w-full text-left px-5 py-3 text-white/80 text-sm hover:bg-white/5 active:bg-white/10"
                            >
                                New Ticket
                            </button>
                        </div>

                        {/* Logout */}
                        <div className="p-4 border-t border-white/10">
                            <button
                                onClick={() => { logout(); navigate('/login'); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-400/10 text-sm"
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
