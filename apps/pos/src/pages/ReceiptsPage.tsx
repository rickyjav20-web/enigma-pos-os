import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, ArrowLeft, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface SalesItem {
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    productNameSnapshot: string;
}

interface SalesOrder {
    id: string;
    totalAmount: number;
    paymentMethod: string;
    status: string;
    ticketName?: string;
    tableName?: string;
    employeeId?: string;
    notes?: string;
    createdAt: string;
    items: SalesItem[];
}

// Ticket number from order id — sequential display number
function ticketNumber(order: SalesOrder, allOrders: SalesOrder[]): string {
    // Use the last 4 digits of a running counter based on position
    const sorted = [...allOrders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const idx = sorted.findIndex(o => o.id === order.id);
    const num = 9700 + (idx >= 0 ? idx + 1 : allOrders.length);
    return `#10-${num}`;
}

// Group orders by date
function groupByDate(orders: SalesOrder[]): { label: string; date: string; orders: SalesOrder[] }[] {
    const groups: Record<string, SalesOrder[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const order of orders) {
        const d = new Date(order.createdAt);
        d.setHours(0, 0, 0, 0);
        const key = d.toISOString().split('T')[0];
        if (!groups[key]) groups[key] = [];
        groups[key].push(order);
    }

    // Sort dates descending
    const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    return sortedKeys.map(key => {
        const d = new Date(key + 'T12:00:00');
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const label = `${dayNames[d.getDay()]}, ${d.getDate().toString().padStart(2, '0')} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        return { label, date: key, orders: groups[key] };
    });
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
}

function formatPrice(amount: number): string {
    return `$${amount.toFixed(2).replace('.', ',')}`;
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    const day = d.getDate();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear().toString().slice(2);
    return `${day}/${month}/${year}`;
}

const paymentIcon = (method: string) => {
    switch (method) {
        case 'cash': return '💵';
        case 'card': return '💳';
        case 'transfer': return '📱';
        default: return '💰';
    }
};

const paymentLabel = (method: string) => {
    switch (method) {
        case 'cash': return 'Efectivo';
        case 'card': return 'Tarjeta';
        case 'transfer': return 'Transferencia';
        default: return method;
    }
};

export default function ReceiptsPage() {
    const navigate = useNavigate();
    const { employee } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
    // Fetch completed sales
    const { data: salesData, isLoading } = useQuery({
        queryKey: ['receipts'],
        queryFn: async () => {
            const res = await api.get('/sales?status=completed');
            return res.data.data as SalesOrder[];
        },
        refetchOnWindowFocus: true,
    });

    const allOrders = salesData || [];

    // Filter by search
    const filteredOrders = searchQuery.trim()
        ? allOrders.filter(o => {
            const q = searchQuery.toLowerCase();
            const ticket = ticketNumber(o, allOrders).toLowerCase();
            const amount = formatPrice(o.totalAmount).toLowerCase();
            const name = (o.ticketName || '').toLowerCase();
            return ticket.includes(q) || amount.includes(q) || name.includes(q);
        })
        : allOrders;

    const groups = groupByDate(filteredOrders);

    // ─── Receipt Detail View ─────────────────────────────────────────────────
    if (selectedOrder) {
        const order = selectedOrder;
        const ticket = ticketNumber(order, allOrders);

        return (
            <div className="fixed inset-0 z-50 flex flex-col safe-top safe-bottom" style={{ background: '#121413' }}>
                {/* Header */}
                <header className="px-4 pt-3 pb-3 flex items-center justify-between shrink-0"
                    style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSelectedOrder(null)}
                            className="w-9 h-9 rounded-lg flex items-center justify-center"
                            style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}
                        >
                            <ArrowLeft className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.5)' }} />
                        </button>
                        <h1 className="text-base font-semibold" style={{ color: '#F4F0EA' }}>{ticket}</h1>
                    </div>
                    <span className="text-xs font-medium px-3 py-1.5 rounded-md"
                        style={{ background: 'rgba(244,240,234,0.04)', color: 'rgba(244,240,234,0.4)', border: '1px solid rgba(244,240,234,0.06)' }}>
                        REFUND
                    </span>
                </header>

                {/* Total */}
                <div className="text-center py-8" style={{ borderBottom: '1px solid rgba(244,240,234,0.08)' }}>
                    <p className="text-4xl font-bold" style={{ color: '#F4F0EA' }}>{formatPrice(order.totalAmount)}</p>
                    <p className="text-sm mt-1" style={{ color: 'rgba(244,240,234,0.35)' }}>Total</p>
                </div>

                {/* Order Info */}
                <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(244,240,234,0.08)' }}>
                    <p className="text-sm" style={{ color: 'rgba(244,240,234,0.6)' }}>
                        Pedido: {order.id.slice(0, 8)}
                    </p>
                    {employee && (
                        <p className="text-sm mt-0.5" style={{ color: 'rgba(244,240,234,0.6)' }}>
                            Empleado: {employee.fullName || 'Staff'}
                        </p>
                    )}
                    {order.tableName && (
                        <p className="text-sm mt-0.5" style={{ color: 'rgba(244,240,234,0.6)' }}>
                            Mesa: {order.tableName}
                        </p>
                    )}
                </div>

                {/* Order type */}
                {order.ticketName && (
                    <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(244,240,234,0.08)' }}>
                        <p className="text-sm font-semibold" style={{ color: '#F4F0EA' }}>
                            {order.ticketName}
                        </p>
                    </div>
                )}

                {/* Line items */}
                <div className="flex-1 overflow-y-auto px-5" style={{ borderBottom: '1px solid rgba(244,240,234,0.08)' }}>
                    <div className="py-3" style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }} />
                    {order.items.map((item) => (
                        <div key={item.id} className="py-3" style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="text-sm" style={{ color: '#F4F0EA' }}>{item.productNameSnapshot}</p>
                                    <p className="text-xs mt-0.5" style={{ color: 'rgba(244,240,234,0.35)' }}>
                                        {item.quantity} x {formatPrice(item.unitPrice)}
                                    </p>
                                </div>
                                <p className="text-sm font-medium" style={{ color: '#F4F0EA' }}>
                                    {formatPrice(item.totalPrice)}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Totals */}
                <div className="px-5 py-4 shrink-0" style={{ borderTop: '1px solid rgba(244,240,234,0.08)' }}>
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold" style={{ color: '#F4F0EA' }}>Total</p>
                        <p className="text-sm font-bold" style={{ color: '#F4F0EA' }}>{formatPrice(order.totalAmount)}</p>
                    </div>
                    <div className="flex items-center justify-between">
                        <p className="text-sm" style={{ color: 'rgba(244,240,234,0.5)' }}>{paymentLabel(order.paymentMethod)}</p>
                        <p className="text-sm" style={{ color: 'rgba(244,240,234,0.5)' }}>{formatPrice(order.totalAmount)}</p>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid rgba(244,240,234,0.06)' }}>
                        <p className="text-xs" style={{ color: 'rgba(244,240,234,0.3)' }}>
                            {formatDate(order.createdAt)}, {formatTime(order.createdAt)}
                        </p>
                        <p className="text-xs" style={{ color: 'rgba(244,240,234,0.3)' }}>{ticket}</p>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Receipts List ───────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 flex flex-col safe-top safe-bottom" style={{ background: '#121413' }}>
            {/* Header */}
            <header className="px-4 pt-3 pb-3 flex items-center gap-3 shrink-0"
                style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                <button
                    onClick={() => navigate('/')}
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}
                >
                    <Menu className="w-4.5 h-4.5" style={{ color: '#F4F0EA' }} strokeWidth={2} />
                </button>
                <h1 className="text-lg font-semibold flex-1" style={{ color: '#F4F0EA' }}>Receipts</h1>
            </header>

            {/* Search bar */}
            <div className="px-4 py-2 shrink-0" style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(244,240,234,0.3)' }} />
                    <input
                        type="text"
                        placeholder="Search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-9 py-2.5 rounded-lg text-sm outline-none"
                        style={{
                            background: 'rgba(244,240,234,0.04)',
                            color: '#F4F0EA',
                            border: '1px solid rgba(244,240,234,0.06)',
                        }}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                            <X className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.3)' }} />
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="w-6 h-6 border-2 rounded-full animate-spin"
                            style={{ borderColor: 'rgba(147,181,157,0.2)', borderTopColor: '#93B59D' }} />
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-2">
                        <p className="text-sm" style={{ color: 'rgba(244,240,234,0.3)' }}>
                            {searchQuery ? 'No results found' : 'No receipts yet'}
                        </p>
                    </div>
                ) : (
                    groups.map((group) => (
                        <div key={group.date}>
                            {/* Date header */}
                            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                                <p className="text-xs font-medium" style={{ color: '#93B59D' }}>{group.label}</p>
                            </div>

                            {/* Orders */}
                            {group.orders.map((order) => {
                                const ticket = ticketNumber(order, allOrders);
                                return (
                                    <button
                                        key={order.id}
                                        onClick={() => setSelectedOrder(order)}
                                        className="w-full px-4 py-3.5 flex items-center gap-3 text-left transition-colors active:bg-white/5"
                                        style={{ borderBottom: '1px solid rgba(244,240,234,0.04)' }}
                                    >
                                        {/* Payment method icon */}
                                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                            style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}>
                                            <span className="text-base">{paymentIcon(order.paymentMethod)}</span>
                                        </div>

                                        {/* Amount & time */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium" style={{ color: '#F4F0EA' }}>
                                                {formatPrice(order.totalAmount)}
                                            </p>
                                            <p className="text-xs mt-0.5" style={{ color: 'rgba(244,240,234,0.35)' }}>
                                                {formatTime(order.createdAt)}
                                            </p>
                                        </div>

                                        {/* Ticket number */}
                                        <p className="text-xs font-medium shrink-0" style={{ color: 'rgba(244,240,234,0.3)' }}>
                                            {ticket}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
