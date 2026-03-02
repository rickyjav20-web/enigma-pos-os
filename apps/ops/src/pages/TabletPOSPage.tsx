/**
 * TabletPOSPage — Tablet-optimized floor plan POS
 * Split layout: table grid (left) + live order panel (right)
 * Uses open-ticket model: POST /sales {status:'open'} → PUT /sales/:id to update → checkout
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    ArrowLeft, RefreshCw, LayoutGrid, Users, Clock, Plus,
    Minus, X, Check, Loader2, Search, ChevronRight, ShoppingBag,
    ZapOff, Zap
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
const TH = { 'x-tenant-id': 'enigma_hq', 'Content-Type': 'application/json' };

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrderItem {
    id: string;
    productNameSnapshot: string;
    quantity: number;
    unitPrice: number;
}

interface OpenOrder {
    id: string;
    status: 'open' | 'completed';
    totalAmount: number;
    createdAt: string;
    paymentMethod?: string;
    items: OrderItem[];
    tableName: string | null;
    ticketName: string | null;
}

interface DiningTable {
    id: string;
    name: string;
    zone: string | null;
    capacity: number | null;
    sortOrder: number;
    isOccupied: boolean;
    currentTicket: { id: string; totalAmount: number; createdAt: string } | null;
}

interface Product {
    id: string;
    name: string;
    price: number;
    category?: string;
}

function timeElapsed(dateStr: string): string {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function urgencyColor(dateStr: string): string {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 15) return 'text-[#93B59D]';
    if (mins < 30) return 'text-amber-400';
    return 'text-red-400';
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TabletPOSPage() {
    const { session, employee } = useAuth();

    // Tables
    const [tables, setTables] = useState<DiningTable[]>([]);
    const [loadingTables, setLoadingTables] = useState(true);
    const [activeZone, setActiveZone] = useState('Todas');
    const [refreshing, setRefreshing] = useState(false);

    // Selected table + its open order
    const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);
    const [openOrder, setOpenOrder] = useState<OpenOrder | null>(null);
    const [loadingOrder, setLoadingOrder] = useState(false);

    // Product picker
    const [showProducts, setShowProducts] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [productSearch, setProductSearch] = useState('');
    const [loadingProducts, setLoadingProducts] = useState(false);

    // Checkout
    const [showCheckout, setShowCheckout] = useState(false);
    const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
    const [checkingOut, setCheckingOut] = useState(false);
    const [checkoutDone, setCheckoutDone] = useState(false);

    // Auto-refresh interval
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Fetch Tables ──────────────────────────────────────────────────────────
    const fetchTables = useCallback(async (silent = false) => {
        if (!silent) setLoadingTables(true);
        else setRefreshing(true);
        try {
            const res = await fetch(`${API_URL}/tables`, { headers: TH });
            if (!res.ok) throw new Error(`${res.status}`);
            const data = await res.json();
            const list: DiningTable[] = Array.isArray(data) ? data : (data.data || []);
            setTables(list);
            // Sync selected table occupancy
            if (selectedTable) {
                const updated = list.find(t => t.id === selectedTable.id);
                if (updated) setSelectedTable(updated);
            }
        } catch { /* silent */ } finally {
            setLoadingTables(false);
            setRefreshing(false);
        }
    }, [selectedTable]);

    useEffect(() => {
        fetchTables();
        intervalRef.current = setInterval(() => fetchTables(true), 20000);
        return () => { if (intervalRef.current !== null) clearInterval(intervalRef.current); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Fetch Open Order for a table ─────────────────────────────────────────
    const fetchOpenOrder = useCallback(async (tableId: string) => {
        setLoadingOrder(true);
        try {
            const res = await fetch(`${API_URL}/sales?status=open&tableId=${tableId}&limit=1`, { headers: TH });
            if (!res.ok) { setOpenOrder(null); return; }
            const data = await res.json();
            const list: OpenOrder[] = Array.isArray(data) ? data : (data.data || []);
            setOpenOrder(list.length > 0 ? list[0] : null);
        } catch { setOpenOrder(null); }
        finally { setLoadingOrder(false); }
    }, []);

    const handleSelectTable = (table: DiningTable) => {
        setSelectedTable(table);
        setOpenOrder(null);
        setShowProducts(false);
        setShowCheckout(false);
        setCheckoutDone(false);
        fetchOpenOrder(table.id);
    };

    // ── Products ─────────────────────────────────────────────────────────────
    const openProductPicker = async () => {
        setShowProducts(true);
        if (products.length > 0) return;
        setLoadingProducts(true);
        try {
            const res = await fetch(`${API_URL}/products?limit=200`, { headers: TH });
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data.data || data.products || []);
            setProducts(list);
        } catch { /* keep existing */ }
        finally { setLoadingProducts(false); }
    };

    // ── Add item to order ─────────────────────────────────────────────────────
    const handleAddProduct = async (product: Product) => {
        if (!selectedTable || !session) return;

        try {
            if (!openOrder) {
                // Create new open order for this table
                const res = await fetch(`${API_URL}/sales`, {
                    method: 'POST',
                    headers: TH,
                    body: JSON.stringify({
                        sessionId: session.id,
                        tableId: selectedTable.id,
                        tableName: selectedTable.name,
                        employeeId: employee?.id,
                        status: 'open',
                        paymentMethod: 'cash',
                        items: [{ productId: product.id, quantity: 1, price: product.price }],
                    }),
                });
                if (!res.ok) return;
                const data = await res.json();
                setOpenOrder(data.order || data);
            } else {
                // Add to existing order
                const existing = openOrder.items.find(i => i.productNameSnapshot === product.name);
                const newItems = existing
                    ? openOrder.items.map(i =>
                        i.productNameSnapshot === product.name
                            ? { ...i, quantity: i.quantity + 1 }
                            : i
                    )
                    : [...openOrder.items, {
                        id: `temp-${Date.now()}`,
                        productNameSnapshot: product.name,
                        quantity: 1,
                        unitPrice: product.price,
                    }];

                const res = await fetch(`${API_URL}/sales/${openOrder.id}`, {
                    method: 'PUT',
                    headers: TH,
                    body: JSON.stringify({
                        items: newItems.map(i => ({
                            productId: product.id, // fallback — server resolves by name
                            productName: i.productNameSnapshot,
                            quantity: i.quantity,
                            price: i.unitPrice,
                        })),
                    }),
                });
                if (!res.ok) return;
                const data = await res.json();
                setOpenOrder(data.order || data);
            }
            // Refresh order details
            fetchOpenOrder(selectedTable.id);
            fetchTables(true);
        } catch { /* ignore */ }
    };

    // ── Remove item ───────────────────────────────────────────────────────────
    const handleRemoveItem = async (item: OrderItem) => {
        if (!openOrder || !selectedTable) return;
        const newItems = openOrder.items
            .map(i => i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i)
            .filter(i => i.quantity > 0);

        try {
            if (newItems.length === 0) {
                // Cancel the order
                await fetch(`${API_URL}/sales/${openOrder.id}`, {
                    method: 'PUT',
                    headers: TH,
                    body: JSON.stringify({ status: 'cancelled', items: [] }),
                });
                setOpenOrder(null);
            } else {
                const res = await fetch(`${API_URL}/sales/${openOrder.id}`, {
                    method: 'PUT',
                    headers: TH,
                    body: JSON.stringify({
                        items: newItems.map(i => ({
                            productName: i.productNameSnapshot,
                            quantity: i.quantity,
                            price: i.unitPrice,
                        })),
                    }),
                });
                if (!res.ok) return;
                const data = await res.json();
                setOpenOrder(data.order || data);
            }
            fetchTables(true);
        } catch { /* ignore */ }
    };

    // ── Checkout ──────────────────────────────────────────────────────────────
    const handleCheckout = async () => {
        if (!openOrder) return;
        setCheckingOut(true);
        try {
            const res = await fetch(`${API_URL}/sales/${openOrder.id}`, {
                method: 'PUT',
                headers: TH,
                body: JSON.stringify({ status: 'completed', paymentMethod: payMethod }),
            });
            if (!res.ok) throw new Error('checkout failed');
            setCheckoutDone(true);
            setOpenOrder(null);
            setShowCheckout(false);
            fetchTables(true);
            // Auto-deselect table after 2s
            setTimeout(() => {
                setSelectedTable(null);
                setCheckoutDone(false);
            }, 2000);
        } catch { /* show error? */ }
        finally { setCheckingOut(false); }
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const zones = ['Todas', ...Array.from(new Set(tables.map(t => t.zone || 'General'))).sort()];
    const visibleTables = activeZone === 'Todas'
        ? tables
        : tables.filter(t => (t.zone || 'General') === activeZone);
    const orderTotal = openOrder?.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) ?? 0;
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase())
    );

    return (
        <div className="h-screen bg-[#121413] text-[#F4F0EA] flex flex-col overflow-hidden">

            {/* ── Top bar ────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] bg-[#0a0a0c]/80 backdrop-blur-xl shrink-0">
                <Link to="/" className="p-2 bg-white/[0.05] rounded-xl hover:bg-white/10 transition-colors">
                    <ArrowLeft className="w-4 h-4 text-[#F4F0EA]/50" />
                </Link>
                <div className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-[#93B59D]" />
                    <span className="text-sm font-bold">Salón — POS</span>
                </div>

                {/* Zone pills */}
                {zones.length > 2 && (
                    <div className="flex gap-1.5 ml-2 overflow-x-auto scrollbar-none">
                        {zones.map(z => (
                            <button key={z} onClick={() => setActiveZone(z)}
                                className={`px-3 py-1 rounded-full text-[11px] font-bold shrink-0 transition-all
                                    ${activeZone === z
                                        ? 'bg-[#93B59D] text-[#121413]'
                                        : 'bg-white/[0.06] text-[#F4F0EA]/40 hover:bg-white/10'
                                    }`}>
                                {z}
                            </button>
                        ))}
                    </div>
                )}

                <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-[#F4F0EA]/25">
                        {tables.filter(t => t.isOccupied).length}/{tables.length} ocupadas
                    </span>
                    <button onClick={() => fetchTables(true)}
                        className="p-2 bg-white/[0.05] rounded-xl hover:bg-white/10 transition-colors"
                        disabled={refreshing}>
                        <RefreshCw className={`w-3.5 h-3.5 text-[#F4F0EA]/35 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* ── Body: floor plan + order panel ───────────────────── */}
            <div className="flex-1 flex overflow-hidden">

                {/* LEFT: Table grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loadingTables ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="w-6 h-6 text-[#93B59D]/50 animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                            {visibleTables.map(table => {
                                const isSelected = selectedTable?.id === table.id;
                                const occupied = table.isOccupied;
                                return (
                                    <button
                                        key={table.id}
                                        onClick={() => handleSelectTable(table)}
                                        className={`
                                            relative p-4 rounded-2xl border flex flex-col gap-2
                                            transition-all duration-200 active:scale-[0.96] touch-manipulation
                                            ${isSelected
                                                ? 'bg-[#1C402E]/50 border-[#93B59D]/60 shadow-[0_0_16px_rgba(147,181,157,0.15)]'
                                                : occupied
                                                    ? 'bg-amber-500/8 border-amber-500/25 hover:border-amber-400/45'
                                                    : 'bg-[#222524]/70 border-white/[0.06] hover:border-[#93B59D]/30'
                                            }
                                        `}
                                    >
                                        {/* Status dot */}
                                        <div className={`
                                            absolute top-3 right-3 w-2 h-2 rounded-full
                                            ${occupied
                                                ? 'bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.6)]'
                                                : isSelected ? 'bg-[#93B59D]' : 'bg-[#93B59D]/30'
                                            }
                                        `} />

                                        <p className={`text-sm font-bold leading-none pr-4 ${isSelected ? 'text-[#93B59D]' : 'text-[#F4F0EA]'}`}>
                                            {table.name}
                                        </p>

                                        {table.zone && (
                                            <p className="text-[9px] text-[#F4F0EA]/25 uppercase tracking-widest">{table.zone}</p>
                                        )}

                                        {table.capacity && (
                                            <div className="flex items-center gap-1">
                                                <Users className="w-3 h-3 text-[#F4F0EA]/20" />
                                                <span className="text-[10px] text-[#F4F0EA]/25">{table.capacity}</span>
                                            </div>
                                        )}

                                        {occupied && table.currentTicket ? (
                                            <div className="space-y-0.5">
                                                <p className={`text-xs font-bold font-mono ${urgencyColor(table.currentTicket.createdAt)}`}>
                                                    ${table.currentTicket.totalAmount.toFixed(2)}
                                                </p>
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-2.5 h-2.5 text-[#F4F0EA]/25" />
                                                    <span className={`text-[10px] ${urgencyColor(table.currentTicket.createdAt)}`}>
                                                        {timeElapsed(table.currentTicket.createdAt)}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-[#93B59D]/60">Libre</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* RIGHT: Order panel */}
                <div className={`
                    w-[300px] shrink-0 border-l border-white/[0.05] bg-[#0e0e10] flex flex-col
                    transition-all duration-300
                    ${selectedTable ? 'translate-x-0' : 'translate-x-full'}
                `}>
                    {!selectedTable ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#F4F0EA]/15 p-8 text-center">
                            <LayoutGrid className="w-10 h-10 opacity-30" />
                            <p className="text-sm">Selecciona una mesa para ver o gestionar su pedido</p>
                        </div>
                    ) : (
                        <>
                            {/* Panel header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05] shrink-0">
                                <div>
                                    <p className="text-sm font-bold text-[#F4F0EA]">{selectedTable.name}</p>
                                    <p className="text-[11px] text-[#F4F0EA]/35">
                                        {selectedTable.zone || 'General'}
                                        {selectedTable.capacity ? ` · ${selectedTable.capacity} pax` : ''}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedTable(null)}
                                    className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#F4F0EA]/30 hover:text-[#F4F0EA]"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {/* Checkout success overlay */}
                            {checkoutDone && (
                                <div className="flex-1 flex flex-col items-center justify-center gap-3 animate-fade-in">
                                    <div className="w-16 h-16 rounded-full bg-[#1C402E]/50 border border-[#93B59D]/30 flex items-center justify-center">
                                        <Check className="w-8 h-8 text-[#93B59D]" />
                                    </div>
                                    <p className="font-bold text-[#93B59D]">¡Cobrado!</p>
                                    <p className="text-xs text-[#F4F0EA]/30">{selectedTable.name} ahora libre</p>
                                </div>
                            )}

                            {/* Order loading */}
                            {!checkoutDone && loadingOrder && (
                                <div className="flex-1 flex items-center justify-center">
                                    <Loader2 className="w-5 h-5 text-[#93B59D]/40 animate-spin" />
                                </div>
                            )}

                            {/* No order yet */}
                            {!checkoutDone && !loadingOrder && !openOrder && (
                                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                                    <ShoppingBag className="w-8 h-8 text-[#F4F0EA]/15" />
                                    <p className="text-sm text-[#F4F0EA]/40">Mesa libre</p>
                                    <p className="text-xs text-[#F4F0EA]/20">Agrega productos para abrir un pedido</p>
                                    <button
                                        onClick={openProductPicker}
                                        className="mt-2 flex items-center gap-2 px-4 py-2.5 bg-[#1C402E]/50 border border-[#93B59D]/30
                                            rounded-xl text-sm font-bold text-[#93B59D] hover:bg-[#1C402E]/70 transition-all"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Agregar productos
                                    </button>
                                </div>
                            )}

                            {/* Open order items */}
                            {!checkoutDone && !loadingOrder && openOrder && !showCheckout && (
                                <>
                                    {/* Order meta */}
                                    <div className="px-4 py-2 border-b border-white/[0.04] flex items-center justify-between shrink-0">
                                        <div className="flex items-center gap-1.5">
                                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                                            <span className="text-[11px] text-amber-400 font-semibold">
                                                {timeElapsed(openOrder.createdAt)} · Ticket abierto
                                            </span>
                                        </div>
                                        <span className="text-[11px] font-mono font-bold text-[#F4F0EA]/60">
                                            ${orderTotal.toFixed(2)}
                                        </span>
                                    </div>

                                    {/* Items */}
                                    <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                                        {openOrder.items.map(item => (
                                            <div key={item.id}
                                                className="flex items-center gap-2 bg-white/[0.03] rounded-xl px-3 py-2.5">
                                                <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center text-xs font-bold text-[#F4F0EA]/70 shrink-0">
                                                    {item.quantity}
                                                </div>
                                                <p className="flex-1 text-xs text-[#F4F0EA]/80 leading-tight line-clamp-2">
                                                    {item.productNameSnapshot}
                                                </p>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <span className="text-[10px] text-[#F4F0EA]/40 font-mono">
                                                        ${(item.unitPrice * item.quantity).toFixed(2)}
                                                    </span>
                                                    <button onClick={() => handleRemoveItem(item)}
                                                        className="p-1 rounded-lg hover:bg-red-500/15 text-[#F4F0EA]/20 hover:text-red-400 transition-colors">
                                                        <Minus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Actions */}
                                    <div className="p-3 border-t border-white/[0.05] space-y-2 shrink-0 bg-black/20">
                                        <button onClick={openProductPicker}
                                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                                                bg-white/[0.04] border border-white/[0.08] text-xs font-bold text-[#F4F0EA]/50
                                                hover:bg-[#1C402E]/30 hover:border-[#93B59D]/30 hover:text-[#93B59D] transition-all">
                                            <Plus className="w-3.5 h-3.5" />
                                            Agregar más
                                        </button>
                                        <button onClick={() => setShowCheckout(true)}
                                            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500
                                                text-white text-sm font-bold flex items-center justify-center gap-2 transition-all">
                                            <ChevronRight className="w-4 h-4" />
                                            Cobrar — ${orderTotal.toFixed(2)}
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* Checkout panel */}
                            {!checkoutDone && showCheckout && (
                                <div className="flex-1 flex flex-col p-4 space-y-4 animate-fade-in">
                                    <div className="text-center">
                                        <p className="text-[#F4F0EA]/40 text-xs uppercase tracking-widest mb-1">Total a cobrar</p>
                                        <p className="text-4xl font-bold font-mono text-emerald-400">${orderTotal.toFixed(2)}</p>
                                        <p className="text-xs text-[#F4F0EA]/25 mt-1">{selectedTable.name}</p>
                                    </div>

                                    <div>
                                        <p className="text-[10px] text-[#F4F0EA]/30 uppercase tracking-widest mb-2">Método de pago</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {(['cash', 'card', 'transfer'] as const).map(m => (
                                                <button key={m} onClick={() => setPayMethod(m)}
                                                    className={`py-3 rounded-xl text-xs font-bold uppercase transition-all
                                                        ${payMethod === m
                                                            ? 'bg-enigma-purple text-white shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                                                            : 'bg-white/[0.04] text-[#F4F0EA]/40 hover:bg-white/[0.08]'
                                                        }`}>
                                                    {m === 'cash' ? 'Efectivo' : m === 'card' ? 'Tarjeta' : 'Transfer.'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex-1" />

                                    <button onClick={handleCheckout} disabled={checkingOut}
                                        className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50
                                            text-white font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.97]">
                                        {checkingOut
                                            ? <Loader2 className="w-5 h-5 animate-spin" />
                                            : <><Check className="w-5 h-5" /> Confirmar Cobro</>
                                        }
                                    </button>
                                    <button onClick={() => setShowCheckout(false)}
                                        className="w-full text-xs text-[#F4F0EA]/25 hover:text-[#F4F0EA]/50 py-2 transition-colors">
                                        Volver al pedido
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ── Product Picker Modal ─────────────────────────────── */}
            {showProducts && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end"
                    onClick={e => { if (e.target === e.currentTarget) setShowProducts(false); }}
                >
                    <div className="bg-[#121413] border-t border-white/[0.08] rounded-t-3xl max-h-[65vh] flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
                            <div>
                                <p className="text-sm font-bold">Agregar productos</p>
                                <p className="text-[11px] text-[#F4F0EA]/30">
                                    {selectedTable?.name} {openOrder ? `· ${openOrder.items.length} ítem(s)` : '· pedido nuevo'}
                                </p>
                            </div>
                            <button onClick={() => setShowProducts(false)}
                                className="p-2 rounded-xl bg-white/[0.05] text-[#F4F0EA]/40 hover:text-[#F4F0EA]">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="px-4 pb-3 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F4F0EA]/25" />
                                <input
                                    autoFocus
                                    value={productSearch}
                                    onChange={e => setProductSearch(e.target.value)}
                                    placeholder="Buscar platos..."
                                    className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl
                                        pl-9 pr-4 py-2.5 text-sm text-[#F4F0EA] focus:outline-none focus:border-[#93B59D]/40"
                                />
                            </div>
                        </div>

                        {/* Products grid */}
                        <div className="flex-1 overflow-y-auto px-4 pb-8">
                            {loadingProducts ? (
                                <div className="flex items-center justify-center py-10">
                                    <Loader2 className="w-5 h-5 text-[#93B59D]/40 animate-spin" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {filteredProducts.map(p => (
                                        <button key={p.id}
                                            onClick={() => handleAddProduct(p)}
                                            className="p-3 rounded-xl bg-[#222524]/80 border border-white/[0.06]
                                                hover:border-[#93B59D]/30 hover:bg-[#222524] text-left
                                                transition-all active:scale-[0.95]">
                                            <p className="text-xs font-semibold text-[#F4F0EA] leading-tight line-clamp-2 mb-1.5">
                                                {p.name}
                                            </p>
                                            <p className="text-[10px] text-[#F4F0EA]/30 uppercase tracking-wider mb-1">
                                                {p.category || 'General'}
                                            </p>
                                            <p className="text-sm font-bold font-mono text-emerald-400">
                                                ${p.price.toFixed(2)}
                                            </p>
                                        </button>
                                    ))}
                                    {filteredProducts.length === 0 && (
                                        <div className="col-span-2 py-12 text-center">
                                            <ZapOff className="w-8 h-8 text-[#F4F0EA]/10 mx-auto mb-2" />
                                            <p className="text-xs text-[#F4F0EA]/25">Sin resultados</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
