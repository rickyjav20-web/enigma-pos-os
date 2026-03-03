import { X, Search, Clock, MapPin } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useCartStore } from '../stores/cartStore';

interface Ticket {
    id: string;
    totalAmount: number;
    paymentMethod: string;
    status: string;
    createdAt: string;
    customerName?: string;
    notes?: string;
    ticketName?: string;
    tableName?: string;
    tableId?: string;
    items: { productId: string; productNameSnapshot: string; quantity: number; unitPrice: number }[];
}

export default function OpenTicketsPage() {
    const navigate = useNavigate();
    const { loadTicket } = useCartStore();
    const [search, setSearch] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    const { data: ticketsData, isLoading } = useQuery({
        queryKey: ['open-tickets'],
        queryFn: async () => {
            try {
                const { data } = await api.get('/sales?status=open');
                const list = Array.isArray(data) ? data : data?.data || [];
                return list as Ticket[];
            } catch { return [] as Ticket[]; }
        },
        refetchInterval: 10000,
    });

    const tickets = ticketsData || [];

    const filteredTickets = search
        ? tickets.filter(t => {
            const name = t.ticketName || t.customerName || t.notes || t.items?.[0]?.productNameSnapshot || '';
            return name.toLowerCase().includes(search.toLowerCase());
        })
        : tickets;

    const getElapsed = (created: string) => {
        const diff = Date.now() - new Date(created).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ${mins % 60}m`;
        return `${Math.floor(hrs / 24)}d`;
    };

    const getTimeColor = (created: string) => {
        const mins = (Date.now() - new Date(created).getTime()) / 60000;
        if (mins > 60) return '#ef4444';
        if (mins > 30) return '#f59e0b';
        return '#93B59D';
    };

    const getTicketName = (ticket: Ticket) => {
        if (ticket.ticketName) return ticket.ticketName;
        if (ticket.customerName) return ticket.customerName;
        if (ticket.notes) return ticket.notes.split('|')[0]?.trim() || `Ticket #${ticket.id.slice(-4)}`;
        return ticket.items?.[0]?.productNameSnapshot || `Ticket #${ticket.id.slice(-4)}`;
    };

    const handleSelectTicket = (ticket: Ticket) => {
        loadTicket({
            id: ticket.id,
            name: getTicketName(ticket),
            tableId: ticket.tableId,
            tableName: ticket.tableName,
            items: ticket.items?.map(i => ({
                productId: i.productId,
                name: i.productNameSnapshot,
                price: i.unitPrice,
                quantity: i.quantity,
            })) || [],
        });
        navigate('/sale');
    };

    return (
        <div className="min-h-dvh flex flex-col safe-top safe-bottom" style={{ background: '#121413' }}>
            <header className="px-4 pt-3 pb-3 flex items-center gap-3">
                <button onClick={() => navigate('/')}
                    className="w-9 h-9 rounded-lg flex items-center justify-center press"
                    style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}>
                    <X className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.5)' }} />
                </button>
                <div className="flex-1">
                    <h1 className="font-semibold text-[15px]" style={{ color: '#F4F0EA' }}>Open Tickets</h1>
                    <p className="text-[11px]" style={{ color: 'rgba(244,240,234,0.3)' }}>{tickets.length} active</p>
                </div>
                <button onClick={() => setShowSearch(!showSearch)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center press"
                    style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}>
                    <Search className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.4)' }} />
                </button>
            </header>

            {showSearch && (
                <div className="px-4 pb-3 animate-slide-up">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(244,240,234,0.15)' }} />
                        <input type="text" placeholder="Buscar ticket..." value={search}
                            onChange={e => setSearch(e.target.value)} autoFocus
                            className="w-full rounded-lg pl-9 pr-9 py-2.5 text-sm focus:outline-none"
                            style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)', color: '#F4F0EA' }} />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                                <X className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.3)' }} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            <main className="flex-1 overflow-y-auto px-4 pb-4">
                {isLoading ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="w-7 h-7 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(147,181,157,0.2)', borderTopColor: '#93B59D' }} />
                    </div>
                ) : filteredTickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-60 animate-fade-in" style={{ color: 'rgba(244,240,234,0.25)' }}>
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                            style={{ background: 'rgba(28,64,46,0.15)' }}>
                            <span className="text-2xl">📋</span>
                        </div>
                        <p className="text-sm font-medium">No open tickets</p>
                        <p className="text-xs mt-1" style={{ color: 'rgba(244,240,234,0.15)' }}>Saved tickets will appear here</p>
                        <button onClick={() => navigate('/')}
                            className="mt-5 px-6 py-2.5 rounded-xl text-sm font-semibold press"
                            style={{ background: '#1C402E', color: '#93B59D' }}>
                            New Sale
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredTickets.map((ticket, idx) => (
                            <button key={ticket.id} onClick={() => handleSelectTicket(ticket)}
                                className="w-full p-4 rounded-xl text-left press animate-slide-up flex items-center gap-3"
                                style={{
                                    background: 'rgba(244,240,234,0.03)',
                                    border: '1px solid rgba(244,240,234,0.06)',
                                    animationDelay: `${idx * 0.04}s`,
                                }}>
                                <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center"
                                    style={{ background: 'rgba(28,64,46,0.2)' }}>
                                    <span className="font-bold text-sm" style={{ color: '#93B59D' }}>
                                        {getTicketName(ticket)[0]?.toUpperCase() || '#'}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[14px] font-medium truncate" style={{ color: 'rgba(244,240,234,0.9)' }}>
                                        {getTicketName(ticket)}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <Clock className="w-3 h-3" style={{ color: getTimeColor(ticket.createdAt) }} />
                                        <span className="text-[11px]" style={{ color: getTimeColor(ticket.createdAt) }}>
                                            {getElapsed(ticket.createdAt)}
                                        </span>
                                        {ticket.tableName && (
                                            <>
                                                <span className="text-[10px]" style={{ color: 'rgba(244,240,234,0.1)' }}>·</span>
                                                <MapPin className="w-3 h-3" style={{ color: 'rgba(244,240,234,0.3)' }} />
                                                <span className="text-[11px]" style={{ color: 'rgba(244,240,234,0.3)' }}>{ticket.tableName}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="font-semibold text-[15px] font-mono tabular-nums" style={{ color: '#F4F0EA' }}>
                                        ${ticket.totalAmount?.toFixed(2) || '0.00'}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
