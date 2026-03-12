import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, X, Menu, ChevronDown, MoreVertical,
    LogOut, Trash2, Edit3,
    MapPin, ArrowRightLeft, RefreshCw, Users, Target, ArrowLeft, Scissors
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
        items, addItem, removeItem, updateQuantity,
        ticketName, setTicketName,
        total, itemCount, clearCart,
        tableId, tableName, ticketId, loadTicket,
    } = useCartStore();

    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [showCatDropdown, setShowCatDropdown] = useState(false);
    const [showSideMenu, setShowSideMenu] = useState(false);
    const [showTicketMenu, setShowTicketMenu] = useState(false);
    const [showTableSelector, setShowTableSelector] = useState(false);
    const [tableSearch, setTableSearch] = useState('');
    const [showTicketDetail, setShowTicketDetail] = useState(false);
    const [draftName, setDraftName] = useState('');
    const [saving, setSaving] = useState(false);
    const [showCustomForm, setShowCustomForm] = useState(false);
    const [customName, setCustomName] = useState('');
    const [customComment, setCustomComment] = useState('');
    const [customOrderType, setCustomOrderType] = useState('dine_in');
    const [showSplitView, setShowSplitView] = useState(false);
    const [splitQtys, setSplitQtys] = useState<Record<string, number>>({});
    const [splitting, setSplitting] = useState(false);
    const queryClient = useQueryClient();

    const getDefaultTicketName = () => {
        const now = new Date();
        const h = now.getHours();
        const m = now.getMinutes().toString().padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `Ticket - ${h12}:${m} ${ampm}`;
    };

    const ORDER_TYPES = [
        { key: 'dine_in', label: 'Dine-in' },
        { key: 'takeaway', label: 'Takeaway' },
        { key: 'delivery', label: 'Delivery' },
        { key: 'bar', label: 'Bar Tab' },
    ];

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
        // Sort alphabetically, but push items with emoji names to the end
        const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
        return list.sort((a, b) => {
            const aHasEmoji = emojiRegex.test(a.name);
            const bHasEmoji = emojiRegex.test(b.name);
            if (aHasEmoji !== bHasEmoji) return aHasEmoji ? 1 : -1;
            return a.name.localeCompare(b.name);
        });
    }, [products, search, activeCategory]);

    const cartTotal = total();
    const cartCount = itemCount();
    const hasItems = cartCount > 0;
    const activeGoals = goals.filter(g => !g.isCompleted);
    const completedGoals = goals.filter(g => g.isCompleted);
    const hasGoals = goals.length > 0;

    const handleSave = async (saveTableId?: string, saveTableName?: string, opts?: { ticketName?: string; notes?: string }) => {
        setSaving(true);
        try {
            const sessionId = localStorage.getItem('wave_pos_session') || 'pos-mobile';
            const itemsPayload = items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price, notes: i.notes || undefined }));
            const resolvedName = opts?.ticketName || (ticketName !== 'Ticket' ? ticketName : undefined);
            if (ticketId) {
                await api.put(`/sales/${ticketId}`, {
                    status: 'open',
                    tableId: saveTableId || undefined,
                    tableName: saveTableName || undefined,
                    totalAmount: cartTotal,
                    items: itemsPayload,
                    ...(resolvedName && { ticketName: resolvedName }),
                    ...(opts?.notes !== undefined && { notes: opts.notes }),
                });
            } else {
                await api.post('/sales', {
                    sessionId,
                    items: itemsPayload,
                    paymentMethod: 'cash',
                    status: 'open',
                    employeeId: employee?.id || undefined,
                    tableId: saveTableId || undefined,
                    tableName: saveTableName || undefined,
                    ticketName: resolvedName,
                    notes: opts?.notes || undefined,
                });
            }
            setShowTableSelector(false);
            setShowCustomForm(false);
            setTableSearch('');
            clearCart();
            queryClient.invalidateQueries({ queryKey: ['open-tickets'] });
        } catch (e) {
            console.error('Save error:', e);
            alert('Error guardando el ticket');
        } finally {
            setSaving(false);
        }
    };

    const handleVoid = async () => {
        if (!window.confirm('¿Anular este ticket? Esta acción no se puede deshacer.')) return;
        if (ticketId) {
            try {
                await api.delete(`/sales/${ticketId}`);
            } catch (e) {
                console.error('Void error:', e);
                alert('Error anulando el ticket');
                return;
            }
        }
        clearCart();
        setShowTicketDetail(false);
        setShowTicketMenu(false);
    };

    const handleSync = async () => {
        if (!ticketId) { setShowTicketMenu(false); return; }
        try {
            const { data } = await api.get(`/sales/${ticketId}`);
            const order = data?.data || data;
            loadTicket({
                id: order.id,
                name: order.ticketName || order.tableName || `Ticket #${order.id.slice(-4)}`,
                tableId: order.tableId,
                tableName: order.tableName,
                items: (order.items || []).map((i: any) => ({
                    productId: i.productId,
                    name: i.productNameSnapshot,
                    price: i.unitPrice,
                    quantity: i.quantity,
                    notes: i.notes || undefined,
                })),
                guestCount: order.guestCount || null,
            });
        } catch (e) {
            console.error('Sync error:', e);
            alert('Error sincronizando el ticket');
        }
        setShowTicketMenu(false);
    };

    return (
        <div className="min-h-dvh flex flex-col safe-top safe-bottom" style={{ background: '#121413' }}>

            {/* ═══ Header ═══ */}
            <header className="px-4 pt-3 pb-2 flex items-center gap-3">
                {/* Hamburger */}
                <button
                    onClick={() => setShowSideMenu(true)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center press"
                    style={{ background: 'rgba(244,240,234,0.04)' }}
                >
                    <Menu className="w-4.5 h-4.5" style={{ color: '#F4F0EA' }} strokeWidth={2} />
                </button>

                {/* Ticket name — tap to open detail sheet */}
                <button
                    onClick={() => { setDraftName(ticketName); setShowTicketDetail(true); }}
                    className="flex-1 min-w-0 text-left"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-[15px] truncate" style={{ color: '#F4F0EA' }}>{ticketName}</span>
                        {cartCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[11px] font-bold shrink-0"
                                style={{ background: 'rgba(244,240,234,0.08)', color: 'rgba(244,240,234,0.5)' }}>
                                {cartCount}
                            </span>
                        )}
                    </div>
                    {tableName && (
                        <p className="text-[11px] mt-0.5" style={{ color: '#93B59D' }}>
                            <MapPin className="w-3 h-3 inline mr-0.5" style={{ verticalAlign: '-2px' }} />
                            {tableName}
                        </p>
                    )}
                </button>

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
                    <div className="absolute right-3 top-14 w-52 rounded-xl z-50 shadow-2xl animate-slide-down overflow-hidden"
                        style={{ background: '#222524', border: '1px solid rgba(244,240,234,0.06)' }}>
                        {[
                            { label: 'View ticket', icon: Edit3, color: '#F4F0EA', action: () => { setDraftName(ticketName); setShowTicketDetail(true); setShowTicketMenu(false); } },
                            { label: 'Assign table', icon: MapPin, color: '#93B59D', action: () => { setTableSearch(''); setShowTableSelector(true); setShowTicketMenu(false); } },
                            { label: 'Move ticket', icon: ArrowRightLeft, color: '#F4F0EA', action: () => { setTableSearch(''); setShowTableSelector(true); setShowTicketMenu(false); } },
                            { label: 'Sync', icon: RefreshCw, color: '#F4F0EA', action: handleSync },
                            ...(ticketId && items.length > 1 ? [{
                                label: 'Split ticket', icon: Scissors, color: '#f59e0b',
                                action: () => { setSplitQtys({}); setShowSplitView(true); setShowTicketMenu(false); },
                            }] : []),
                        ].map((item, i) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={i}
                                    onClick={item.action}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm"
                                    style={{ borderBottom: i < 3 ? '1px solid rgba(244,240,234,0.04)' : 'none', color: 'rgba(244,240,234,0.7)' }}
                                >
                                    <Icon className="w-4 h-4" style={{ color: item.color, opacity: 0.8 }} />
                                    {item.label}
                                </button>
                            );
                        })}
                        <div style={{ borderTop: '1px solid rgba(244,240,234,0.06)' }}>
                            <button
                                onClick={handleVoid}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm"
                                style={{ color: '#ef4444' }}
                            >
                                <Trash2 className="w-4 h-4" style={{ opacity: 0.8 }} />
                                Void ticket
                            </button>
                        </div>
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
                            onClick={
                                hasItems
                                    ? () => {
                                        if (ticketId) {
                                            // Re-saving existing ticket → skip picker, go straight to save
                                            handleSave(tableId || undefined, tableName || undefined);
                                        } else {
                                            setTableSearch('');
                                            setShowTableSelector(true);
                                        }
                                    }
                                    : () => navigate('/tickets')
                            }
                            disabled={saving}
                            className="flex-1 py-4 px-3 btn-save text-center press transition-all"
                        >
                            {saving ? (
                                <div className="w-4 h-4 border-2 rounded-full animate-spin mx-auto"
                                    style={{ borderColor: 'rgba(147,181,157,0.2)', borderTopColor: '#93B59D' }} />
                            ) : (
                                <span className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(244,240,234,0.5)' }}>
                                    {hasItems ? (ticketId ? 'Update' : 'Save') : 'Open Tickets'}
                                </span>
                            )}
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
                                { label: 'Receipts', icon: '🧾', active: false, action: () => { setShowSideMenu(false); navigate('/receipts'); } },
                                { label: 'Shift', icon: '🕐', active: false, action: () => { setShowSideMenu(false); navigate('/shift'); } },
                                { label: 'Open Tickets', icon: '📋', active: false, action: () => { setShowSideMenu(false); navigate('/tickets'); } },
                                { label: 'Mis Metas', icon: '🎯', active: false, action: () => { setShowSideMenu(false); navigate('/goals'); } },
                                { label: 'New Ticket', icon: '⚡', active: false, action: () => { clearCart(); setShowSideMenu(false); } },
                                { label: 'Settings', icon: '⚙️', active: false, action: () => { setShowSideMenu(false); navigate('/settings'); } },
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

            {/* ═══ Ticket Detail Sheet ═══ */}
            {showTicketDetail && (
                <div className="fixed inset-0 z-50 flex flex-col safe-top safe-bottom animate-fade-in"
                    style={{ background: '#121413' }}>
                    {/* Header */}
                    <header className="px-4 pt-3 pb-3 flex items-center gap-3 shrink-0"
                        style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                        <button
                            onClick={() => setShowTicketDetail(false)}
                            className="w-9 h-9 rounded-lg flex items-center justify-center press"
                            style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}
                        >
                            <ArrowLeft className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.5)' }} />
                        </button>
                        <input
                            type="text"
                            value={draftName}
                            onChange={e => setDraftName(e.target.value)}
                            onBlur={() => draftName.trim() && setTicketName(draftName.trim())}
                            onKeyDown={e => { if (e.key === 'Enter') { draftName.trim() && setTicketName(draftName.trim()); (e.target as HTMLInputElement).blur(); } }}
                            className="flex-1 text-[17px] font-bold bg-transparent focus:outline-none"
                            style={{ color: '#F4F0EA' }}
                        />
                        <button
                            onClick={() => { setShowTicketDetail(false); setTableSearch(''); setShowTableSelector(true); }}
                            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold press"
                            style={{ background: 'rgba(147,181,157,0.12)', color: '#93B59D', border: '1px solid rgba(147,181,157,0.2)' }}
                        >
                            <MapPin className="w-3.5 h-3.5 inline mr-1" style={{ verticalAlign: '-2px' }} />
                            {tableName || 'Table'}
                        </button>
                    </header>

                    {/* Order type + table row */}
                    <div className="px-5 py-3 flex items-center gap-2"
                        style={{ borderBottom: '1px solid rgba(244,240,234,0.04)', background: 'rgba(244,240,234,0.02)' }}>
                        {(() => {
                            return (
                                <span className="text-[12px] font-medium" style={{ color: 'rgba(244,240,234,0.35)' }}>
                                    🍽️ Dine-in
                                    {tableName ? ` · ${tableName}` : ''}
                                    {ticketId ? ` · Open ticket` : ''}
                                </span>
                            );
                        })()}
                    </div>

                    {/* Items list */}
                    <div className="flex-1 overflow-y-auto">
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40" style={{ color: 'rgba(244,240,234,0.2)' }}>
                                <p className="text-sm">No items yet</p>
                                <button onClick={() => setShowTicketDetail(false)}
                                    className="mt-3 text-[13px] font-semibold press"
                                    style={{ color: '#93B59D' }}>
                                    Add items →
                                </button>
                            </div>
                        ) : (
                            <div>
                                {items.map(item => (
                                    <div key={item.productId}
                                        className="flex items-center gap-3 px-5 py-3.5"
                                        style={{ borderBottom: '1px solid rgba(244,240,234,0.04)' }}>
                                        {/* Qty controls */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center press"
                                                style={{ background: 'rgba(244,240,234,0.06)', color: '#F4F0EA', fontSize: '16px', lineHeight: 1 }}
                                            >−</button>
                                            <span className="w-5 text-center font-bold text-[14px]" style={{ color: '#F4F0EA' }}>
                                                {item.quantity}
                                            </span>
                                            <button
                                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center press"
                                                style={{ background: 'rgba(244,240,234,0.06)', color: '#93B59D', fontSize: '16px', lineHeight: 1 }}
                                            >+</button>
                                        </div>
                                        {/* Name */}
                                        <span className="flex-1 text-[14px]" style={{ color: 'rgba(244,240,234,0.85)' }}>{item.name}</span>
                                        {/* Price */}
                                        <span className="font-mono text-[14px] tabular-nums shrink-0" style={{ color: 'rgba(244,240,234,0.5)' }}>
                                            ${(item.price * item.quantity).toFixed(2)}
                                        </span>
                                        {/* Remove */}
                                        <button
                                            onClick={() => removeItem(item.productId)}
                                            className="w-7 h-7 flex items-center justify-center press shrink-0"
                                            style={{ color: 'rgba(239,68,68,0.4)' }}
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Total row */}
                    <div className="px-5 py-4 flex items-center justify-between"
                        style={{ borderTop: '1px solid rgba(244,240,234,0.06)', background: 'rgba(244,240,234,0.02)' }}>
                        <span className="font-bold text-[15px]" style={{ color: '#F4F0EA' }}>Total</span>
                        <span className="font-bold font-mono text-[17px] tabular-nums" style={{ color: '#F4F0EA' }}>
                            ${cartTotal.toFixed(2)}
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="px-4 pb-4 pt-2 flex gap-2 safe-bottom">
                        <button
                            onClick={handleVoid}
                            className="flex-1 py-3.5 rounded-xl text-sm font-semibold press"
                            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444' }}
                        >
                            <Trash2 className="w-4 h-4 inline mr-1.5" style={{ verticalAlign: '-2px' }} />
                            Void ticket
                        </button>
                        <button
                            onClick={() => { setShowTicketDetail(false); navigate('/payment'); }}
                            disabled={items.length === 0}
                            className="flex-[1.6] py-3.5 rounded-xl text-sm font-bold press disabled:opacity-30"
                            style={{ background: 'linear-gradient(135deg, #1C402E, #255639)', color: '#93B59D' }}
                        >
                            Charge ${cartTotal.toFixed(2)}
                        </button>
                    </div>
                </div>
            )}

            {/* ═══ Save Ticket — Table Picker (Loyverse style) ═══ */}
            {showTableSelector && (
                <div className="fixed inset-0 z-50 flex flex-col safe-top safe-bottom animate-fade-in" style={{ background: '#121413' }}>
                    {/* Header */}
                    <header className="px-4 pt-3 pb-3 flex items-center gap-3 shrink-0"
                        style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                        <button
                            onClick={() => { setShowTableSelector(false); setTableSearch(''); setShowCustomForm(false); }}
                            className="w-9 h-9 rounded-lg flex items-center justify-center press"
                            style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}
                        >
                            <X className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.5)' }} />
                        </button>
                        <h1 className="text-[15px] font-semibold" style={{ color: '#F4F0EA' }}>Assign table</h1>
                    </header>

                    {/* Search */}
                    <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(244,240,234,0.04)' }}>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                                style={{ color: 'rgba(244,240,234,0.15)' }} />
                            <input
                                type="text"
                                placeholder="Search table..."
                                value={tableSearch}
                                onChange={e => setTableSearch(e.target.value)}
                                className="w-full rounded-xl pl-9 py-2.5 text-sm focus:outline-none"
                                style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)', color: '#F4F0EA' }}
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto">
                        {/* Custom ticket — opens form */}
                        {!tableSearch && (
                            <button
                                onClick={() => {
                                    setCustomName(getDefaultTicketName());
                                    setCustomComment('');
                                    setCustomOrderType('dine_in');
                                    setShowCustomForm(true);
                                }}
                                className="w-full px-5 py-4 text-left font-semibold text-sm tracking-wide press"
                                style={{ borderBottom: '1px solid rgba(244,240,234,0.04)', color: '#93B59D' }}
                            >
                                CUSTOM TICKET
                            </button>
                        )}

                        {/* Flat table list — only show available tables (not occupied by another ticket) */}
                        {(() => {
                            const availableTables = tables.filter(t =>
                                (!t.isOccupied || t.currentTicket?.id === ticketId) &&
                                (!tableSearch || t.name.toLowerCase().includes(tableSearch.toLowerCase()))
                            );
                            if (tables.length === 0 && !tableSearch) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-20 gap-3"
                                        style={{ color: 'rgba(244,240,234,0.25)' }}>
                                        <MapPin className="w-10 h-10 opacity-20" />
                                        <p className="text-sm font-medium">No hay mesas configuradas</p>
                                        <p className="text-xs" style={{ color: 'rgba(244,240,234,0.15)' }}>Crea mesas desde el HQ</p>
                                    </div>
                                );
                            }
                            if (availableTables.length === 0) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-12 gap-2"
                                        style={{ color: 'rgba(244,240,234,0.25)' }}>
                                        <p className="text-sm">{tableSearch ? `No se encontró "${tableSearch}"` : 'No hay mesas disponibles'}</p>
                                    </div>
                                );
                            }
                            return availableTables.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => handleSave(t.id, t.name)}
                                    disabled={saving}
                                    className="w-full px-5 py-4 text-left text-[15px] press flex items-center justify-between"
                                    style={{ borderBottom: '1px solid rgba(244,240,234,0.04)', color: saving ? 'rgba(244,240,234,0.3)' : '#F4F0EA' }}
                                >
                                    <span>{t.name}</span>
                                    {saving && (
                                        <div className="w-4 h-4 border-2 rounded-full animate-spin shrink-0"
                                            style={{ borderColor: 'rgba(147,181,157,0.2)', borderTopColor: '#93B59D' }} />
                                    )}
                                </button>
                            ));
                        })()}
                    </div>

                    {/* ── Custom Ticket Form (slides over table list) ── */}
                    {showCustomForm && (
                        <div className="absolute inset-0 flex flex-col safe-top safe-bottom animate-slide-up"
                            style={{ background: '#121413' }}>
                            {/* Form header */}
                            <header className="px-4 pt-3 pb-3 flex items-center gap-3 shrink-0"
                                style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                                <button
                                    onClick={() => setShowCustomForm(false)}
                                    className="w-9 h-9 rounded-lg flex items-center justify-center press"
                                    style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}
                                >
                                    <ArrowLeft className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.5)' }} />
                                </button>
                                <h1 className="flex-1 text-[15px] font-semibold" style={{ color: '#F4F0EA' }}>Save ticket</h1>
                                <button
                                    onClick={() => {
                                        const orderTypeLabel = ORDER_TYPES.find(t => t.key === customOrderType)?.label;
                                        const notesStr = [
                                            customOrderType !== 'dine_in' ? orderTypeLabel : null,
                                            customComment || null,
                                        ].filter(Boolean).join(' | ') || undefined;
                                        handleSave(undefined, undefined, {
                                            ticketName: customName || getDefaultTicketName(),
                                            notes: notesStr,
                                        });
                                    }}
                                    disabled={saving}
                                    className="px-3 py-1.5 rounded-lg text-sm font-bold press"
                                    style={{ color: '#93B59D' }}
                                >
                                    {saving ? '...' : 'SAVE'}
                                </button>
                            </header>

                            {/* Name field */}
                            <div className="px-5 pt-5 pb-3"
                                style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                                <p className="text-[11px] font-semibold uppercase tracking-widest mb-2"
                                    style={{ color: '#93B59D' }}>Name</p>
                                <input
                                    type="text"
                                    value={customName}
                                    onChange={e => setCustomName(e.target.value)}
                                    autoFocus
                                    className="w-full text-[17px] font-medium bg-transparent focus:outline-none pb-2"
                                    style={{
                                        color: '#F4F0EA',
                                        borderBottom: '2px solid #93B59D',
                                    }}
                                />
                            </div>

                            {/* Comment field */}
                            <div className="px-5 pt-4 pb-3"
                                style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                                <p className="text-[11px] font-semibold uppercase tracking-widest mb-2"
                                    style={{ color: 'rgba(244,240,234,0.3)' }}>Comment</p>
                                <input
                                    type="text"
                                    placeholder="Add a note..."
                                    value={customComment}
                                    onChange={e => setCustomComment(e.target.value)}
                                    className="w-full text-[15px] bg-transparent focus:outline-none pb-2"
                                    style={{
                                        color: '#F4F0EA',
                                        borderBottom: '1px solid rgba(244,240,234,0.1)',
                                    }}
                                />
                            </div>

                            {/* Order type */}
                            <div className="px-5 pt-4">
                                <p className="text-[11px] font-semibold uppercase tracking-widest mb-3"
                                    style={{ color: 'rgba(244,240,234,0.3)' }}>Order Type</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {ORDER_TYPES.map(t => (
                                        <button
                                            key={t.key}
                                            onClick={() => setCustomOrderType(t.key)}
                                            className="py-3 rounded-xl text-sm font-semibold press transition-all"
                                            style={{
                                                background: customOrderType === t.key ? 'rgba(147,181,157,0.15)' : 'rgba(244,240,234,0.04)',
                                                border: `1px solid ${customOrderType === t.key ? 'rgba(147,181,157,0.4)' : 'rgba(244,240,234,0.06)'}`,
                                                color: customOrderType === t.key ? '#93B59D' : 'rgba(244,240,234,0.5)',
                                            }}
                                        >
                                            {t.key === 'dine_in' ? '🍽️' : t.key === 'takeaway' ? '🛍️' : t.key === 'delivery' ? '🚴' : '🍺'} {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {/* ═══ Split Ticket View ═══ */}
            {showSplitView && (() => {
                const splitItems = items.map(item => {
                    const moveQty = splitQtys[item.productId] || 0;
                    return { ...item, moveQty };
                });
                const splitTotal = splitItems.reduce((s, i) => s + i.price * i.moveQty, 0);
                const originalTotal = cartTotal - splitTotal;
                const hasSplitItems = splitItems.some(i => i.moveQty > 0);

                const handleTapItem = (productId: string, maxQty: number) => {
                    setSplitQtys(prev => {
                        const current = prev[productId] || 0;
                        const next = current >= maxQty ? 0 : current + 1;
                        return { ...prev, [productId]: next };
                    });
                };

                const handleConfirmSplit = async () => {
                    if (!ticketId || !hasSplitItems) return;
                    setSplitting(true);
                    try {
                        const splitPayload = splitItems
                            .filter(i => i.moveQty > 0)
                            .map(i => ({ productId: i.productId, quantity: i.moveQty }));

                        const { data } = await api.post(`/sales/${ticketId}/split`, { items: splitPayload });

                        // Reload the original ticket with updated items
                        const origItems = (data.original.items || []).map((i: any) => ({
                            productId: i.productId,
                            name: i.productNameSnapshot,
                            price: i.unitPrice,
                            quantity: i.quantity,
                            notes: i.notes || undefined,
                        }));
                        loadTicket({
                            id: data.original.id,
                            name: ticketName,
                            tableId: tableId || undefined,
                            tableName: tableName || undefined,
                            items: origItems,
                        });

                        queryClient.invalidateQueries({ queryKey: ['open-tickets'] });
                        setShowSplitView(false);
                        setSplitQtys({});
                    } catch (e) {
                        console.error('Split error:', e);
                        alert('Error al dividir el ticket');
                    } finally {
                        setSplitting(false);
                    }
                };

                return (
                    <div className="fixed inset-0 z-50 flex flex-col safe-top safe-bottom animate-fade-in"
                        style={{ background: '#121413' }}>
                        {/* Header */}
                        <header className="px-4 pt-3 pb-3 flex items-center justify-between shrink-0"
                            style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => { setShowSplitView(false); setSplitQtys({}); }}
                                    className="w-9 h-9 rounded-lg flex items-center justify-center press"
                                    style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}
                                >
                                    <ArrowLeft className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.5)' }} />
                                </button>
                                <h1 className="text-[15px] font-semibold" style={{ color: '#F4F0EA' }}>
                                    <Scissors className="w-4 h-4 inline mr-1.5" style={{ verticalAlign: '-2px', color: '#f59e0b' }} />
                                    Split Ticket
                                </h1>
                            </div>
                        </header>

                        {/* Totals bar */}
                        <div className="px-5 py-3 flex items-center gap-4"
                            style={{ borderBottom: '1px solid rgba(244,240,234,0.06)', background: 'rgba(244,240,234,0.02)' }}>
                            <div className="flex-1">
                                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(244,240,234,0.3)' }}>Original</p>
                                <p className="text-[17px] font-bold font-mono tabular-nums" style={{ color: '#93B59D' }}>${originalTotal.toFixed(2)}</p>
                            </div>
                            <ArrowRightLeft className="w-4 h-4 shrink-0" style={{ color: 'rgba(244,240,234,0.15)' }} />
                            <div className="flex-1 text-right">
                                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(244,240,234,0.3)' }}>Split</p>
                                <p className="text-[17px] font-bold font-mono tabular-nums" style={{ color: hasSplitItems ? '#f59e0b' : 'rgba(244,240,234,0.15)' }}>${splitTotal.toFixed(2)}</p>
                            </div>
                        </div>

                        {/* Instruction */}
                        <div className="px-5 py-2">
                            <p className="text-[11px]" style={{ color: 'rgba(244,240,234,0.25)' }}>
                                Tap items to move to the new ticket. Tap again to adjust quantity.
                            </p>
                        </div>

                        {/* Items */}
                        <div className="flex-1 overflow-y-auto">
                            {splitItems.map(item => {
                                const isFullyMoved = item.moveQty === item.quantity;
                                const isPartial = item.moveQty > 0 && !isFullyMoved;
                                return (
                                    <button
                                        key={item.productId}
                                        onClick={() => handleTapItem(item.productId, item.quantity)}
                                        className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-all active:bg-white/5"
                                        style={{
                                            borderBottom: '1px solid rgba(244,240,234,0.04)',
                                            background: isFullyMoved ? 'rgba(245,158,11,0.06)' : isPartial ? 'rgba(245,158,11,0.03)' : 'transparent',
                                        }}
                                    >
                                        {/* Status dot */}
                                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                                            style={{
                                                border: `2px solid ${isFullyMoved ? '#f59e0b' : isPartial ? '#f59e0b' : 'rgba(147,181,157,0.4)'}`,
                                                background: isFullyMoved ? '#f59e0b' : 'transparent',
                                            }}>
                                            {isPartial && (
                                                <div className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} />
                                            )}
                                            {isFullyMoved && (
                                                <span className="text-[9px] font-bold" style={{ color: '#121413' }}>✓</span>
                                            )}
                                        </div>

                                        {/* Name */}
                                        <span className="flex-1 text-[14px]" style={{
                                            color: isFullyMoved ? 'rgba(244,240,234,0.4)' : 'rgba(244,240,234,0.85)',
                                            textDecoration: isFullyMoved ? 'line-through' : 'none',
                                        }}>{item.name}</span>

                                        {/* Qty indicator */}
                                        <span className="text-[12px] font-mono tabular-nums shrink-0" style={{
                                            color: isPartial ? '#f59e0b' : 'rgba(244,240,234,0.35)',
                                        }}>
                                            {isPartial ? `${item.moveQty}/${item.quantity}` : `x${item.quantity}`}
                                        </span>

                                        {/* Price */}
                                        <span className="text-[14px] font-mono tabular-nums shrink-0 w-16 text-right" style={{
                                            color: item.moveQty > 0 ? '#f59e0b' : 'rgba(244,240,234,0.4)',
                                        }}>
                                            ${(item.price * item.quantity).toFixed(2)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Confirm button */}
                        <div className="px-4 pb-4 pt-2 safe-bottom">
                            <button
                                onClick={handleConfirmSplit}
                                disabled={!hasSplitItems || splitting}
                                className="w-full py-4 rounded-xl text-sm font-bold press transition-all disabled:opacity-30"
                                style={{
                                    background: hasSplitItems ? 'linear-gradient(135deg, #92400e, #b45309)' : 'rgba(244,240,234,0.04)',
                                    color: hasSplitItems ? '#fef3c7' : 'rgba(244,240,234,0.2)',
                                    border: `1px solid ${hasSplitItems ? 'rgba(245,158,11,0.3)' : 'rgba(244,240,234,0.06)'}`,
                                }}
                            >
                                {splitting ? (
                                    <div className="w-5 h-5 border-2 rounded-full animate-spin mx-auto"
                                        style={{ borderColor: 'rgba(254,243,199,0.2)', borderTopColor: '#fef3c7' }} />
                                ) : (
                                    <>
                                        <Scissors className="w-4 h-4 inline mr-2" style={{ verticalAlign: '-2px' }} />
                                        Confirmar Split · ${splitTotal.toFixed(2)}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
