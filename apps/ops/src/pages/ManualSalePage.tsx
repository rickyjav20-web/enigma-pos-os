
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft, Loader2, Check, Search, ShoppingCart,
    GripHorizontal, List, MapPin, LayoutGrid, X, ChevronRight,
    Save, Clock, ClipboardList
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
const TENANT_HEADER = { 'x-tenant-id': 'enigma_hq', 'Content-Type': 'application/json' };

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

interface Table {
    id: string;
    name: string;
    zone?: string;
    capacity?: number;
    currentOrder?: { id: string; totalAmount: number } | null;
}

interface OpenOrder {
    id: string;
    tableName?: string;
    ticketName?: string;
    totalAmount: number;
    createdAt: string;
    items: {
        id: string;
        productId: string;
        productNameSnapshot: string;
        quantity: number;
        unitPrice: number;
    }[];
}

export default function ManualSalePage() {
    const { session, employee } = useAuth();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    // ── Open ticket editing ───────────────────────────────────────────────
    const [openOrderId, setOpenOrderId] = useState<string | null>(null);
    const pendingSaveRef = useRef(false);

    // ── Table state ───────────────────────────────────────────────────────
    const [selectedTableId, setSelectedTableId] = useState<string | undefined>(
        searchParams.get('tableId') || undefined
    );
    const [selectedTableName, setSelectedTableName] = useState<string | undefined>(
        searchParams.get('tableName') || undefined
    );

    // ── Table picker ──────────────────────────────────────────────────────
    const [showTablePicker, setShowTablePicker] = useState(false);
    const [tables, setTables] = useState<Table[]>([]);
    const [tableZone, setTableZone] = useState<string>('Todas');
    const [tablesLoading, setTablesLoading] = useState(false);
    const [customTableInput, setCustomTableInput] = useState('');

    // ── Open tickets panel ────────────────────────────────────────────────
    const [showOpenTickets, setShowOpenTickets] = useState(false);
    const [openTickets, setOpenTickets] = useState<OpenOrder[]>([]);
    const [openTicketsLoading, setOpenTicketsLoading] = useState(false);
    const [openTicketCount, setOpenTicketCount] = useState(0);

    // ── Save toast ────────────────────────────────────────────────────────
    const [saveToast, setSaveToast] = useState<string | null>(null);

    // ── POS state ─────────────────────────────────────────────────────────
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showPayment, setShowPayment] = useState(false);
    const [method, setMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        loadProducts();
        fetchOpenCount();
    }, []);

    useEffect(() => {
        if (showOpenTickets) loadOpenTickets();
    }, [showOpenTickets]);

    const loadProducts = async () => {
        try {
            const res = await fetch(`${API_URL}/products?limit=100`, {
                headers: { 'x-tenant-id': 'enigma_hq' }
            });
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data.data || data.products || []);
            setProducts(Array.isArray(list) ? list : []);
        } catch (e) { console.error(e); }
    };

    const fetchOpenCount = async () => {
        try {
            const res = await fetch(`${API_URL}/sales?status=open`, { headers: TENANT_HEADER });
            const data = await res.json();
            setOpenTicketCount((data.data || []).length);
        } catch { }
    };

    const loadOpenTickets = async () => {
        setOpenTicketsLoading(true);
        try {
            const res = await fetch(`${API_URL}/sales?status=open`, { headers: TENANT_HEADER });
            const data = await res.json();
            setOpenTickets(data.data || []);
            setOpenTicketCount((data.data || []).length);
        } catch { } finally {
            setOpenTicketsLoading(false);
        }
    };

    // ── Cart operations ───────────────────────────────────────────────────
    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(i => i.product.id === product.id);
            if (existing) return prev.map(i =>
                i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
            );
            return [...prev, { product, quantity: 1 }];
        });
    };

    const removeFromCart = (productId: string) =>
        setCart(prev => prev.filter(i => i.product.id !== productId));

    const updateQuantity = (productId: string, delta: number) =>
        setCart(prev => prev.map(i =>
            i.product.id === productId
                ? { ...i, quantity: Math.max(1, i.quantity + delta) }
                : i
        ));

    const total = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

    // ── Table picker ──────────────────────────────────────────────────────
    const openTablePicker = async () => {
        setShowTablePicker(true);
        setTablesLoading(true);
        setCustomTableInput('');
        try {
            const res = await fetch(`${API_URL}/tables`, { headers: TENANT_HEADER });
            const data = await res.json();
            setTables(Array.isArray(data) ? data.filter((t: Table) => t) : []);
        } catch { } finally {
            setTablesLoading(false);
        }
    };

    const selectTable = (table: Table) => {
        setSelectedTableId(table.id);
        setSelectedTableName(table.name);
        setShowTablePicker(false);
        if (pendingSaveRef.current) {
            pendingSaveRef.current = false;
            executeS(table.id, table.name);
        }
    };

    const selectCustomTable = () => {
        const name = customTableInput.trim();
        if (!name) return;
        setSelectedTableId(undefined);
        setSelectedTableName(name);
        setCustomTableInput('');
        setShowTablePicker(false);
        if (pendingSaveRef.current) {
            pendingSaveRef.current = false;
            executeS(undefined, name);
        }
    };

    const clearTable = () => {
        setSelectedTableId(undefined);
        setSelectedTableName(undefined);
    };

    // ── SAVE (open ticket) ────────────────────────────────────────────────
    const handleSave = () => {
        if (cart.length === 0) return;
        if (!selectedTableId && !selectedTableName) {
            pendingSaveRef.current = true;
            openTablePicker();
            return;
        }
        executeS(selectedTableId, selectedTableName);
    };

    const executeS = async (tableId?: string, tableName?: string) => {
        if (cart.length === 0) return;
        setIsLoading(true);
        try {
            const items = cart.map(i => ({
                productId: i.product.id,
                quantity: i.quantity,
                price: i.product.price,
            }));

            let res: Response;
            if (openOrderId) {
                // Update existing open ticket items + table
                res = await fetch(`${API_URL}/sales/${openOrderId}`, {
                    method: 'PUT',
                    headers: TENANT_HEADER,
                    body: JSON.stringify({
                        status: 'open',
                        tableId,
                        tableName,
                        totalAmount: total,
                        items,
                    }),
                });
            } else {
                // Create new open ticket
                res = await fetch(`${API_URL}/sales`, {
                    method: 'POST',
                    headers: TENANT_HEADER,
                    body: JSON.stringify({
                        sessionId: session?.id,
                        items,
                        paymentMethod: 'cash',
                        status: 'open',
                        employeeId: employee?.id,
                        tableId,
                        tableName,
                    }),
                });
            }

            if (res.ok) {
                const label = tableName || 'Sin mesa';
                setSaveToast(label);
                setTimeout(() => setSaveToast(null), 2500);
                setCart([]);
                setOpenOrderId(null);
                setSelectedTableId(undefined);
                setSelectedTableName(undefined);
                setOpenTicketCount(c => c + (openOrderId ? 0 : 1));
            } else {
                alert('Error al guardar el ticket');
            }
        } catch { alert('Error de conexión'); }
        finally { setIsLoading(false); }
    };

    // ── COBRAR ────────────────────────────────────────────────────────────
    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setIsLoading(true);
        try {
            let res: Response;
            if (openOrderId) {
                // Complete existing open ticket
                res = await fetch(`${API_URL}/sales/${openOrderId}`, {
                    method: 'PUT',
                    headers: TENANT_HEADER,
                    body: JSON.stringify({
                        status: 'completed',
                        paymentMethod: method,
                        totalAmount: total,
                        employeeId: employee?.id,
                        tableId: selectedTableId,
                        tableName: selectedTableName,
                        notes,
                        items: cart.map(i => ({
                            productId: i.product.id,
                            quantity: i.quantity,
                            price: i.product.price,
                        })),
                    }),
                });
            } else {
                // New completed sale
                res = await fetch(`${API_URL}/sales`, {
                    method: 'POST',
                    headers: TENANT_HEADER,
                    body: JSON.stringify({
                        sessionId: session?.id,
                        items: cart.map(i => ({
                            productId: i.product.id,
                            quantity: i.quantity,
                            price: i.product.price,
                        })),
                        paymentMethod: method,
                        notes,
                        employeeId: employee?.id,
                        tableId: selectedTableId,
                        tableName: selectedTableName,
                    }),
                });
            }

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => navigate('/tables'), 1800);
            } else {
                alert('Error al registrar la venta');
            }
        } catch { alert('Error de conexión'); }
        finally { setIsLoading(false); }
    };

    // ── Resume open ticket ────────────────────────────────────────────────
    const resumeTicket = (ticket: OpenOrder) => {
        setOpenOrderId(ticket.id);
        setSelectedTableId(undefined);
        setSelectedTableName(ticket.tableName || ticket.ticketName);
        setCart(ticket.items.map(item => ({
            product: {
                id: item.productId,
                name: item.productNameSnapshot,
                price: item.unitPrice,
            },
            quantity: item.quantity,
        })));
        setShowOpenTickets(false);
        setShowPayment(false);
    };

    const cancelResume = () => {
        setOpenOrderId(null);
        setCart([]);
        setSelectedTableId(undefined);
        setSelectedTableName(undefined);
    };

    const elapsed = (dateStr: string) => {
        const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
        if (mins < 60) return `${mins}m`;
        return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    };

    const filteredProducts = (products || []).filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const zones = ['Todas', ...Array.from(new Set(tables.map(t => t.zone || 'General'))).sort()];
    const filteredTables = tableZone === 'Todas'
        ? tables
        : tables.filter(t => (t.zone || 'General') === tableZone);

    // ── Success screen ────────────────────────────────────────────────────
    if (success) {
        return (
            <div className="min-h-screen bg-[#121413] flex flex-col items-center justify-center p-4 text-white animate-fade-in">
                <div className="w-24 h-24 rounded-full bg-[#1C402E]/50 border border-[#93B59D]/30 flex items-center justify-center mb-5">
                    <Check className="w-12 h-12 text-[#93B59D]" />
                </div>
                <h2 className="text-2xl font-bold mb-1">¡Venta Registrada!</h2>
                {selectedTableName && (
                    <p className="flex items-center gap-1.5 text-sm text-[#93B59D] mb-1">
                        <MapPin className="w-3.5 h-3.5" />{selectedTableName}
                    </p>
                )}
                <p className="text-emerald-400 font-mono text-2xl font-bold mb-4">${total.toFixed(2)}</p>
                <p className="text-white/30 text-sm">Volviendo al salón...</p>
            </div>
        );
    }

    return (
        <div className="h-screen bg-[#121413] text-white flex flex-col overflow-hidden">

            {/* ── HEADER ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-2 px-3 py-3 border-b border-white/5 bg-[#121413] shrink-0">
                <Link
                    to={selectedTableId ? '/tables' : '/'}
                    className="p-2 bg-white/5 rounded-xl hover:bg-white/10 shrink-0"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>

                {/* Table badge / assign button */}
                {selectedTableName ? (
                    <button
                        onClick={openTablePicker}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1C402E]/60 border border-[#93B59D]/40
                            rounded-xl shrink-0 hover:border-[#93B59D]/70 transition-all"
                    >
                        <MapPin className="w-3.5 h-3.5 text-[#93B59D]" />
                        <span className="text-sm font-bold text-[#93B59D]">{selectedTableName}</span>
                        <ChevronRight className="w-3 h-3 text-[#93B59D]/50" />
                    </button>
                ) : (
                    <button
                        onClick={openTablePicker}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10
                            rounded-xl shrink-0 hover:bg-[#1C402E]/40 hover:border-[#93B59D]/30 transition-all"
                    >
                        <LayoutGrid className="w-3.5 h-3.5 text-white/40" />
                        <span className="text-sm text-white/50">Asignar mesa</span>
                    </button>
                )}

                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                        type="text"
                        placeholder="Buscar productos..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 pl-9 pr-4 py-2 rounded-xl border border-white/8 text-sm
                            focus:outline-none focus:border-enigma-purple text-white"
                    />
                </div>

                {/* Open Tickets button */}
                <button
                    onClick={() => setShowOpenTickets(true)}
                    className="relative p-2 bg-white/5 rounded-xl text-white/50 hover:text-white hover:bg-white/10 shrink-0 transition-all"
                >
                    <ClipboardList className="w-5 h-5" />
                    {openTicketCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-[9px] font-bold text-black flex items-center justify-center">
                            {openTicketCount > 9 ? '9+' : openTicketCount}
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                    className="p-2 bg-white/5 rounded-xl text-white/40 hover:text-white shrink-0"
                >
                    {viewMode === 'grid' ? <List className="w-5 h-5" /> : <GripHorizontal className="w-5 h-5" />}
                </button>
            </div>

            {/* ── Resuming banner ─────────────────────────────────────── */}
            {openOrderId && (
                <div className="flex items-center justify-between px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 shrink-0">
                    <p className="text-xs text-amber-300 font-semibold">
                        Editando ticket: {selectedTableName || 'Sin mesa'}
                    </p>
                    <button onClick={cancelResume} className="text-xs text-white/30 hover:text-white underline">
                        Cancelar
                    </button>
                </div>
            )}

            {/* ── BODY: Products + Cart ───────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden">

                {/* Product grid */}
                <div className={`flex-1 overflow-y-auto p-3 ${showPayment ? 'opacity-40 pointer-events-none' : ''}`}>
                    <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-2 sm:grid-cols-3' : 'space-y-2'}>
                        {filteredProducts.map(product => (
                            <button
                                key={product.id}
                                onClick={() => addToCart(product)}
                                className={`bg-[#222524]/80 border border-white/5 hover:border-enigma-purple/50
                                    hover:bg-[#222524] transition-all active:scale-[0.96] text-left w-full
                                    ${viewMode === 'grid'
                                        ? 'p-3 rounded-xl flex flex-col justify-between h-28'
                                        : 'p-3 rounded-xl flex items-center justify-between'
                                    }`}
                            >
                                <div>
                                    <p className="font-semibold text-sm leading-tight mb-1 line-clamp-2">{product.name}</p>
                                    <p className="text-[10px] text-white/30 uppercase tracking-wider">{product.category || 'General'}</p>
                                </div>
                                <p className="font-mono text-emerald-400 text-sm font-bold">${product.price.toFixed(2)}</p>
                            </button>
                        ))}
                        {filteredProducts.length === 0 && (
                            <div className="col-span-2 py-16 text-center text-white/20">
                                <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Sin productos</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Cart panel */}
                <div className="w-[200px] sm:w-[260px] border-l border-white/5 bg-[#0e0e10] flex flex-col shrink-0">
                    {/* Cart items */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-white/15 py-10">
                                <ShoppingCart className="w-8 h-8 mb-2" />
                                <p className="text-xs">Vacío</p>
                            </div>
                        ) : cart.map(item => (
                            <div key={item.product.id} className="bg-white/3 rounded-xl p-2.5 space-y-1.5">
                                <div className="flex items-start justify-between gap-1">
                                    <p className="text-xs font-semibold text-white leading-tight line-clamp-2 flex-1">
                                        {item.product.name}
                                    </p>
                                    <button onClick={() => removeFromCart(item.product.id)} className="text-white/20 hover:text-red-400 shrink-0 mt-0.5">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => updateQuantity(item.product.id, -1)}
                                            className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-xs font-bold">
                                            −
                                        </button>
                                        <span className="text-xs font-mono w-3 text-center">{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.product.id, 1)}
                                            className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-xs font-bold">
                                            +
                                        </button>
                                    </div>
                                    <p className="font-mono text-xs text-white/70">${(item.product.price * item.quantity).toFixed(2)}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-white/5 space-y-2.5 bg-black/30">
                        {/* Total */}
                        <div className="flex justify-between items-baseline">
                            <span className="text-[10px] text-white/40 uppercase tracking-widest">Total</span>
                            <span className="text-xl font-bold font-mono text-emerald-400">${total.toFixed(2)}</span>
                        </div>

                        {showPayment ? (
                            <div className="space-y-2 animate-fade-in">
                                {/* Table assignment in checkout */}
                                <button
                                    onClick={openTablePicker}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-left
                                        ${selectedTableName
                                            ? 'bg-[#1C402E]/40 border-[#93B59D]/30 text-[#93B59D]'
                                            : 'bg-white/3 border-white/10 text-white/40 hover:border-[#93B59D]/30'
                                        }`}
                                >
                                    <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                                    <span className="text-xs font-semibold flex-1 truncate">
                                        {selectedTableName || 'Asignar mesa...'}
                                    </span>
                                    {selectedTableName && (
                                        <button
                                            onClick={e => { e.stopPropagation(); clearTable(); }}
                                            className="text-white/30 hover:text-red-400"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </button>

                                {/* Payment method */}
                                <div className="grid grid-cols-3 gap-1">
                                    {(['cash', 'card', 'transfer'] as const).map(m => (
                                        <button
                                            key={m}
                                            onClick={() => setMethod(m)}
                                            className={`py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all
                                                ${method === m ? 'bg-enigma-purple text-white' : 'bg-white/5 text-white/40'}`}
                                        >
                                            {m === 'cash' ? 'Efect.' : m === 'card' ? 'Tarjeta' : 'Trans.'}
                                        </button>
                                    ))}
                                </div>

                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Notas..."
                                    className="w-full bg-white/5 border border-white/8 rounded-lg p-2 text-[11px] text-white
                                        focus:outline-none focus:border-enigma-purple resize-none h-12"
                                />

                                <button
                                    onClick={handleCheckout}
                                    disabled={isLoading}
                                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-sm
                                        text-white flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                                >
                                    {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Confirmar Cobro'}
                                </button>
                                <button
                                    onClick={() => setShowPayment(false)}
                                    className="w-full text-[10px] text-white/30 hover:text-white py-1"
                                >
                                    Cancelar
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {/* SAVE button */}
                                <button
                                    onClick={handleSave}
                                    disabled={isLoading || cart.length === 0}
                                    className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20
                                        rounded-xl font-semibold text-sm text-white/70 hover:text-white disabled:opacity-30
                                        disabled:cursor-not-allowed transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                                >
                                    {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                                    {openOrderId ? 'Actualizar Ticket' : 'Guardar Ticket'}
                                </button>

                                {/* COBRAR button */}
                                <button
                                    onClick={() => setShowPayment(true)}
                                    disabled={cart.length === 0}
                                    className="w-full py-3.5 bg-enigma-purple hover:bg-enigma-purple/80 rounded-xl font-bold text-sm
                                        text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.97]"
                                >
                                    Cobrar
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── SAVE TOAST ─────────────────────────────────────────── */}
            {saveToast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                    bg-[#1C402E] border border-[#93B59D]/40 rounded-2xl px-5 py-3
                    flex items-center gap-3 shadow-2xl animate-fade-in pointer-events-none">
                    <div className="w-8 h-8 rounded-full bg-[#93B59D]/20 flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 text-[#93B59D]" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-white">Ticket guardado</p>
                        <p className="text-xs text-[#93B59D]">{saveToast}</p>
                    </div>
                </div>
            )}

            {/* ── OPEN TICKETS SHEET ─────────────────────────────────── */}
            {showOpenTickets && (
                <div
                    className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end"
                    onClick={e => { if (e.target === e.currentTarget) setShowOpenTickets(false); }}
                >
                    <div className="bg-[#121413] rounded-t-3xl border-t border-white/8 max-h-[80vh] flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
                            <div>
                                <h3 className="text-base font-bold text-white">Tickets Abiertos</h3>
                                <p className="text-xs text-white/30">Selecciona para continuar o cobrar</p>
                            </div>
                            <button onClick={() => setShowOpenTickets(false)} className="p-2 rounded-xl bg-white/5 text-white/50 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Tickets list */}
                        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-2">
                            {openTicketsLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
                                </div>
                            ) : openTickets.length === 0 ? (
                                <div className="text-center py-16 text-white/20">
                                    <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm font-semibold">Sin tickets abiertos</p>
                                    <p className="text-xs mt-1">Los tickets guardados aparecerán aquí</p>
                                </div>
                            ) : openTickets.map(ticket => (
                                <button
                                    key={ticket.id}
                                    onClick={() => resumeTicket(ticket)}
                                    className="w-full bg-[#222524] border border-white/8 hover:border-[#93B59D]/40
                                        rounded-2xl p-4 text-left transition-all active:scale-[0.98]"
                                >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0 mt-0.5" />
                                            <span className="font-bold text-sm text-white">
                                                {ticket.tableName || ticket.ticketName || 'Sin mesa'}
                                            </span>
                                        </div>
                                        <span className="text-emerald-400 font-mono text-sm font-bold shrink-0">
                                            ${ticket.totalAmount.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-white/40">
                                        <span>{ticket.items.length} {ticket.items.length === 1 ? 'item' : 'items'}</span>
                                        <span>·</span>
                                        <Clock className="w-3 h-3" />
                                        <span>{elapsed(ticket.createdAt)}</span>
                                    </div>
                                    {ticket.items.length > 0 && (
                                        <p className="mt-2 text-xs text-white/25 truncate">
                                            {ticket.items.map(i => `${i.quantity}x ${i.productNameSnapshot}`).join(', ')}
                                        </p>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── TABLE PICKER MODAL ─────────────────────────────────── */}
            {showTablePicker && (
                <div
                    className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end"
                    onClick={e => { if (e.target === e.currentTarget) { setShowTablePicker(false); pendingSaveRef.current = false; } }}
                >
                    <div className="bg-[#121413] rounded-t-3xl border-t border-white/8 max-h-[75vh] flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
                            <div>
                                <h3 className="text-base font-bold text-white">Asignar Mesa</h3>
                                <p className="text-xs text-white/30">Selecciona o crea una mesa personalizada</p>
                            </div>
                            <button onClick={() => { setShowTablePicker(false); pendingSaveRef.current = false; }} className="p-2 rounded-xl bg-white/5 text-white/50 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Custom table input */}
                        <div className="px-4 pb-3 shrink-0">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={customTableInput}
                                    onChange={e => setCustomTableInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && selectCustomTable()}
                                    placeholder="Nombre personalizado (ej: Terraza VIP)"
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white
                                        placeholder:text-white/25 focus:outline-none focus:border-[#93B59D]/50"
                                />
                                <button
                                    onClick={selectCustomTable}
                                    disabled={!customTableInput.trim()}
                                    className="px-4 py-2 bg-[#1C402E]/60 border border-[#93B59D]/30 text-[#93B59D] text-sm
                                        font-semibold rounded-xl hover:bg-[#1C402E] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    Usar
                                </button>
                            </div>
                        </div>

                        {/* Zone filter */}
                        {zones.length > 2 && (
                            <div className="flex gap-2 px-4 pb-3 overflow-x-auto shrink-0 scrollbar-none">
                                {zones.map(z => (
                                    <button
                                        key={z}
                                        onClick={() => setTableZone(z)}
                                        className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all
                                            ${tableZone === z
                                                ? 'bg-[#93B59D] text-[#121413]'
                                                : 'bg-white/5 text-white/50 hover:bg-white/10'
                                            }`}
                                    >
                                        {z}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Tables grid */}
                        <div className="flex-1 overflow-y-auto px-4 pb-8">
                            {tablesLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
                                </div>
                            ) : filteredTables.length === 0 ? (
                                <div className="text-center py-12 text-white/20">
                                    <LayoutGrid className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">Sin mesas configuradas</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-2.5">
                                    {filteredTables.map(table => {
                                        const isOccupied = !!table.currentOrder;
                                        const isSelected = table.id === selectedTableId;
                                        return (
                                            <button
                                                key={table.id}
                                                onClick={() => selectTable(table)}
                                                className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all active:scale-[0.95]
                                                    ${isSelected
                                                        ? 'bg-[#1C402E]/60 border-[#93B59D]/60 shadow-[0_0_12px_rgba(147,181,157,0.2)]'
                                                        : isOccupied
                                                            ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-400/40'
                                                            : 'bg-white/3 border-white/8 hover:border-white/20'
                                                    }`}
                                            >
                                                <div className={`w-2 h-2 rounded-full ${
                                                    isSelected
                                                        ? 'bg-[#93B59D] shadow-[0_0_6px_rgba(147,181,157,0.7)]'
                                                        : isOccupied
                                                            ? 'bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.5)]'
                                                            : 'bg-white/20'
                                                }`} />
                                                <span className={`text-sm font-bold leading-none ${
                                                    isSelected ? 'text-[#93B59D]' : isOccupied ? 'text-amber-300' : 'text-white/80'
                                                }`}>
                                                    {table.name}
                                                </span>
                                                {table.zone && (
                                                    <span className="text-[9px] text-white/20 uppercase tracking-wider">
                                                        {table.zone}
                                                    </span>
                                                )}
                                                {isOccupied && (
                                                    <span className="text-[9px] text-amber-400 font-semibold">
                                                        ${(table.currentOrder?.totalAmount ?? 0).toFixed(0)}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {selectedTableId && (
                                <button
                                    onClick={clearTable}
                                    className="mt-4 w-full py-3 rounded-xl border border-white/8 text-xs text-white/30 hover:text-red-400 hover:border-red-500/20 transition-all"
                                >
                                    Quitar asignación de mesa
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
