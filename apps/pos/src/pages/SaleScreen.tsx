import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, X, Menu, ChevronDown, MoreVertical,
    ClipboardList, LogOut, Trash2, Edit3,
    MapPin, ArrowRightLeft, RefreshCw, Users, Target, ArrowLeft
} from 'lucide-react';
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

interface DiningTable {
    id: string;
    name: string;
    zone: string | null;
    capacity: number | null;
    isOccupied: boolean;
    currentTicket: { id: string; ticketName: string; totalAmount: number } | null;
}

interface DailyGoal {
    id: string;
    type: string;
    targetName: string;
    targetQty: number;
    currentQty: number;
    isCompleted: boolean;
    rewardNote?: string;
    status: string;
}

// Category colors
const CAT_COLORS: Record<string, string> = {};
const PALETTE = [
    '#93B59D', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899',
    '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6',
    '#e879f9', '#facc15', '#fb7185', '#1C402E',
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
    const {
        items, addItem, ticketName, setTicketName,
        total, itemCount, clearCart,
        tableId, tableName, setTable, ticketId,
    } = useCartStore();

    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [showCatDropdown, setShowCatDropdown] = useState(false);
    const [showSideMenu, setShowSideMenu] = useState(false);
    const [showTicketMenu, setShowTicketMenu] = useState(false);
    const [showTableSelector, setShowTableSelector] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [saving, setSaving] = useState(false);

    // Products
    const { data: productsData, isLoading } = useQuery({
        queryKey: ['pos-products'],
        queryFn: async () => {
            const { data } = await api.get('/products');
            return (data?.data || []) as Product[];
        },
        staleTime: 60_000,
    });

    // Tables
    const { data: tablesData } = useQuery({
        queryKey: ['pos-tables'],
        queryFn: async () => {
            try {
                const { data } = await api.get('/tables');
                return (data?.data || []) as DiningTable[];
            } catch { return [] as DiningTable[]; }
        },
        staleTime: 30_000,
    });

    // Goals for this employee
    const today = new Date().toISOString().split('T')[0];
    const { data: goalsData } = useQuery({
        queryKey: ['pos-goals', employee?.id, today],
        queryFn: async () => {
            if (!employee?.id) return [] as DailyGoal[];
            try {
                const { data } = await api.get(`/goals?employeeId=${employee.id}&date=${today}`);
                return (data?.data || []) as DailyGoal[];
            } catch { return [] as DailyGoal[]; }
        },
        refetchInterval: 15_000, // Refresh every 15s to catch updates
        enabled: !!employee?.id,
    });

    const products = productsData || [];
    const tables = tablesData || [];
    const goals = (goalsData || []).filter(g => g.status === 'ACTIVE' || g.status === 'COMPLETED');

    const categories = useMemo(() => {
        const cats = new Set<string>();
        products.forEach(p => cats.add(p.categoryId || p.category || 'General'));
        return Array.from(cats).sort();
    }, [products]);

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

    // Group tables by zone
    const tablesByZone = useMemo(() => {
        const zones: Record<string, DiningTable[]> = {};
        tables.forEach(t => {
            const z = t.zone || 'General';
            if (!zones[z]) zones[z] = [];
            zones[z].push(t);
        });
        return zones;
    }, [tables]);

    const cartTotal = total();
    const cartCount = itemCount();
    const hasItems = cartCount > 0;
    const activeGoals = goals.filter(g => !g.isCompleted);
    const completedGoals = goals.filter(g => g.isCompleted);
    const hasGoals = goals.length > 0;

    const handleSave = async () => {
        if (!hasItems) { navigate('/tickets'); return; }
        setSaving(true);
        try {
            const sessionId = localStorage.getItem('wave_pos_session') || 'pos-mobile';
            const itemsPayload = items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price }));
            if (ticketId) {
                await api.put(`/sales/${ticketId}`, {
                    status: 'open',
                    tableId: tableId || undefined,
                    tableName: tableName || undefined,
                    totalAmount: cartTotal,
                    items: itemsPayload,
                });
            } else {
                await api.post('/sales', {
                    sessionId,
                    items: itemsPayload,
                    paymentMethod: 'cash',
                    status: 'open',
                    employeeId: employee?.id || undefined,
                    tableId: tableId || undefined,
                    tableName: tableName || undefined,
                    ticketName: ticketName !== 'Ticket' ? ticketName : undefined,
                });
            }
            clearCart();
            navigate('/');
        } catch (e) {
            console.error('Save error:', e);
            alert('Error guardando el ticket');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-dvh flex flex-col safe-top safe-bottom" style={{ background: '#121413' }}>

            {/* ═══ Header ═══ */}
            <header className="px-4 pt-3 pb-2 flex items-center gap-3">
                {/* Back to floor */}
                <button
                    onClick={() => navigate('/')}
                    className="w-9 h-9 rounded-lg flex items-center justify-center press"
                    style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}
                >
                    <ArrowLeft className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.5)' }} />
                </button>
                {/* Hamburger */}
                <button
                    onClick={() => setShowSideMenu(true)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center press"
                    style={{ background: 'rgba(244,240,234,0.04)' }}
                >
                    <Menu className="w-4.5 h-4.5" style={{ color: '#F4F0EA' }} strokeWidth={2} />
                </button>

                {/* Ticket name + count */}
                <div className="flex-1 min-w-0">
                    {editingName ? (
                        <input
                            type="text"
                            value={ticketName}
                            onChange={e => setTicketName(e.target.value)}
                            onBlur={() => setEditingName(false)}
                            onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
                            autoFocus
                            className="bg-transparent border-b text-[15px] font-semibold outline-none w-full py-0.5"
                            style={{ color: '#F4F0EA', borderColor: 'rgba(147,181,157,0.4)' }}
                        />
                    ) : (
                        <button onClick={() => setEditingName(true)} className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-[15px] truncate" style={{ color: '#F4F0EA' }}>{ticketName}</span>
                            <span className="px-1.5 py-0.5 rounded text-[11px] font-bold"
                                style={{ background: 'rgba(244,240,234,0.08)', color: 'rgba(244,240,234,0.5)' }}>
                                {cartCount}
                            </span>
                        </button>
                    )}
                    {tableName && (
                        <p className="text-[11px] mt-0.5" style={{ color: '#93B59D' }}>
                            <MapPin className="w-3 h-3 inline mr-0.5" style={{ verticalAlign: '-2px' }} />
                            {tableName}
                        </p>
                    )}
                </div>

                {/* Add customer / future */}
                <button className="w-9 h-9 rounded-lg flex items-center justify-center press"
                    style={{ background: 'rgba(244,240,234,0.04)' }}>
                    <Users className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.4)' }} />
                </button>

                {/* Ticket actions (⋮) */}
                <button
                    onClick={() => setShowTicketMenu(!showTicketMenu)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center press"
                    style={{ background: 'rgba(244,240,234,0.04)' }}
                >
                    <MoreVertical className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.4)' }} />
                </button>
            </header>

            {/* ═══ Ticket Actions Dropdown (⋮) ═══ */}
            {showTicketMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowTicketMenu(false)} />
                    <div className="absolute right-3 top-14 w-52 rounded-xl z-50 shadow-2xl animate-slide-down"
                        style={{ background: '#222524', border: '1px solid rgba(244,240,234,0.06)' }}>
                        {[
                            { label: 'Clear ticket', icon: Trash2, color: '#ef4444', action: () => { clearCart(); setShowTicketMenu(false); } },
                            { label: 'Edit ticket name', icon: Edit3, color: '#F4F0EA', action: () => { setEditingName(true); setShowTicketMenu(false); } },
                            { label: 'Assign table', icon: MapPin, color: '#93B59D', action: () => { setShowTableSelector(true); setShowTicketMenu(false); } },
                            { label: 'Move ticket', icon: ArrowRightLeft, color: '#F4F0EA', action: () => { setShowTableSelector(true); setShowTicketMenu(false); } },
                            { label: 'Sync', icon: RefreshCw, color: '#F4F0EA', action: () => setShowTicketMenu(false) },
                        ].map((item, i) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={i}
                                    onClick={item.action}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors"
                                    style={{ color: 'rgba(244,240,234,0.7)' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(244,240,234,0.04)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <Icon className="w-4 h-4" style={{ color: item.color, opacity: 0.7 }} />
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}

            {/* ═══ Goals Progress Widget ═══ */}
            {hasGoals && (
                <div className="px-4 pb-2 animate-slide-up">
                    <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(28,64,46,0.12)', border: '1px solid rgba(147,181,157,0.1)' }}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <Target className="w-3.5 h-3.5" style={{ color: '#93B59D' }} />
                                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#93B59D' }}>Daily Goals</span>
                            </div>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: completedGoals.length === goals.length ? '#93B59D' : 'rgba(244,240,234,0.3)', background: completedGoals.length === goals.length ? 'rgba(147,181,157,0.15)' : 'transparent' }}>
                                {completedGoals.length}/{goals.length}
                            </span>
                        </div>
                        {activeGoals.slice(0, 2).map(g => {
                            const pct = Math.min((g.currentQty / g.targetQty) * 100, 100);
                            return (
                                <div key={g.id}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[12px] truncate" style={{ color: 'rgba(244,240,234,0.6)' }}>
                                            {g.type === 'PRODUCT' ? '📦' : g.type === 'CATEGORY' ? '🏷️' : '💰'} {g.targetName}
                                        </span>
                                        <span className="text-[11px] font-mono tabular-nums shrink-0 ml-2" style={{ color: 'rgba(244,240,234,0.3)' }}>
                                            {g.type === 'REVENUE' ? `$${g.currentQty.toFixed(0)}/$${g.targetQty.toFixed(0)}` : `${g.currentQty}/${g.targetQty}`}
                                        </span>
                                    </div>
                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(244,240,234,0.05)' }}>
                                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct >= 100 ? '#93B59D' : 'linear-gradient(90deg, rgba(147,181,157,0.4), #93B59D)' }} />
                                    </div>
                                </div>
                            );
                        })}
                        {completedGoals.length > 0 && activeGoals.length > 0 && (
                            <p className="text-[10px] text-center" style={{ color: 'rgba(147,181,157,0.5)' }}>
                                ✅ {completedGoals.length} completed · {activeGoals.length} remaining
                            </p>
                        )}
                        {activeGoals.length === 0 && completedGoals.length > 0 && (
                            <p className="text-[12px] text-center animate-badge-pop" style={{ color: '#93B59D' }}>
                                🏆 All goals completed!
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ Filter Bar — Category + Search ═══ */}
            <div className="px-4 pb-2">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <button
                            onClick={() => setShowCatDropdown(!showCatDropdown)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg press text-sm"
                            style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}
                        >
                            {activeCategory && (
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getCatColor(activeCategory) }} />
                            )}
                            <span style={{ color: 'rgba(244,240,234,0.6)' }} className="whitespace-nowrap">
                                {activeCategory || 'All items'}
                            </span>
                            <ChevronDown className="w-3.5 h-3.5" style={{ color: 'rgba(244,240,234,0.25)' }} />
                        </button>

                        {showCatDropdown && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowCatDropdown(false)} />
                                <div className="absolute top-full left-0 mt-1.5 w-56 rounded-xl z-50 max-h-64 overflow-y-auto shadow-2xl"
                                    style={{ background: '#222524', border: '1px solid rgba(244,240,234,0.06)' }}>
                                    <button
                                        onClick={() => { setActiveCategory(null); setShowCatDropdown(false); }}
                                        className="w-full text-left px-4 py-3 text-sm flex items-center gap-2"
                                        style={{ color: !activeCategory ? '#93B59D' : 'rgba(244,240,234,0.5)', background: !activeCategory ? 'rgba(147,181,157,0.08)' : 'transparent' }}
                                    >
                                        All items
                                    </button>
                                    {categories.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => { setActiveCategory(cat); setShowCatDropdown(false); }}
                                            className="w-full text-left px-4 py-3 text-sm flex items-center gap-2.5"
                                            style={{ color: activeCategory === cat ? '#93B59D' : 'rgba(244,240,234,0.5)', background: activeCategory === cat ? 'rgba(147,181,157,0.08)' : 'transparent' }}
                                        >
                                            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: getCatColor(cat) }} />
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(244,240,234,0.15)' }} />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none transition-colors"
                            style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)', color: '#F4F0EA' }}
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                <X className="w-3.5 h-3.5" style={{ color: 'rgba(244,240,234,0.3)' }} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ Product List ═══ */}
            <main className="flex-1 overflow-y-auto pb-28">
                {isLoading ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="w-7 h-7 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(147,181,157,0.2)', borderTopColor: '#93B59D' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 animate-fade-in" style={{ color: 'rgba(244,240,234,0.25)' }}>
                        <Search className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-sm">No se encontraron productos</p>
                    </div>
                ) : (
                    <div>
                        {filtered.map((product, idx) => {
                            const inCart = items.find(i => i.productId === product.id);
                            const cat = product.categoryId || product.category || 'General';
                            const catColor = getCatColor(cat);
                            return (
                                <button
                                    key={product.id}
                                    onClick={() => addItem({ id: product.id, name: product.name, price: product.price, category: cat })}
                                    className="product-row w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-all"
                                    style={{
                                        borderBottom: '1px solid rgba(244,240,234,0.04)',
                                        background: inCart ? 'rgba(147,181,157,0.05)' : 'transparent',
                                        animationDelay: `${Math.min(idx * 0.02, 0.3)}s`,
                                    }}
                                >
                                    <div className="w-10 h-10 rounded-lg shrink-0" style={{ backgroundColor: catColor }} />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[15px] leading-tight block truncate" style={{ color: 'rgba(244,240,234,0.9)' }}>{product.name}</span>
                                    </div>
                                    {inCart && (
                                        <span className="shrink-0 w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center animate-badge-pop"
                                            style={{ background: '#1C402E', color: '#93B59D', boxShadow: '0 2px 8px rgba(28,64,46,0.3)' }}>
                                            {inCart.quantity}
                                        </span>
                                    )}
                                    <span className="text-[15px] shrink-0 font-mono tabular-nums" style={{ color: 'rgba(244,240,234,0.4)' }}>
                                        ${product.price.toFixed(2)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* ═══ Bottom Action Bar ═══ */}
            <div className="fixed bottom-0 left-0 right-0 z-30 safe-bottom">
                <div className="mx-3 mb-3 rounded-2xl overflow-hidden"
                    style={{
                        background: 'rgba(34,37,36,0.95)',
                        border: '1px solid rgba(244,240,234,0.06)',
                        backdropFilter: 'blur(20px)',
                        boxShadow: hasItems ? '0 -4px 32px rgba(28,64,46,0.2)' : '0 -2px 16px rgba(0,0,0,0.3)',
                    }}>
                    <div className="flex gap-0">
                        <button
                            onClick={hasItems ? handleSave : () => navigate('/tickets')}
                            disabled={saving}
                            className="flex-1 py-4 px-3 btn-save text-center press transition-all disabled:opacity-50"
                        >
                            <div className="flex items-center justify-center gap-2">
                                {saving ? (
                                    <div className="w-4 h-4 border-2 rounded-full animate-spin"
                                        style={{ borderColor: 'rgba(147,181,157,0.2)', borderTopColor: '#93B59D' }} />
                                ) : (
                                    <ClipboardList className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.35)' }} />
                                )}
                                <span className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(244,240,234,0.5)' }}>
                                    {hasItems ? 'Save' : 'Tickets'}
                                </span>
                            </div>
                        </button>
                        <div style={{ width: '1px', background: 'rgba(244,240,234,0.06)' }} />
                        <button
                            onClick={() => hasItems && navigate('/payment')}
                            className={`flex-[1.3] py-4 px-4 text-center transition-all press ${hasItems ? 'btn-charge' : ''}`}
                            style={!hasItems ? { background: 'rgba(244,240,234,0.03)' } : {}}
                        >
                            <p className="text-[11px] font-semibold uppercase tracking-widest"
                                style={{ color: hasItems ? 'rgba(147,181,157,0.8)' : 'rgba(244,240,234,0.2)' }}>
                                Charge
                            </p>
                            <p className="text-xl font-bold font-mono tabular-nums mt-0.5"
                                style={{ color: hasItems ? '#F4F0EA' : 'rgba(244,240,234,0.15)' }}>
                                ${cartTotal.toFixed(2)}
                            </p>
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══ Side Menu (☰) — Loyverse Style ═══ */}
            {showSideMenu && (
                <>
                    <div className="fixed inset-0 bg-black/70 z-50 animate-fade-in" onClick={() => setShowSideMenu(false)} />
                    <div className="fixed left-0 top-0 bottom-0 w-72 z-50 animate-slide-right" style={{ background: '#1a1d1b' }}>
                        {/* User info header */}
                        <div className="p-5 pb-4" style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#1C402E' }}>
                                    <span className="font-bold text-lg" style={{ color: '#93B59D' }}>
                                        {(employee?.fullName || 'S')[0].toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <p className="font-semibold text-sm" style={{ color: '#F4F0EA' }}>{employee?.fullName || 'Staff'}</p>
                                    <p className="text-xs" style={{ color: 'rgba(244,240,234,0.4)' }}>{employee?.role || 'Employee'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Nav items */}
                        <nav className="py-2">
                            {[
                                { label: 'Sales', icon: '🛒', active: true, action: () => setShowSideMenu(false) },
                                { label: 'Open Tickets', icon: '📋', active: false, action: () => { setShowSideMenu(false); navigate('/tickets'); } },
                                { label: 'New Ticket', icon: '⚡', active: false, action: () => { clearCart(); setShowSideMenu(false); } },
                            ].map((item, i) => (
                                <button
                                    key={i}
                                    onClick={item.action}
                                    className="w-full flex items-center gap-3 px-5 py-3.5 text-sm transition-colors"
                                    style={{
                                        color: item.active ? '#93B59D' : 'rgba(244,240,234,0.6)',
                                        background: item.active ? 'rgba(147,181,157,0.08)' : 'transparent',
                                    }}
                                >
                                    <span className="text-lg w-6 text-center">{item.icon}</span>
                                    {item.label}
                                </button>
                            ))}
                        </nav>

                        {/* Bottom */}
                        <div className="absolute bottom-0 left-0 right-0 p-4" style={{ borderTop: '1px solid rgba(244,240,234,0.06)' }}>
                            <button
                                onClick={() => { logout(); navigate('/login'); }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors"
                                style={{ color: 'rgba(239,68,68,0.7)' }}
                            >
                                <LogOut className="w-4 h-4" />
                                Cerrar Sesión
                            </button>
                            <p className="text-[10px] mt-3 px-4" style={{ color: 'rgba(244,240,234,0.15)' }}>Wave POS v1.0</p>
                        </div>
                    </div>
                </>
            )}

            {/* ═══ Table Selector Modal ═══ */}
            {showTableSelector && (
                <>
                    <div className="fixed inset-0 bg-black/70 z-50 animate-fade-in" onClick={() => setShowTableSelector(false)} />
                    <div className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] flex flex-col animate-slide-up rounded-t-2xl"
                        style={{ background: '#1a1d1b', border: '1px solid rgba(244,240,234,0.06)' }}>
                        {/* Header */}
                        <div className="px-5 pt-4 pb-3 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                            <h2 className="font-semibold text-[15px]" style={{ color: '#F4F0EA' }}>Assign Table</h2>
                            <button onClick={() => setShowTableSelector(false)} className="press">
                                <X className="w-5 h-5" style={{ color: 'rgba(244,240,234,0.4)' }} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* No table option */}
                            <button
                                onClick={() => { setTable(null, null); setShowTableSelector(false); }}
                                className="w-full p-3 rounded-xl text-left text-sm press"
                                style={{
                                    background: !tableId ? 'rgba(147,181,157,0.08)' : 'rgba(244,240,234,0.03)',
                                    border: `1px solid ${!tableId ? 'rgba(147,181,157,0.2)' : 'rgba(244,240,234,0.06)'}`,
                                    color: !tableId ? '#93B59D' : 'rgba(244,240,234,0.5)',
                                }}
                            >
                                Sin mesa (Para llevar)
                            </button>

                            {/* Tables by zone */}
                            {Object.entries(tablesByZone).map(([zone, zoneTables]) => (
                                <div key={zone}>
                                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-2 px-1"
                                        style={{ color: 'rgba(244,240,234,0.25)' }}>{zone}</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {zoneTables.map(t => {
                                            const selected = tableId === t.id;
                                            const occupied = t.isOccupied && !selected;
                                            return (
                                                <button
                                                    key={t.id}
                                                    onClick={() => {
                                                        setTable(t.id, t.name);
                                                        if (!editingName && ticketName === 'Ticket') setTicketName(t.name);
                                                        setShowTableSelector(false);
                                                    }}
                                                    className={`table-card p-3 rounded-xl text-center press ${occupied ? 'table-card-occupied' : 'table-card-free'}`}
                                                    style={{
                                                        background: selected ? 'rgba(147,181,157,0.12)' : occupied ? 'rgba(245,158,11,0.05)' : 'rgba(244,240,234,0.03)',
                                                        border: `1px solid ${selected ? 'rgba(147,181,157,0.3)' : occupied ? 'rgba(245,158,11,0.2)' : 'rgba(244,240,234,0.06)'}`,
                                                    }}
                                                >
                                                    <p className="text-[13px] font-semibold" style={{ color: selected ? '#93B59D' : occupied ? '#f59e0b' : '#F4F0EA' }}>
                                                        {t.name}
                                                    </p>
                                                    {t.capacity && (
                                                        <p className="text-[10px] mt-0.5" style={{ color: 'rgba(244,240,234,0.25)' }}>
                                                            {t.capacity} seats
                                                        </p>
                                                    )}
                                                    {occupied && t.currentTicket && (
                                                        <p className="text-[10px] mt-1" style={{ color: 'rgba(245,158,11,0.6)' }}>
                                                            ${t.currentTicket.totalAmount.toFixed(2)}
                                                        </p>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {tables.length === 0 && (
                                <div className="text-center py-8" style={{ color: 'rgba(244,240,234,0.25)' }}>
                                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">No tables configured</p>
                                    <p className="text-xs mt-1" style={{ color: 'rgba(244,240,234,0.15)' }}>Create tables in HQ Back Office</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
