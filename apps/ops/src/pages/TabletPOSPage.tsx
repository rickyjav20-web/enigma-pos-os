/**
 * TabletPOSPage - Full horizontal POS for tablet/desktop
 * Layout: Product grid (left ~65%) + Cart sidebar (right ~35%)
 * Mirrors all POS Mobile functionality in landscape orientation
 */
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCartStore } from '../stores/cartStore';
import { useCurrencies } from '../hooks/useCurrencies';
import {
    Search, X, ChevronDown, Plus, Minus, Trash2,
    MapPin, RefreshCw, Scissors, ArrowRightLeft, ArrowLeft,
    Check, Loader2, ShoppingBag, DollarSign, Smartphone,
    Building2, Wallet, CreditCard, Banknote, List,
    LayoutGrid, FileText, Menu, AlertTriangle, Clock, Target,
    Printer, Bluetooth, BluetoothOff, Users, MessageSquare
} from 'lucide-react';
import { usePrinter } from '../hooks/usePrinter';
import type { ReceiptData, CurrencyRate } from '../hooks/usePrinter';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
const TH = { 'x-tenant-id': 'enigma_hq', 'Content-Type': 'application/json' };

interface Product {
    id: string;
    name: string;
    price: number;
    categoryId?: string;
    category?: string;
    isActive: boolean;
    imageUrl?: string;
}

interface DiningTable {
    id: string;
    name: string;
    zone: string | null;
    capacity: number | null;
    isOccupied: boolean;
    currentTicket: { id: string; ticketName: string; totalAmount: number } | null;
}

interface OpenTicket {
    id: string;
    ticketName: string | null;
    tableName: string | null;
    tableId: string | null;
    totalAmount: number;
    createdAt: string;
    employeeId: string | null;
    items: { productId: string; productNameSnapshot: string; quantity: number; unitPrice: number }[];
}

type PayMethod = 'cash' | 'bolivares' | 'zelle' | 'binance' | 'bancolombia' | 'card';
type ViewMode = 'grid' | 'list';

const PAY_METHODS: { id: PayMethod; label: string; icon: typeof DollarSign }[] = [
    { id: 'cash', label: 'Efectivo', icon: Banknote },
    { id: 'bolivares', label: 'Bolivares', icon: Wallet },
    { id: 'zelle', label: 'Zelle', icon: Smartphone },
    { id: 'binance', label: 'Binance', icon: DollarSign },
    { id: 'bancolombia', label: 'Bancolombia', icon: Building2 },
    { id: 'card', label: 'Tarjeta', icon: CreditCard },
];

// Category color system
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

// ── Confirm Modal (replaces window.confirm) ────────────────────────
function ConfirmModal({ title, message, confirmLabel, confirmColor, onConfirm, onCancel }: {
    title: string; message: string; confirmLabel?: string; confirmColor?: string;
    onConfirm: () => void; onCancel: () => void;
}) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="fixed inset-0 bg-black/70" onClick={onCancel} />
            <div className="relative z-10 w-[360px] rounded-2xl p-6" style={{ background: '#1a1d1b', border: '1px solid rgba(244,240,234,0.08)' }}>
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                        <AlertTriangle className="w-5 h-5" style={{ color: '#ef4444' }} />
                    </div>
                    <h3 className="text-base font-bold" style={{ color: '#F4F0EA' }}>{title}</h3>
                </div>
                <p className="text-sm mb-6 ml-[52px]" style={{ color: 'rgba(244,240,234,0.5)' }}>{message}</p>
                <div className="flex gap-2 justify-end">
                    <button onClick={onCancel}
                        className="px-5 py-2.5 rounded-xl text-sm font-medium"
                        style={{ background: 'rgba(244,240,234,0.06)', color: 'rgba(244,240,234,0.6)' }}>
                        Cancelar
                    </button>
                    <button onClick={onConfirm}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold"
                        style={{ background: confirmColor || 'rgba(239,68,68,0.15)', color: confirmColor ? '#F4F0EA' : '#ef4444', border: `1px solid ${confirmColor || 'rgba(239,68,68,0.2)'}` }}>
                        {confirmLabel || 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Toast notification (replaces alert) ─────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: 'error' | 'success' | 'info'; onClose: () => void }) {
    useEffect(() => {
        const t = setTimeout(onClose, 3000);
        return () => clearTimeout(t);
    }, [onClose]);
    const colors = { error: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.2)', text: '#ef4444' }, success: { bg: 'rgba(147,181,157,0.12)', border: 'rgba(147,181,157,0.2)', text: '#93B59D' }, info: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.2)', text: '#3b82f6' } };
    const c = colors[type];
    return (
        <div className="fixed top-4 right-4 z-[200] animate-slide-down" style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: '0.75rem', padding: '0.75rem 1.25rem' }}>
            <p className="text-sm font-medium" style={{ color: c.text }}>{message}</p>
        </div>
    );
}

export default function TabletPOSPage() {
    const { session, employee } = useAuth();
    const {
        items, addItem, removeItem, updateQuantity, updateItemNotes,
        ticketName, setTicketName,
        total, itemCount, clearCart,
        tableId, tableName, ticketId, loadTicket,
        guestCount, setGuestCount,
    } = useCartStore();

    // Product state
    const [products, setProducts] = useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [showCatDropdown, setShowCatDropdown] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem('ops_pos_viewMode') as ViewMode) || 'grid');

    // Tables
    const [tables, setTables] = useState<DiningTable[]>([]);

    // Open tickets
    const [openTickets, setOpenTickets] = useState<OpenTicket[]>([]);
    const [showTickets, setShowTickets] = useState(false);
    const [loadingTickets, setLoadingTickets] = useState(false);

    // Table selector
    const [showTableSelector, setShowTableSelector] = useState(false);
    const [tableSearch, setTableSearch] = useState('');

    // Payment
    const [showPayment, setShowPayment] = useState(false);
    const [payMethod, setPayMethod] = useState<PayMethod>('cash');
    const [paying, setPaying] = useState(false);
    const [paySuccess, setPaySuccess] = useState(false);
    const [cashUSD, setCashUSD] = useState('');
    const [cashCOP, setCashCOP] = useState('');
    const [giveBackUSD, setGiveBackUSD] = useState(0);
    const [activeInput, setActiveInput] = useState<'usd' | 'cop' | null>(null);
    const { currencies: allCurrencies, getRate, formatLocal } = useCurrencies();

    // Item notes editing
    const [editingNotesFor, setEditingNotesFor] = useState<string | null>(null);
    const [draftItemNote, setDraftItemNote] = useState('');

    // Split
    const [showSplit, setShowSplit] = useState(false);
    const [splitQtys, setSplitQtys] = useState<Record<string, number>>({});
    const [splitting, setSplitting] = useState(false);

    // Saving
    const [saving, setSaving] = useState(false);

    // Ticket name editing
    const [editingName, setEditingName] = useState(false);
    const [draftName, setDraftName] = useState('');

    // Side menu
    const [showSideMenu, setShowSideMenu] = useState(false);

    // Confirm modal
    const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; confirmLabel?: string; confirmColor?: string; onConfirm: () => void } | null>(null);

    // Bluetooth printer
    const { connected: printerConnected, connecting: printerConnecting, printing, printerName, connect: connectPrinter, disconnect: disconnectPrinter, printReceipt } = usePrinter();
    const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);

    // Toast
    const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
    const showToast = useCallback((message: string, type: 'error' | 'success' | 'info' = 'error') => setToast({ message, type }), []);

    // Flash feedback on add
    const [lastAddedId, setLastAddedId] = useState<string | null>(null);
    const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Goals
    const [activeGoals, setActiveGoals] = useState<{ id: string; targetName: string; type: string; targetQty: number; currentQty: number; isCompleted: boolean; session: string }[]>([]);

    const cartTotal = total();
    const cartCount = itemCount();
    const hasItems = cartCount > 0;

    // Persist viewMode
    const handleSetViewMode = (mode: ViewMode) => {
        setViewMode(mode);
        localStorage.setItem('ops_pos_viewMode', mode);
    };

    // Add product with visual flash
    const handleAddProduct = (product: Product) => {
        const cat = product.categoryId || product.category || 'General';
        addItem({ id: product.id, name: product.name, price: product.price, category: cat });
        setLastAddedId(product.id);
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = setTimeout(() => setLastAddedId(null), 300);
    };

    // Warn before leaving with unsaved items
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (hasItems) { e.preventDefault(); }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [hasItems]);

    // --- Fetch products ---
    const fetchProducts = useCallback(async () => {
        setLoadingProducts(true);
        try {
            const res = await fetch(`${API_URL}/products?limit=500`, { headers: TH });
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data.data || []);
            setProducts(list.filter((p: Product) => p.isActive));
        } catch { /* silent */ }
        finally { setLoadingProducts(false); }
    }, []);

    // --- Fetch tables ---
    const fetchTables = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/tables`, { headers: TH });
            const data = await res.json();
            setTables(Array.isArray(data) ? data : (data.data || []));
        } catch { /* silent */ }
    }, []);

    // --- Fetch active goals ---
    const fetchGoals = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/goals?autoSession=true`, { headers: TH });
            const data = await res.json();
            setActiveGoals((data.data || []).filter((g: any) => g.status === 'ACTIVE'));
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        fetchProducts();
        fetchTables();
        fetchGoals();
        intervalRef.current = setInterval(() => { fetchTables(); fetchGoals(); }, 30000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Fetch open tickets ---
    const fetchOpenTickets = useCallback(async () => {
        setLoadingTickets(true);
        try {
            const res = await fetch(`${API_URL}/sales?status=open`, { headers: TH });
            const data = await res.json();
            setOpenTickets(Array.isArray(data) ? data : (data.data || []));
        } catch { /* silent */ }
        finally { setLoadingTickets(false); }
    }, []);

    // --- Categories ---
    const categories = useMemo(() => {
        const cats = new Set<string>();
        products.forEach(p => cats.add(p.categoryId || p.category || 'General'));
        return Array.from(cats).sort();
    }, [products]);

    // --- Filtered products ---
    const filtered = useMemo(() => {
        let list = products;
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(p => p.name.toLowerCase().includes(q));
        }
        if (activeCategory) {
            list = list.filter(p => (p.categoryId || p.category || 'General') === activeCategory);
        }
        const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
        return list.sort((a, b) => {
            const aE = emojiRegex.test(a.name);
            const bE = emojiRegex.test(b.name);
            if (aE !== bE) return aE ? 1 : -1;
            return a.name.localeCompare(b.name);
        });
    }, [products, search, activeCategory]);

    // --- Save ticket ---
    const handleSave = async (saveTableId?: string, saveTableName?: string) => {
        setSaving(true);
        try {
            const itemsPayload = items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price, ...(i.notes && { notes: i.notes }) }));
            const resolvedName = ticketName !== 'Ticket' ? ticketName : undefined;
            if (ticketId) {
                await fetch(`${API_URL}/sales/${ticketId}`, {
                    method: 'PUT', headers: TH,
                    body: JSON.stringify({
                        status: 'open',
                        tableId: saveTableId || tableId || undefined,
                        tableName: saveTableName || tableName || undefined,
                        totalAmount: cartTotal,
                        items: itemsPayload,
                        ...(resolvedName && { ticketName: resolvedName }),
                        ...(guestCount && { guestCount }),
                    }),
                });
            } else {
                await fetch(`${API_URL}/sales`, {
                    method: 'POST', headers: TH,
                    body: JSON.stringify({
                        sessionId: session?.id || 'ops-tablet',
                        items: itemsPayload,
                        paymentMethod: 'cash',
                        status: 'open',
                        employeeId: employee?.id || undefined,
                        tableId: saveTableId || undefined,
                        tableName: saveTableName || undefined,
                        ticketName: resolvedName,
                        ...(guestCount && { guestCount }),
                    }),
                });
            }
            setShowTableSelector(false);
            setTableSearch('');
            clearCart();
        } catch {
            showToast('Error guardando el ticket');
        } finally { setSaving(false); }
    };

    // --- Void ticket ---
    const handleVoid = () => {
        if (!ticketId) {
            setConfirmModal({
                title: 'Vaciar Carrito',
                message: 'Los items no guardados se perderan.',
                confirmLabel: 'Vaciar',
                onConfirm: () => { clearCart(); setConfirmModal(null); },
            });
            return;
        }
        setConfirmModal({
            title: 'Anular Ticket',
            message: 'Esta accion no se puede deshacer. El ticket sera eliminado.',
            confirmLabel: 'Anular',
            onConfirm: async () => {
                setConfirmModal(null);
                try { await fetch(`${API_URL}/sales/${ticketId}`, { method: 'DELETE', headers: TH }); }
                catch { showToast('Error anulando'); return; }
                clearCart();
            },
        });
    };

    // --- Sync ticket ---
    const handleSync = async () => {
        if (!ticketId) return;
        try {
            const res = await fetch(`${API_URL}/sales/${ticketId}`, { headers: TH });
            const data = await res.json();
            const order = data?.data || data;
            loadTicket({
                id: order.id,
                name: order.ticketName || order.tableName || `Ticket #${order.id.slice(-4)}`,
                tableId: order.tableId,
                tableName: order.tableName,
                guestCount: order.guestCount,
                items: (order.items || []).map((i: any) => ({
                    productId: i.productId,
                    name: i.productNameSnapshot,
                    price: i.unitPrice,
                    quantity: i.quantity,
                    notes: i.notes || undefined,
                })),
            });
        } catch { showToast('Error sincronizando'); }
    };

    // --- Load a ticket into cart ---
    const handleLoadTicket = (ticket: OpenTicket) => {
        loadTicket({
            id: ticket.id,
            name: ticket.ticketName || ticket.tableName || `Ticket #${ticket.id.slice(-4)}`,
            tableId: ticket.tableId || undefined,
            tableName: ticket.tableName || undefined,
            guestCount: (ticket as any).guestCount || undefined,
            items: ticket.items.map(i => ({
                productId: i.productId,
                name: i.productNameSnapshot,
                price: i.unitPrice,
                quantity: i.quantity,
                notes: (i as any).notes || undefined,
            })),
        });
        setShowTickets(false);
    };

    // --- Payment ---
    const handlePay = async () => {
        if (items.length === 0 || paying) return;
        setPaying(true);
        try {
            const apiMethod = payMethod === 'bolivares' || payMethod === 'zelle' || payMethod === 'binance' || payMethod === 'bancolombia'
                ? 'transfer' : payMethod === 'card' ? 'card' : 'cash';

            if (ticketId) {
                // Don't re-send items when completing — they're already saved in DB.
                // Re-sending would trigger item ID regeneration and confuse KDS done-state.
                await fetch(`${API_URL}/sales/${ticketId}`, {
                    method: 'PUT', headers: TH,
                    body: JSON.stringify({
                        status: 'completed', paymentMethod: apiMethod,
                        totalAmount: cartTotal, tableId: tableId || undefined,
                    }),
                });
            } else {
                await fetch(`${API_URL}/sales`, {
                    method: 'POST', headers: TH,
                    body: JSON.stringify({
                        items: items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price, ...(i.notes && { notes: i.notes }) })),
                        paymentMethod: apiMethod,
                        employeeId: employee?.id || undefined,
                        tableId: tableId || undefined,
                        tableName: tableName || undefined,
                        notes: `OPS-POS | ${payMethod} | ${ticketName}${tableName ? ` | ${tableName}` : ''} | ${employee?.name || ''}`,
                        sessionId: session?.id || 'ops-tablet',
                    }),
                });
            }
            // Save receipt data for manual printing
            const printCurrencies: CurrencyRate[] = allCurrencies
                .filter(c => !c.isBase)
                .map(c => ({ code: c.code, symbol: c.symbol, exchangeRate: c.exchangeRate }));
            const receiptData: ReceiptData = {
                ticketName,
                tableName,
                employeeName: employee?.name?.split(' ')[0] || 'Staff',
                items: items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
                total: cartTotal,
                paymentMethod: payMethod,
                date: new Date(),
                currencies: printCurrencies,
            };
            setLastReceipt(receiptData);

            setPaySuccess(true);
            setTimeout(() => {
                clearCart();
                setShowPayment(false);
                setPaySuccess(false);
                setLastReceipt(null);
                setCashUSD(''); setCashCOP(''); setGiveBackUSD(0);
                fetchTables();
            }, 3000);
        } catch {
            showToast('Error procesando el pago. Intenta de nuevo.');
        } finally { setPaying(false); }
    };

    // --- Split ticket ---
    const handleConfirmSplit = async () => {
        if (!ticketId) return;
        setSplitting(true);
        try {
            const splitPayload = items
                .filter(i => (splitQtys[i.productId] || 0) > 0)
                .map(i => ({ productId: i.productId, quantity: splitQtys[i.productId] }));

            const res = await fetch(`${API_URL}/sales/${ticketId}/split`, {
                method: 'POST', headers: TH,
                body: JSON.stringify({ items: splitPayload }),
            });
            const data = await res.json();

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
            setShowSplit(false);
            setSplitQtys({});
        } catch {
            showToast('Error al dividir el ticket');
        } finally { setSplitting(false); }
    };

    // ═══════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════

    // --- Payment overlay ---
    if (showPayment) {
        if (paySuccess) {
            return (
                <div className="h-full flex flex-col items-center justify-center animate-fade-in" style={{ background: '#121413' }}>
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'rgba(28,64,46,0.3)' }}>
                        <Check className="w-10 h-10" style={{ color: '#93B59D' }} strokeWidth={3} />
                    </div>
                    <h2 className="text-2xl font-bold mb-2" style={{ color: '#F4F0EA' }}>Listo!</h2>
                    <p className="font-mono text-3xl font-bold mb-2" style={{ color: '#93B59D' }}>${cartTotal.toFixed(2)}</p>
                    <p className="text-sm mb-6" style={{ color: 'rgba(244,240,234,0.3)' }}>Venta registrada</p>

                    {/* Print receipt button */}
                    {printerConnected && lastReceipt && (
                        <button
                            onClick={() => printReceipt(lastReceipt).catch(() => showToast('Error al imprimir'))}
                            disabled={printing}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
                            style={{
                                background: printing ? 'rgba(147,181,157,0.08)' : 'rgba(147,181,157,0.15)',
                                color: '#93B59D',
                                border: '1px solid rgba(147,181,157,0.2)',
                            }}
                        >
                            <Printer className="w-4 h-4" />
                            {printing ? 'Imprimiendo...' : 'Imprimir Cuenta'}
                        </button>
                    )}

                    {printerConnected && printing && (
                        <p className="text-[10px] mt-3" style={{ color: 'rgba(244,240,234,0.2)' }}>
                            Enviando a impresora...
                        </p>
                    )}
                </div>
            );
        }

        return (
            <div className="h-full flex flex-col" style={{ background: '#121413' }}>
                {/* Payment header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.05] shrink-0">
                    <button onClick={() => setShowPayment(false)}
                        className="p-2 rounded-xl" style={{ background: 'rgba(244,240,234,0.04)' }}>
                        <ArrowLeft className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.5)' }} />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-bold" style={{ color: '#F4F0EA' }}>Cobrar</h1>
                        <p className="text-xs" style={{ color: 'rgba(244,240,234,0.3)' }}>
                            {ticketName}{tableName ? ` - ${tableName}` : ''}
                        </p>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left: summary */}
                    <div className="flex-1 p-8 flex flex-col items-center justify-center">
                        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'rgba(244,240,234,0.25)' }}>Total a cobrar</p>
                        <p className="text-6xl font-bold font-mono tabular-nums tracking-tight mb-4" style={{ color: '#F4F0EA' }}>
                            ${cartTotal.toFixed(2)}
                        </p>
                        <p className="text-sm mb-8" style={{ color: 'rgba(244,240,234,0.2)' }}>
                            {cartCount} items
                        </p>

                        {/* Items summary */}
                        <div className="w-full max-w-sm rounded-xl p-4 space-y-1" style={{ background: 'rgba(244,240,234,0.03)', border: '1px solid rgba(244,240,234,0.06)' }}>
                            {items.map(item => (
                                <div key={item.productId} className="flex items-center justify-between text-sm py-1">
                                    <span className="truncate flex-1" style={{ color: 'rgba(244,240,234,0.45)' }}>{item.name} x{item.quantity}</span>
                                    <span className="font-mono ml-2 tabular-nums" style={{ color: 'rgba(244,240,234,0.6)' }}>${(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: method selection + change calculator */}
                    <div className="w-[420px] border-l border-white/[0.05] p-6 flex flex-col overflow-y-auto">
                        <p className="text-xs uppercase tracking-widest font-semibold mb-4" style={{ color: 'rgba(244,240,234,0.2)' }}>
                            Metodo de Pago
                        </p>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {PAY_METHODS.map(m => {
                                const Icon = m.icon;
                                const active = payMethod === m.id;
                                return (
                                    <button key={m.id} onClick={() => { setPayMethod(m.id); if (m.id !== 'cash') { setCashUSD(''); setCashCOP(''); setGiveBackUSD(0); } }}
                                        className="p-3 rounded-xl flex items-center gap-2.5 transition-all"
                                        style={{
                                            background: active ? 'rgba(28,64,46,0.15)' : 'rgba(244,240,234,0.03)',
                                            border: `1px solid ${active ? 'rgba(147,181,157,0.2)' : 'rgba(244,240,234,0.06)'}`,
                                        }}>
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                            style={{ background: active ? 'rgba(28,64,46,0.3)' : 'rgba(244,240,234,0.04)' }}>
                                            <Icon className="w-4 h-4" style={{ color: active ? '#93B59D' : 'rgba(244,240,234,0.4)' }} />
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: active ? '#93B59D' : 'rgba(244,240,234,0.4)' }}>
                                            {m.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* ── Multi-Currency Cash Workbench ── */}
                        {payMethod === 'cash' && (() => {
                            const copRate = getRate('COP');
                            const recUSD = parseFloat(cashUSD) || 0;
                            const recCOP = parseFloat(cashCOP) || 0;
                            const recCOPasUSD = copRate > 0 ? recCOP / copRate : 0;
                            const totalReceivedUSD = recUSD + recCOPasUSD;
                            const changeUSD = +(totalReceivedUSD - cartTotal).toFixed(2);
                            const hasInput = recUSD > 0 || recCOP > 0;
                            const isExact = hasInput && Math.abs(changeUSD) < 0.005;
                            const hasChange = hasInput && changeUSD > 0.005;
                            const insufficient = hasInput && changeUSD < -0.005;

                            // Smart auto-calc: max USD to give back (in $5 increments, no $1s)
                            const maxUSDBack = Math.floor(changeUSD / 5) * 5;
                            // If giveBackUSD was never set or exceeds max, auto-set
                            const effectiveGiveUSD = hasChange ? Math.min(giveBackUSD || maxUSDBack, maxUSDBack) : 0;

                            // Remainder in COP
                            const remainderUSD = +(changeUSD - effectiveGiveUSD).toFixed(2);
                            const remainderCOP = remainderUSD > 0 ? Math.ceil((remainderUSD * copRate) / 100) * 100 : 0;

                            // USD bill breakdown for the effectiveGiveUSD amount
                            const USD_BILLS = [100, 50, 20, 10, 5];
                            const usdBills: { bill: number; count: number }[] = [];
                            let rem = effectiveGiveUSD;
                            for (const bill of USD_BILLS) {
                                if (rem >= bill) {
                                    const count = Math.floor(rem / bill);
                                    usdBills.push({ bill, count });
                                    rem = +(rem - count * bill).toFixed(2);
                                }
                            }

                            // Quick-pick USD bills
                            const usdQuick = [5, 10, 20, 50, 100].filter(b => b >= cartTotal);

                            // Quick-pick COP amounts (common bills in Colombia)
                            const copQuickValues = [10000, 20000, 50000, 100000];
                            // Also show the total in COP as a quick pick
                            const totalInCOP = Math.ceil((cartTotal * copRate) / 1000) * 1000;

                            // Numpad handler
                            const handleNumpad = (key: string) => {
                                const target = activeInput;
                                if (!target) return;
                                const setter = target === 'usd' ? setCashUSD : setCashCOP;
                                const current = target === 'usd' ? cashUSD : cashCOP;
                                if (key === 'C') { setter(''); setGiveBackUSD(0); return; }
                                if (key === '⌫') { setter(current.slice(0, -1)); setGiveBackUSD(0); return; }
                                if (key === '.' && current.includes('.')) return;
                                setter(current + key);
                                setGiveBackUSD(0);
                            };

                            // COP bill breakdown for change
                            const COP_BILLS = [100000, 50000, 20000, 10000, 5000, 2000, 1000];
                            const copBillBreakdown: { bill: number; count: number }[] = [];
                            let copRem = remainderCOP;
                            for (const bill of COP_BILLS) {
                                if (copRem >= bill) {
                                    const count = Math.floor(copRem / bill);
                                    copBillBreakdown.push({ bill, count });
                                    copRem -= count * bill;
                                }
                            }

                            return (
                                <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: 'rgba(244,240,234,0.03)', border: '1px solid rgba(244,240,234,0.06)' }}>
                                    <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'rgba(244,240,234,0.3)' }}>
                                        Calculadora de cambio
                                    </p>

                                    {/* ── USD received ── */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <Banknote className="w-3.5 h-3.5" style={{ color: '#93B59D' }} />
                                            <span className="text-[10px] font-bold uppercase" style={{ color: 'rgba(244,240,234,0.35)' }}>Recibido USD</span>
                                        </div>
                                        <button
                                            onClick={() => setActiveInput(activeInput === 'usd' ? null : 'usd')}
                                            className="w-full flex items-center gap-2 mb-1.5 px-3 py-2.5 rounded-xl transition-all"
                                            style={{
                                                background: activeInput === 'usd' ? 'rgba(28,64,46,0.2)' : 'rgba(244,240,234,0.04)',
                                                border: `1.5px solid ${activeInput === 'usd' ? 'rgba(147,181,157,0.4)' : 'rgba(244,240,234,0.08)'}`,
                                            }}>
                                            <span className="text-base font-bold" style={{ color: 'rgba(244,240,234,0.3)' }}>$</span>
                                            <span className="flex-1 text-left text-xl font-bold font-mono tabular-nums" style={{ color: cashUSD ? '#F4F0EA' : 'rgba(244,240,234,0.15)' }}>
                                                {cashUSD || '0'}
                                            </span>
                                            {activeInput === 'usd' && <span className="w-0.5 h-5 rounded-full bg-[#93B59D] animate-pulse" />}
                                        </button>
                                        <div className="flex gap-1 flex-wrap">
                                            {usdQuick.map(bill => (
                                                <button key={bill} onClick={() => { setCashUSD(String(bill)); setGiveBackUSD(0); setActiveInput(null); }}
                                                    className="px-2.5 py-1 rounded-md text-[11px] font-bold font-mono transition-all"
                                                    style={{
                                                        background: cashUSD === String(bill) ? 'rgba(28,64,46,0.3)' : 'rgba(244,240,234,0.04)',
                                                        border: `1px solid ${cashUSD === String(bill) ? 'rgba(147,181,157,0.3)' : 'rgba(244,240,234,0.06)'}`,
                                                        color: cashUSD === String(bill) ? '#93B59D' : 'rgba(244,240,234,0.4)',
                                                    }}>
                                                    ${bill}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* ── COP received ── */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <Wallet className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
                                            <span className="text-[10px] font-bold uppercase" style={{ color: 'rgba(244,240,234,0.35)' }}>Recibido COP</span>
                                            {recCOP > 0 && (
                                                <span className="text-[10px] font-mono ml-auto" style={{ color: 'rgba(244,240,234,0.2)' }}>
                                                    = ${recCOPasUSD.toFixed(2)} USD
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setActiveInput(activeInput === 'cop' ? null : 'cop')}
                                            className="w-full flex items-center gap-2 mb-1.5 px-3 py-2.5 rounded-xl transition-all"
                                            style={{
                                                background: activeInput === 'cop' ? 'rgba(245,158,11,0.08)' : 'rgba(244,240,234,0.04)',
                                                border: `1.5px solid ${activeInput === 'cop' ? 'rgba(245,158,11,0.4)' : 'rgba(244,240,234,0.08)'}`,
                                            }}>
                                            <span className="text-base font-bold" style={{ color: 'rgba(244,240,234,0.3)' }}>Bs</span>
                                            <span className="flex-1 text-left text-xl font-bold font-mono tabular-nums" style={{ color: cashCOP ? '#f59e0b' : 'rgba(244,240,234,0.15)' }}>
                                                {cashCOP ? Number(cashCOP).toLocaleString('es-CO') : '0'}
                                            </span>
                                            {activeInput === 'cop' && <span className="w-0.5 h-5 rounded-full bg-amber-400 animate-pulse" />}
                                        </button>
                                        <div className="flex gap-1 flex-wrap">
                                            {copQuickValues.map(v => (
                                                <button key={v} onClick={() => { setCashCOP(String(v)); setGiveBackUSD(0); setActiveInput(null); }}
                                                    className="px-2.5 py-1 rounded-md text-[11px] font-bold font-mono transition-all"
                                                    style={{
                                                        background: cashCOP === String(v) ? 'rgba(245,158,11,0.15)' : 'rgba(244,240,234,0.04)',
                                                        border: `1px solid ${cashCOP === String(v) ? 'rgba(245,158,11,0.3)' : 'rgba(244,240,234,0.06)'}`,
                                                        color: cashCOP === String(v) ? '#f59e0b' : 'rgba(244,240,234,0.4)',
                                                    }}>
                                                    {(v / 1000).toFixed(0)}K
                                                </button>
                                            ))}
                                            <button onClick={() => { setCashCOP(String(totalInCOP)); setGiveBackUSD(0); setActiveInput(null); }}
                                                className="px-2.5 py-1 rounded-md text-[11px] font-bold font-mono transition-all"
                                                style={{
                                                    background: 'rgba(244,240,234,0.04)',
                                                    border: '1px solid rgba(244,240,234,0.06)',
                                                    color: 'rgba(244,240,234,0.4)',
                                                }}>
                                                Exacto
                                            </button>
                                        </div>
                                    </div>

                                    {/* ── Dark Numpad ── */}
                                    {activeInput && (
                                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                                            {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(key => (
                                                <button key={key} onClick={() => handleNumpad(key)}
                                                    className="py-3 rounded-xl text-lg font-bold font-mono transition-all active:scale-95"
                                                    style={{
                                                        background: key === '⌫' ? 'rgba(239,68,68,0.08)' : 'rgba(244,240,234,0.05)',
                                                        border: `1px solid ${key === '⌫' ? 'rgba(239,68,68,0.15)' : 'rgba(244,240,234,0.08)'}`,
                                                        color: key === '⌫' ? '#ef4444' : 'rgba(244,240,234,0.7)',
                                                    }}>
                                                    {key}
                                                </button>
                                            ))}
                                            <button onClick={() => handleNumpad('C')}
                                                className="col-span-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
                                                style={{ background: 'rgba(244,240,234,0.03)', border: '1px solid rgba(244,240,234,0.06)', color: 'rgba(244,240,234,0.3)' }}>
                                                Limpiar
                                            </button>
                                        </div>
                                    )}

                                    {/* ── Total received summary ── */}
                                    {hasInput && (
                                        <div className="flex items-center justify-between py-1.5 px-2 rounded-lg" style={{ background: 'rgba(244,240,234,0.03)' }}>
                                            <span className="text-[10px] font-bold uppercase" style={{ color: 'rgba(244,240,234,0.25)' }}>Total recibido</span>
                                            <span className="text-sm font-bold font-mono" style={{ color: 'rgba(244,240,234,0.7)' }}>
                                                ${totalReceivedUSD.toFixed(2)} USD
                                            </span>
                                        </div>
                                    )}

                                    {/* ── Insufficient ── */}
                                    {insufficient && (
                                        <div className="flex items-center gap-2 py-2 px-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                            <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#ef4444' }} />
                                            <div>
                                                <span className="text-sm font-medium" style={{ color: '#ef4444' }}>
                                                    Faltan ${Math.abs(changeUSD).toFixed(2)} USD
                                                </span>
                                                <span className="text-xs block" style={{ color: 'rgba(239,68,68,0.6)' }}>
                                                    = {formatLocal(Math.ceil(Math.abs(changeUSD) * copRate / 100) * 100, 'COP')} COP
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Exact ── */}
                                    {isExact && (
                                        <div className="flex items-center gap-2 py-2 px-3 rounded-lg" style={{ background: 'rgba(147,181,157,0.08)', border: '1px solid rgba(147,181,157,0.15)' }}>
                                            <Check className="w-4 h-4 shrink-0" style={{ color: '#93B59D' }} />
                                            <span className="text-sm font-semibold" style={{ color: '#93B59D' }}>Monto exacto</span>
                                        </div>
                                    )}

                                    {/* ── Change breakdown with adjustable USD ── */}
                                    {hasChange && (
                                        <div className="space-y-2 rounded-lg p-3" style={{ background: 'rgba(147,181,157,0.06)', border: '1px solid rgba(147,181,157,0.12)' }}>
                                            {/* Change header */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold uppercase" style={{ color: 'rgba(244,240,234,0.35)' }}>Cambio total</span>
                                                <span className="text-lg font-bold font-mono" style={{ color: '#93B59D' }}>
                                                    ${changeUSD.toFixed(2)}
                                                </span>
                                            </div>

                                            {/* Adjustable USD to give back */}
                                            <div className="pt-2" style={{ borderTop: '1px solid rgba(244,240,234,0.06)' }}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] font-bold uppercase" style={{ color: 'rgba(147,181,157,0.7)' }}>
                                                        Devolver en USD
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => setGiveBackUSD(Math.max(0, effectiveGiveUSD - 5))}
                                                            className="w-6 h-6 rounded flex items-center justify-center"
                                                            style={{ background: 'rgba(244,240,234,0.06)' }}>
                                                            <Minus className="w-3 h-3" style={{ color: 'rgba(244,240,234,0.5)' }} />
                                                        </button>
                                                        <span className="text-base font-bold font-mono w-14 text-center" style={{ color: '#93B59D' }}>
                                                            ${effectiveGiveUSD}
                                                        </span>
                                                        <button onClick={() => setGiveBackUSD(Math.min(maxUSDBack, effectiveGiveUSD + 5))}
                                                            className="w-6 h-6 rounded flex items-center justify-center"
                                                            style={{ background: 'rgba(244,240,234,0.06)' }}>
                                                            <Plus className="w-3 h-3" style={{ color: 'rgba(244,240,234,0.5)' }} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* USD bill breakdown */}
                                                {usdBills.length > 0 && (
                                                    <div className="space-y-0.5 mb-2">
                                                        {usdBills.map(b => (
                                                            <div key={b.bill} className="flex items-center justify-between pl-1">
                                                                <span className="text-xs font-mono" style={{ color: 'rgba(244,240,234,0.5)' }}>
                                                                    Billete ${b.bill}
                                                                </span>
                                                                <span className="text-xs font-bold font-mono" style={{ color: 'rgba(244,240,234,0.7)' }}>x{b.count}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* COP remainder + bill breakdown */}
                                                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(245,158,11,0.15)' }}>
                                                    <div className="flex items-center justify-between py-2 px-2" style={{ background: 'rgba(245,158,11,0.08)' }}>
                                                        <div className="flex items-center gap-1.5">
                                                            <Wallet className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
                                                            <span className="text-xs font-semibold" style={{ color: 'rgba(244,240,234,0.5)' }}>
                                                                {effectiveGiveUSD > 0 ? 'Resto en pesos' : 'Todo en pesos'}
                                                            </span>
                                                        </div>
                                                        <span className="text-base font-bold font-mono" style={{ color: '#f59e0b' }}>
                                                            {formatLocal(remainderCOP, 'COP')}
                                                        </span>
                                                    </div>
                                                    {copBillBreakdown.length > 0 && remainderCOP > 0 && (
                                                        <div className="px-3 py-1.5 space-y-0.5" style={{ background: 'rgba(245,158,11,0.03)' }}>
                                                            {copBillBreakdown.map(b => (
                                                                <div key={b.bill} className="flex items-center justify-between">
                                                                    <span className="text-[11px] font-mono" style={{ color: 'rgba(244,240,234,0.4)' }}>
                                                                        Billete {(b.bill / 1000).toFixed(0)}K
                                                                    </span>
                                                                    <span className="text-[11px] font-bold font-mono" style={{ color: '#f59e0b' }}>x{b.count}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Quick adjust: all in COP / max in USD */}
                                                <div className="flex gap-1.5 pt-2">
                                                    <button onClick={() => setGiveBackUSD(0)}
                                                        className="flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all"
                                                        style={{
                                                            background: effectiveGiveUSD === 0 ? 'rgba(245,158,11,0.12)' : 'rgba(244,240,234,0.04)',
                                                            border: `1px solid ${effectiveGiveUSD === 0 ? 'rgba(245,158,11,0.25)' : 'rgba(244,240,234,0.06)'}`,
                                                            color: effectiveGiveUSD === 0 ? '#f59e0b' : 'rgba(244,240,234,0.35)',
                                                        }}>
                                                        Todo COP
                                                    </button>
                                                    <button onClick={() => setGiveBackUSD(maxUSDBack)}
                                                        className="flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all"
                                                        style={{
                                                            background: effectiveGiveUSD === maxUSDBack && maxUSDBack > 0 ? 'rgba(147,181,157,0.12)' : 'rgba(244,240,234,0.04)',
                                                            border: `1px solid ${effectiveGiveUSD === maxUSDBack && maxUSDBack > 0 ? 'rgba(147,181,157,0.25)' : 'rgba(244,240,234,0.06)'}`,
                                                            color: effectiveGiveUSD === maxUSDBack && maxUSDBack > 0 ? '#93B59D' : 'rgba(244,240,234,0.35)',
                                                        }}>
                                                        Max USD
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        <div className="flex-1" />

                        <button onClick={handlePay} disabled={paying || items.length === 0}
                            className="w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                            style={{ background: 'linear-gradient(135deg, #1C402E, #255639)', color: '#F4F0EA', boxShadow: '0 8px 32px rgba(28,64,46,0.4)' }}>
                            {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Confirmar ${cartTotal.toFixed(2)}</>}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- Split overlay ---
    if (showSplit) {
        const splitItems = items.map(item => ({ ...item, moveQty: splitQtys[item.productId] || 0 }));
        const splitTotal = splitItems.reduce((s, i) => s + i.price * i.moveQty, 0);
        const originalTotal = cartTotal - splitTotal;
        const hasSplitItems = splitItems.some(i => i.moveQty > 0);

        return (
            <div className="h-full flex flex-col" style={{ background: '#121413' }}>
                <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.05] shrink-0">
                    <button onClick={() => { setShowSplit(false); setSplitQtys({}); }}
                        className="p-2 rounded-xl" style={{ background: 'rgba(244,240,234,0.04)' }}>
                        <ArrowLeft className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.5)' }} />
                    </button>
                    <Scissors className="w-4 h-4" style={{ color: '#f59e0b' }} />
                    <h1 className="text-lg font-bold" style={{ color: '#F4F0EA' }}>Split Ticket</h1>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left: items */}
                    <div className="flex-1 overflow-y-auto">
                        <div className="px-6 py-3 flex items-center gap-4 border-b border-white/[0.06]" style={{ background: 'rgba(244,240,234,0.02)' }}>
                            <div className="flex-1">
                                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(244,240,234,0.3)' }}>Original</p>
                                <p className="text-xl font-bold font-mono" style={{ color: '#93B59D' }}>${originalTotal.toFixed(2)}</p>
                            </div>
                            <ArrowRightLeft className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.15)' }} />
                            <div className="flex-1 text-right">
                                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(244,240,234,0.3)' }}>Split</p>
                                <p className="text-xl font-bold font-mono" style={{ color: hasSplitItems ? '#f59e0b' : 'rgba(244,240,234,0.15)' }}>${splitTotal.toFixed(2)}</p>
                            </div>
                        </div>
                        <p className="px-6 py-2 text-xs" style={{ color: 'rgba(244,240,234,0.25)' }}>
                            Toca items para moverlos al nuevo ticket. Toca de nuevo para ajustar cantidad.
                        </p>
                        {splitItems.map(item => {
                            const isFullyMoved = item.moveQty === item.quantity;
                            const isPartial = item.moveQty > 0 && !isFullyMoved;
                            return (
                                <button key={item.productId}
                                    onClick={() => {
                                        setSplitQtys(prev => {
                                            const current = prev[item.productId] || 0;
                                            const next = current >= item.quantity ? 0 : current + 1;
                                            return { ...prev, [item.productId]: next };
                                        });
                                    }}
                                    className="w-full flex items-center gap-3 px-6 py-4 text-left transition-all active:bg-white/5"
                                    style={{
                                        borderBottom: '1px solid rgba(244,240,234,0.04)',
                                        background: isFullyMoved ? 'rgba(245,158,11,0.06)' : isPartial ? 'rgba(245,158,11,0.03)' : 'transparent',
                                    }}>
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                                        style={{
                                            border: `2px solid ${isFullyMoved || isPartial ? '#f59e0b' : 'rgba(147,181,157,0.4)'}`,
                                            background: isFullyMoved ? '#f59e0b' : 'transparent',
                                        }}>
                                        {isPartial && <div className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} />}
                                        {isFullyMoved && <span className="text-[9px] font-bold" style={{ color: '#121413' }}>&#10003;</span>}
                                    </div>
                                    <span className="flex-1 text-sm" style={{
                                        color: isFullyMoved ? 'rgba(244,240,234,0.4)' : 'rgba(244,240,234,0.85)',
                                        textDecoration: isFullyMoved ? 'line-through' : 'none',
                                    }}>{item.name}</span>
                                    <span className="text-xs font-mono shrink-0" style={{ color: isPartial ? '#f59e0b' : 'rgba(244,240,234,0.35)' }}>
                                        {isPartial ? `${item.moveQty}/${item.quantity}` : `x${item.quantity}`}
                                    </span>
                                    <span className="text-sm font-mono w-16 text-right shrink-0" style={{ color: item.moveQty > 0 ? '#f59e0b' : 'rgba(244,240,234,0.4)' }}>
                                        ${(item.price * item.quantity).toFixed(2)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Right: confirm */}
                    <div className="w-[320px] border-l border-white/[0.05] p-6 flex flex-col items-center justify-center">
                        <button onClick={handleConfirmSplit} disabled={!hasSplitItems || splitting}
                            className="w-full py-4 rounded-xl text-sm font-bold transition-all disabled:opacity-30"
                            style={{
                                background: hasSplitItems ? 'linear-gradient(135deg, #92400e, #b45309)' : 'rgba(244,240,234,0.04)',
                                color: hasSplitItems ? '#fef3c7' : 'rgba(244,240,234,0.2)',
                                border: `1px solid ${hasSplitItems ? 'rgba(245,158,11,0.3)' : 'rgba(244,240,234,0.06)'}`,
                            }}>
                            {splitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                                <><Scissors className="w-4 h-4 inline mr-2" style={{ verticalAlign: '-2px' }} />Confirmar Split - ${splitTotal.toFixed(2)}</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- Table selector overlay ---
    if (showTableSelector) {
        const available = tables.filter(t =>
            (!t.isOccupied || t.currentTicket?.id === ticketId) &&
            (!tableSearch || t.name.toLowerCase().includes(tableSearch.toLowerCase()))
        );

        return (
            <div className="h-full flex flex-col" style={{ background: '#121413' }}>
                <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.05] shrink-0">
                    <button onClick={() => { setShowTableSelector(false); setTableSearch(''); }}
                        className="p-2 rounded-xl" style={{ background: 'rgba(244,240,234,0.04)' }}>
                        <X className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.5)' }} />
                    </button>
                    <h1 className="text-lg font-bold" style={{ color: '#F4F0EA' }}>Asignar Mesa</h1>
                </div>
                <div className="px-6 py-3 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(244,240,234,0.15)' }} />
                        <input type="text" placeholder="Buscar mesa..." value={tableSearch}
                            onChange={e => setTableSearch(e.target.value)}
                            className="w-full rounded-xl pl-9 py-2.5 text-sm focus:outline-none"
                            style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)', color: '#F4F0EA' }} />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {/* Custom ticket option */}
                    {!tableSearch && (
                        <button onClick={() => handleSave(undefined, undefined)}
                            disabled={saving}
                            className="w-full px-6 py-4 text-left text-sm font-semibold tracking-wide"
                            style={{ borderBottom: '1px solid rgba(244,240,234,0.04)', color: '#93B59D' }}>
                            {saving ? 'Guardando...' : 'TICKET SIN MESA'}
                        </button>
                    )}
                    {available.map(t => (
                        <button key={t.id} onClick={() => handleSave(t.id, t.name)}
                            disabled={saving}
                            className="w-full px-6 py-4 text-left text-base flex items-center justify-between"
                            style={{ borderBottom: '1px solid rgba(244,240,234,0.04)', color: saving ? 'rgba(244,240,234,0.3)' : '#F4F0EA' }}>
                            <span>{t.name}</span>
                            {t.zone && <span className="text-xs" style={{ color: 'rgba(244,240,234,0.2)' }}>{t.zone}</span>}
                        </button>
                    ))}
                    {available.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12" style={{ color: 'rgba(244,240,234,0.25)' }}>
                            <p className="text-sm">{tableSearch ? `No se encontro "${tableSearch}"` : 'No hay mesas disponibles'}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- Open tickets overlay ---
    if (showTickets) {
        return (
            <div className="h-full flex flex-col" style={{ background: '#121413' }}>
                <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.05] shrink-0">
                    <button onClick={() => setShowTickets(false)}
                        className="p-2 rounded-xl" style={{ background: 'rgba(244,240,234,0.04)' }}>
                        <ArrowLeft className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.5)' }} />
                    </button>
                    <FileText className="w-4 h-4" style={{ color: '#93B59D' }} />
                    <h1 className="text-lg font-bold flex-1" style={{ color: '#F4F0EA' }}>Tickets Abiertos</h1>
                    <span className="text-xs font-mono px-2 py-1 rounded-lg" style={{ background: 'rgba(147,181,157,0.1)', color: '#93B59D' }}>
                        {openTickets.length}
                    </span>
                    <button onClick={fetchOpenTickets} className="p-2 rounded-xl" style={{ background: 'rgba(244,240,234,0.04)' }}>
                        <RefreshCw className={`w-4 h-4 ${loadingTickets ? 'animate-spin' : ''}`} style={{ color: 'rgba(244,240,234,0.4)' }} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loadingTickets && openTickets.length === 0 ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'rgba(147,181,157,0.4)' }} />
                        </div>
                    ) : openTickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20" style={{ color: 'rgba(244,240,234,0.25)' }}>
                            <FileText className="w-10 h-10 opacity-20 mb-3" />
                            <p className="text-sm">No hay tickets abiertos</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 p-5">
                            {openTickets.map(t => {
                                const elapsed = Math.floor((Date.now() - new Date(t.createdAt).getTime()) / 60000);
                                const timeStr = elapsed < 60 ? `${elapsed}m` : `${Math.floor(elapsed / 60)}h ${elapsed % 60}m`;
                                const isOld = elapsed > 60;
                                const statusColor = t.tableId
                                    ? (isOld ? '#f59e0b' : '#93B59D')
                                    : (isOld ? '#ef4444' : '#3b82f6');
                                const itemTotal = t.items.reduce((s, i) => s + i.quantity, 0);
                                return (
                                    <button key={t.id} onClick={() => handleLoadTicket(t)}
                                        className="p-4 rounded-2xl text-left transition-all active:scale-[0.97] hover:brightness-110"
                                        style={{
                                            background: 'rgba(244,240,234,0.03)',
                                            border: `1px solid ${statusColor}25`,
                                            boxShadow: `0 0 0 0 ${statusColor}00, inset 0 1px 0 ${statusColor}10`,
                                        }}>
                                        {/* Status dot + name */}
                                        <div className="flex items-center gap-2.5 mb-3">
                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}40` }} />
                                            <span className="text-sm font-bold truncate flex-1" style={{ color: '#F4F0EA' }}>
                                                {t.ticketName || t.tableName || `#${t.id.slice(-4)}`}
                                            </span>
                                        </div>

                                        {/* Amount */}
                                        <p className="text-2xl font-bold font-mono tabular-nums mb-3" style={{ color: '#F4F0EA' }}>
                                            ${t.totalAmount.toFixed(2)}
                                        </p>

                                        {/* Meta info */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {t.tableName && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold" style={{ background: `${statusColor}15`, color: statusColor }}>
                                                    {t.tableName}
                                                </span>
                                            )}
                                            <span className="text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1" style={{ background: 'rgba(244,240,234,0.04)', color: isOld ? '#f59e0b' : 'rgba(244,240,234,0.35)' }}>
                                                <Clock className="w-2.5 h-2.5" />
                                                {timeStr}
                                            </span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-md" style={{ background: 'rgba(244,240,234,0.04)', color: 'rgba(244,240,234,0.3)' }}>
                                                {itemTotal} item{itemTotal !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // MAIN LAYOUT: Product grid (left) + Cart sidebar (right)
    // ═══════════════════════════════════════════════════════════════
    return (
        <div className="h-full flex flex-col overflow-hidden">

            {/* ── Top toolbar ───────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.05] shrink-0" style={{ background: '#0e0e10' }}>
                {/* Hamburger menu */}
                <button onClick={() => setShowSideMenu(true)}
                    className="p-2 rounded-lg"
                    style={{ background: 'rgba(244,240,234,0.04)' }}>
                    <Menu className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.5)' }} />
                </button>

                {/* Category dropdown */}
                <div className="relative">
                    <button onClick={() => setShowCatDropdown(!showCatDropdown)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                        style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}>
                        {activeCategory && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getCatColor(activeCategory) }} />}
                        <span style={{ color: 'rgba(244,240,234,0.6)' }} className="whitespace-nowrap max-w-[120px] truncate">
                            {activeCategory || 'Todas'}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5" style={{ color: 'rgba(244,240,234,0.25)' }} />
                    </button>
                    {showCatDropdown && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowCatDropdown(false)} />
                            <div className="absolute top-full left-0 mt-1 w-56 rounded-xl z-50 max-h-64 overflow-y-auto shadow-2xl"
                                style={{ background: '#222524', border: '1px solid rgba(244,240,234,0.06)' }}>
                                <button onClick={() => { setActiveCategory(null); setSearch(''); setShowCatDropdown(false); }}
                                    className="w-full text-left px-4 py-3 text-sm flex items-center gap-2"
                                    style={{ color: !activeCategory ? '#93B59D' : 'rgba(244,240,234,0.5)', background: !activeCategory ? 'rgba(147,181,157,0.08)' : 'transparent' }}>
                                    Todas las categorias
                                </button>
                                {categories.map(cat => (
                                    <button key={cat} onClick={() => { setActiveCategory(cat); setSearch(''); setShowCatDropdown(false); }}
                                        className="w-full text-left px-4 py-3 text-sm flex items-center gap-2.5"
                                        style={{ color: activeCategory === cat ? '#93B59D' : 'rgba(244,240,234,0.5)', background: activeCategory === cat ? 'rgba(147,181,157,0.08)' : 'transparent' }}>
                                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: getCatColor(cat) }} />
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Search */}
                <div className="flex-1 relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(244,240,234,0.15)' }} />
                    <input type="text" placeholder="Buscar productos..." value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none"
                        style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)', color: '#F4F0EA' }} />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                            <X className="w-3.5 h-3.5" style={{ color: 'rgba(244,240,234,0.3)' }} />
                        </button>
                    )}
                </div>

                {/* View mode toggle */}
                <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(244,240,234,0.06)' }}>
                    <button onClick={() => handleSetViewMode('grid')}
                        className="px-2.5 py-2"
                        style={{ background: viewMode === 'grid' ? 'rgba(147,181,157,0.12)' : 'rgba(244,240,234,0.02)' }}>
                        <LayoutGrid className="w-4 h-4" style={{ color: viewMode === 'grid' ? '#93B59D' : 'rgba(244,240,234,0.25)' }} />
                    </button>
                    <button onClick={() => handleSetViewMode('list')}
                        className="px-2.5 py-2"
                        style={{ background: viewMode === 'list' ? 'rgba(147,181,157,0.12)' : 'rgba(244,240,234,0.02)' }}>
                        <List className="w-4 h-4" style={{ color: viewMode === 'list' ? '#93B59D' : 'rgba(244,240,234,0.25)' }} />
                    </button>
                </div>

                {/* Open tickets */}
                <button onClick={() => { fetchOpenTickets(); setShowTickets(true); }}
                    className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                    style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)', color: 'rgba(244,240,234,0.5)' }}>
                    <FileText className="w-3.5 h-3.5" />
                    Tickets
                </button>

                {/* Product count */}
                <span className="text-xs font-mono" style={{ color: 'rgba(244,240,234,0.2)' }}>
                    {filtered.length}
                </span>
            </div>

            {/* ── Goals banner ─────────────────────────────────────── */}
            {activeGoals.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-1.5 border-b border-white/[0.05] shrink-0 overflow-x-auto" style={{ background: 'rgba(147,181,157,0.04)' }}>
                    <Target className="w-3.5 h-3.5 shrink-0" style={{ color: '#93B59D' }} />
                    {activeGoals.map(g => {
                        const pct = Math.min(100, Math.round((g.currentQty / g.targetQty) * 100));
                        return (
                            <div key={g.id} className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] font-medium" style={{ color: 'rgba(244,240,234,0.5)' }}>
                                    {g.targetName}
                                </span>
                                <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(244,240,234,0.06)' }}>
                                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: g.isCompleted ? '#34D399' : '#93B59D' }} />
                                </div>
                                <span className="text-[10px] font-mono" style={{ color: g.isCompleted ? '#34D399' : 'rgba(244,240,234,0.35)' }}>
                                    {g.currentQty}/{g.targetQty}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Body: products + cart ─────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden">

                {/* LEFT: Product grid/list */}
                <div className="flex-1 overflow-y-auto p-3">
                    {loadingProducts ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'rgba(147,181,157,0.4)' }} />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40" style={{ color: 'rgba(244,240,234,0.25)' }}>
                            <Search className="w-8 h-8 mb-2 opacity-30" />
                            <p className="text-sm">No se encontraron productos</p>
                        </div>
                    ) : viewMode === 'grid' ? (
                        /* ── GRID VIEW ── */
                        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                            {filtered.map(product => {
                                const inCart = items.find(i => i.productId === product.id);
                                const cat = product.categoryId || product.category || 'General';
                                const catColor = getCatColor(cat);
                                return (
                                    <button key={product.id}
                                        onClick={() => handleAddProduct(product)}
                                        className="relative p-3 rounded-xl text-left transition-all active:scale-[0.96]"
                                        style={{
                                            background: inCart ? 'rgba(147,181,157,0.08)' : 'rgba(244,240,234,0.03)',
                                            border: `1px solid ${inCart ? 'rgba(147,181,157,0.2)' : 'rgba(244,240,234,0.06)'}`,
                                        }}>
                                        {/* Image placeholder / category color */}
                                        {product.imageUrl ? (
                                            <div className="w-full aspect-square rounded-lg mb-2 overflow-hidden bg-black/20">
                                                <img src={product.imageUrl} alt={product.name}
                                                    className="w-full h-full object-cover" loading="lazy" />
                                            </div>
                                        ) : (
                                            <div className="w-full aspect-[4/3] rounded-lg mb-2 flex items-center justify-center"
                                                style={{ background: `${catColor}15`, border: `1px solid ${catColor}20` }}>
                                                <span className="text-2xl opacity-30">
                                                    {product.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                        )}
                                        <p className="text-xs font-semibold leading-tight line-clamp-2 mb-1" style={{ color: 'rgba(244,240,234,0.85)' }}>
                                            {product.name}
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] uppercase tracking-wider" style={{ color: catColor, opacity: 0.6 }}>
                                                {cat.length > 10 ? cat.slice(0, 10) + '..' : cat}
                                            </span>
                                            <span className="text-sm font-bold font-mono" style={{ color: '#93B59D' }}>
                                                ${product.price.toFixed(2)}
                                            </span>
                                        </div>
                                        {inCart && (
                                            <div className="absolute top-2 right-2 w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center"
                                                style={{ background: '#1C402E', color: '#93B59D', boxShadow: '0 2px 8px rgba(28,64,46,0.3)' }}>
                                                {inCart.quantity}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        /* ── LIST VIEW ── */
                        <div>
                            {filtered.map(product => {
                                const inCart = items.find(i => i.productId === product.id);
                                const cat = product.categoryId || product.category || 'General';
                                const catColor = getCatColor(cat);
                                return (
                                    <button key={product.id}
                                        onClick={() => handleAddProduct(product)}
                                        className="w-full flex items-center gap-3.5 px-4 py-3 text-left transition-all"
                                        style={{
                                            borderBottom: '1px solid rgba(244,240,234,0.04)',
                                            background: inCart ? 'rgba(147,181,157,0.05)' : 'transparent',
                                        }}>
                                        <div className="w-10 h-10 rounded-lg shrink-0" style={{ backgroundColor: catColor }} />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm leading-tight block truncate" style={{ color: 'rgba(244,240,234,0.9)' }}>{product.name}</span>
                                            <span className="text-[10px]" style={{ color: 'rgba(244,240,234,0.25)' }}>{cat}</span>
                                        </div>
                                        {inCart && (
                                            <span className="shrink-0 w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center"
                                                style={{ background: '#1C402E', color: '#93B59D' }}>
                                                {inCart.quantity}
                                            </span>
                                        )}
                                        <span className="text-sm shrink-0 font-mono tabular-nums" style={{ color: 'rgba(244,240,234,0.4)' }}>
                                            ${product.price.toFixed(2)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* RIGHT: Cart sidebar */}
                <div className="w-[340px] lg:w-[380px] shrink-0 border-l border-white/[0.05] flex flex-col" style={{ background: '#0e0e10' }}>

                    {/* Cart header */}
                    <div className="px-4 py-3 border-b border-white/[0.05] shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                {editingName ? (
                                    <input type="text" autoFocus value={draftName}
                                        onChange={e => setDraftName(e.target.value)}
                                        onBlur={() => { if (draftName.trim()) setTicketName(draftName.trim()); setEditingName(false); }}
                                        onKeyDown={e => { if (e.key === 'Enter') { if (draftName.trim()) setTicketName(draftName.trim()); setEditingName(false); } }}
                                        className="text-sm font-bold bg-transparent focus:outline-none flex-1 min-w-0"
                                        style={{ color: '#F4F0EA', borderBottom: '1px solid #93B59D' }} />
                                ) : (
                                    <button onClick={() => { setDraftName(ticketName); setEditingName(true); }}
                                        className="text-sm font-bold truncate" style={{ color: '#F4F0EA' }}>
                                        {ticketName}
                                    </button>
                                )}
                                {cartCount > 0 && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0"
                                        style={{ background: 'rgba(147,181,157,0.12)', color: '#93B59D' }}>
                                        {cartCount}
                                    </span>
                                )}
                            </div>

                            {/* Cart actions */}
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                                {ticketId && (
                                    <button onClick={handleSync} title="Sincronizar"
                                        className="p-1.5 rounded-lg hover:bg-white/[0.05]" style={{ color: 'rgba(244,240,234,0.3)' }}>
                                        <RefreshCw className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {hasItems && (
                                    <button onClick={() => {
                                        if (!ticketId && hasItems) {
                                            setConfirmModal({
                                                title: 'Nuevo Ticket',
                                                message: 'Tienes items sin guardar. Descartar?',
                                                confirmLabel: 'Descartar',
                                                onConfirm: () => { clearCart(); setConfirmModal(null); },
                                            });
                                            return;
                                        }
                                        clearCart();
                                    }} title="Nuevo ticket"
                                        className="p-1.5 rounded-lg hover:bg-white/[0.05]" style={{ color: 'rgba(244,240,234,0.3)' }}>
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            {tableName && (
                                <div className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" style={{ color: '#93B59D' }} />
                                    <span className="text-[11px]" style={{ color: '#93B59D' }}>{tableName}</span>
                                </div>
                            )}
                            {/* Guest count selector */}
                            <div className="flex items-center gap-1 ml-auto">
                                <Users className="w-3 h-3" style={{ color: 'rgba(244,240,234,0.3)' }} />
                                <div className="flex items-center gap-0.5">
                                    <button onClick={() => setGuestCount(Math.max(1, (guestCount || 1) - 1))}
                                        className="w-5 h-5 rounded flex items-center justify-center text-[10px]"
                                        style={{ background: 'rgba(244,240,234,0.06)', color: 'rgba(244,240,234,0.4)' }}>-</button>
                                    <span className="text-[11px] w-4 text-center font-bold" style={{ color: guestCount ? '#93B59D' : 'rgba(244,240,234,0.2)' }}>
                                        {guestCount || '—'}
                                    </span>
                                    <button onClick={() => setGuestCount((guestCount || 0) + 1)}
                                        className="w-5 h-5 rounded flex items-center justify-center text-[10px]"
                                        style={{ background: 'rgba(244,240,234,0.06)', color: '#93B59D' }}>+</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Cart items */}
                    <div className="flex-1 overflow-y-auto">
                        {!hasItems ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                                <ShoppingBag className="w-10 h-10 opacity-10" style={{ color: '#F4F0EA' }} />
                                <p className="text-sm" style={{ color: 'rgba(244,240,234,0.25)' }}>Carrito vacio</p>
                                <p className="text-xs" style={{ color: 'rgba(244,240,234,0.15)' }}>Selecciona productos de la izquierda</p>
                            </div>
                        ) : (
                            <div>
                                {items.map(item => (
                                    <div key={item.productId}
                                        className={`px-4 py-3 transition-colors duration-300 ${lastAddedId === item.productId ? 'bg-[#1C402E]/30' : ''}`}
                                        style={{ borderBottom: '1px solid rgba(244,240,234,0.04)' }}>
                                        <div className="flex items-center gap-2">
                                            {/* Qty controls */}
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                                                    style={{ background: 'rgba(244,240,234,0.06)', color: '#F4F0EA' }}>
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <span className="w-5 text-center font-bold text-sm" style={{ color: '#F4F0EA' }}>
                                                    {item.quantity}
                                                </span>
                                                <button onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                                                    style={{ background: 'rgba(244,240,234,0.06)', color: '#93B59D' }}>
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                            {/* Name */}
                                            <span className="flex-1 text-sm truncate" style={{ color: 'rgba(244,240,234,0.85)' }}>
                                                {item.name}
                                            </span>
                                            {/* Note icon */}
                                            <button onClick={() => { setEditingNotesFor(item.productId); setDraftItemNote(item.notes || ''); }}
                                                className="p-1 shrink-0" style={{ color: item.notes ? '#93B59D' : 'rgba(244,240,234,0.15)' }}>
                                                <MessageSquare className="w-3.5 h-3.5" />
                                            </button>
                                            {/* Price */}
                                            <span className="font-mono text-sm tabular-nums shrink-0" style={{ color: 'rgba(244,240,234,0.5)' }}>
                                                ${(item.price * item.quantity).toFixed(2)}
                                            </span>
                                            {/* Remove */}
                                            <button onClick={() => removeItem(item.productId)}
                                                className="p-1 shrink-0" style={{ color: 'rgba(239,68,68,0.4)' }}>
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        {/* Item note display */}
                                        {item.notes && (
                                            <p className="text-[10px] ml-[72px] mt-0.5 italic" style={{ color: 'rgba(147,181,157,0.6)' }}>
                                                {item.notes}
                                            </p>
                                        )}
                                        {/* Inline note editor */}
                                        {editingNotesFor === item.productId && (
                                            <div className="flex items-center gap-1.5 ml-[72px] mt-1.5">
                                                <input
                                                    type="text" autoFocus
                                                    value={draftItemNote}
                                                    onChange={e => setDraftItemNote(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') { updateItemNotes(item.productId, draftItemNote); setEditingNotesFor(null); }
                                                        if (e.key === 'Escape') setEditingNotesFor(null);
                                                    }}
                                                    placeholder="sin chocolate, extra caliente..."
                                                    className="flex-1 text-[11px] bg-transparent border-b px-1 py-0.5 focus:outline-none"
                                                    style={{ color: '#F4F0EA', borderColor: '#93B59D' }}
                                                />
                                                <button onClick={() => { updateItemNotes(item.productId, draftItemNote); setEditingNotesFor(null); }}
                                                    className="p-1 rounded" style={{ color: '#93B59D' }}>
                                                    <Check className="w-3 h-3" />
                                                </button>
                                                <button onClick={() => setEditingNotesFor(null)}
                                                    className="p-1 rounded" style={{ color: 'rgba(244,240,234,0.3)' }}>
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Cart footer */}
                    {hasItems && (
                        <div className="border-t border-white/[0.05] p-3 space-y-2 shrink-0" style={{ background: 'rgba(0,0,0,0.2)' }}>
                            {/* Total */}
                            <div className="flex items-center justify-between px-1">
                                <span className="text-sm font-bold" style={{ color: '#F4F0EA' }}>Total</span>
                                <span className="text-xl font-bold font-mono tabular-nums" style={{ color: '#F4F0EA' }}>
                                    ${cartTotal.toFixed(2)}
                                </span>
                            </div>

                            {/* Action row */}
                            <div className="flex gap-2">
                                {/* More actions */}
                                {ticketId && items.length > 1 && (
                                    <button onClick={() => { setSplitQtys({}); setShowSplit(true); }}
                                        className="p-2.5 rounded-xl" title="Split"
                                        style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                                        <Scissors className="w-4 h-4" style={{ color: '#f59e0b' }} />
                                    </button>
                                )}
                                {ticketId && (
                                    <button onClick={handleVoid}
                                        className="p-2.5 rounded-xl" title="Anular"
                                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                        <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                                    </button>
                                )}

                                {/* Print receipt */}
                                {printerConnected && (
                                    <button
                                        onClick={() => {
                                            const printCurrencies: CurrencyRate[] = allCurrencies
                                                .filter(c => !c.isBase)
                                                .map(c => ({ code: c.code, symbol: c.symbol, exchangeRate: c.exchangeRate }));
                                            const receiptData: ReceiptData = {
                                                ticketName,
                                                tableName,
                                                employeeName: employee?.name?.split(' ')[0] || 'Staff',
                                                items: items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
                                                total: cartTotal,
                                                date: new Date(),
                                                currencies: printCurrencies,
                                            };
                                            printReceipt(receiptData)
                                                .then(() => showToast('Cuenta impresa', 'success'))
                                                .catch(() => showToast('Error al imprimir'));
                                        }}
                                        disabled={printing}
                                        className="p-2.5 rounded-xl" title="Imprimir Cuenta"
                                        style={{ background: 'rgba(147,181,157,0.08)', border: '1px solid rgba(147,181,157,0.15)' }}>
                                        <Printer className="w-4 h-4" style={{ color: '#93B59D' }} />
                                    </button>
                                )}

                                {/* Save/update */}
                                <button onClick={() => {
                                    if (ticketId) handleSave(tableId || undefined, tableName || undefined);
                                    else { setTableSearch(''); setShowTableSelector(true); }
                                }}
                                    disabled={saving}
                                    className="flex-1 py-3 rounded-xl text-sm font-semibold uppercase tracking-wider"
                                    style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)', color: 'rgba(244,240,234,0.5)' }}>
                                    {saving ? '...' : (ticketId ? 'Guardar' : 'Asignar')}
                                </button>

                                {/* Charge */}
                                <button onClick={() => setShowPayment(true)}
                                    className="flex-[1.5] py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                                    style={{ background: 'linear-gradient(135deg, #1C402E, #255639)', color: '#93B59D', boxShadow: '0 4px 16px rgba(28,64,46,0.3)' }}>
                                    Cobrar ${cartTotal.toFixed(2)}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Side Menu (hamburger) ─────────────────────────────── */}
            {showSideMenu && (
                <>
                    <div className="fixed inset-0 bg-black/70 z-50" onClick={() => setShowSideMenu(false)} />
                    <div className="fixed left-0 top-0 bottom-0 w-72 z-50 flex flex-col" style={{ background: '#1a1d1b', animation: 'slideRight 0.2s ease-out' }}>
                        {/* User info */}
                        <div className="p-5 pb-4 shrink-0" style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#1C402E' }}>
                                    <span className="font-bold text-lg" style={{ color: '#93B59D' }}>
                                        {(employee?.name || 'S')[0].toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <p className="font-semibold text-sm" style={{ color: '#F4F0EA' }}>{employee?.name || 'Staff'}</p>
                                    <p className="text-xs" style={{ color: 'rgba(244,240,234,0.4)' }}>{employee?.role || 'Employee'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Nav items */}
                        <nav className="py-2 flex-1">
                            {[
                                { label: 'Ventas', icon: ShoppingBag, active: true, action: () => setShowSideMenu(false) },
                                { label: 'Tickets Abiertos', icon: FileText, active: false, action: () => { setShowSideMenu(false); fetchOpenTickets(); setShowTickets(true); } },
                                { label: 'Nuevo Ticket', icon: Plus, active: false, action: () => {
                                    if (!ticketId && hasItems) {
                                        setConfirmModal({
                                            title: 'Nuevo Ticket',
                                            message: 'Tienes items sin guardar. Descartar?',
                                            confirmLabel: 'Descartar',
                                            onConfirm: () => { clearCart(); setConfirmModal(null); setShowSideMenu(false); },
                                        });
                                    } else {
                                        clearCart();
                                        setShowSideMenu(false);
                                    }
                                }},
                            ].map((item, i) => {
                                const Icon = item.icon;
                                return (
                                    <button key={i} onClick={item.action}
                                        className="w-full flex items-center gap-3 px-5 py-3.5 text-sm transition-colors"
                                        style={{ color: item.active ? '#93B59D' : 'rgba(244,240,234,0.6)', background: item.active ? 'rgba(147,181,157,0.08)' : 'transparent' }}>
                                        <Icon className="w-5 h-5" />
                                        {item.label}
                                    </button>
                                );
                            })}

                            {/* Printer section */}
                            <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(244,240,234,0.06)' }}>
                                <button
                                    onClick={() => {
                                        if (printerConnected) {
                                            disconnectPrinter();
                                        } else {
                                            connectPrinter();
                                            setShowSideMenu(false);
                                        }
                                    }}
                                    disabled={printerConnecting}
                                    className="w-full flex items-center gap-3 px-5 py-3.5 text-sm transition-colors"
                                    style={{ color: printerConnected ? '#93B59D' : 'rgba(244,240,234,0.6)' }}
                                >
                                    {printerConnected ? <Bluetooth className="w-5 h-5" /> : <BluetoothOff className="w-5 h-5" />}
                                    <div className="flex-1 text-left">
                                        <span>{printerConnecting ? 'Conectando...' : printerConnected ? 'Impresora' : 'Conectar Impresora'}</span>
                                        {printerConnected && printerName && (
                                            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(244,240,234,0.3)' }}>{printerName}</p>
                                        )}
                                    </div>
                                    {printerConnected && (
                                        <span className="w-2 h-2 rounded-full" style={{ background: '#93B59D' }} />
                                    )}
                                </button>
                            </div>
                        </nav>

                        {/* Session info */}
                        <div className="p-4 shrink-0" style={{ borderTop: '1px solid rgba(244,240,234,0.06)' }}>
                            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(244,240,234,0.2)' }}>Session</p>
                            <p className="text-xs" style={{ color: 'rgba(244,240,234,0.4)' }}>#{session?.id?.slice(-6) || '---'}</p>
                        </div>
                    </div>
                </>
            )}

            {/* ── Confirm Modal ─────────────────────────────────────── */}
            {confirmModal && (
                <ConfirmModal
                    title={confirmModal.title}
                    message={confirmModal.message}
                    confirmLabel={confirmModal.confirmLabel}
                    confirmColor={confirmModal.confirmColor}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                />
            )}

            {/* ── Toast ─────────────────────────────────────────────── */}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
