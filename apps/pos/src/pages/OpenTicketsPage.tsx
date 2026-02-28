import { X, Search, Clock, Zap } from 'lucide-react';
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
    items: { productNameSnapshot: string; quantity: number; unitPrice: number }[];
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
                return (Array.isArray(data) ? data : data?.data || []) as Ticket[];
            } catch {
                return [] as Ticket[];
            }
        },
        refetchInterval: 10000,
    });

    const tickets = ticketsData || [];

    const filteredTickets = search
        ? tickets.filter(t => {
            const name = t.customerName || t.notes || t.items?.[0]?.productNameSnapshot || '';
            return name.toLowerCase().includes(search.toLowerCase());
        })
        : tickets;

    const getElapsed = (created: string) => {
        const diff = Date.now() - new Date(created).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ${hrs % 24}h ago`;
    };

    const getTimeColor = (created: string) => {
        const mins = (Date.now() - new Date(created).getTime()) / 60000;
        if (mins > 60) return 'text-red-400';
        if (mins > 30) return 'text-amber-400';
        return 'text-emerald-400';
    };

    const getTicketName = (ticket: Ticket) => {
        if (ticket.customerName) return ticket.customerName;
        if (ticket.notes) {
            const parts = ticket.notes.split('|');
            return parts[0]?.trim() || `Ticket #${ticket.id.slice(-4)}`;
        }
        return ticket.items?.[0]?.productNameSnapshot || `Ticket #${ticket.id.slice(-4)}`;
    };

    const handleSelectTicket = (ticket: Ticket) => {
        loadTicket({
            id: ticket.id,
            name: getTicketName(ticket),
            items: ticket.items?.map(i => ({
                productId: i.productNameSnapshot,
                name: i.productNameSnapshot,
                price: i.unitPrice,
                quantity: i.quantity,
            })) || [],
        });
        navigate('/');
    };

    return (
        <div className="min-h-dvh flex flex-col safe-top safe-bottom" style={{ background: '#0f0f14' }}>

            {/* Header */}
            <header className="px-4 pt-3 pb-3 flex items-center gap-3">
                <button
                    onClick={() => navigate('/')}
                    className="w-9 h-9 rounded-xl glass flex items-center justify-center press"
                >
                    <X className="w-4 h-4 text-white/60" />
                </button>
                <div className="flex-1">
                    <h1 className="text-white font-semibold text-[15px]">Tickets Abiertos</h1>
                    <p className="text-white/30 text-[11px]">{tickets.length} activos</p>
                </div>

                {/* Search */}
                <button
                    onClick={() => setShowSearch(!showSearch)}
                    className="w-9 h-9 rounded-xl glass flex items-center justify-center press"
                >
                    <Search className="w-4 h-4 text-white/50" />
                </button>
            </header>

            {/* Search bar */}
            {showSearch && (
                <div className="px-4 pb-3 animate-slide-up">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                            type="text"
                            placeholder="Buscar ticket..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                            className="w-full glass rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                                <X className="w-4 h-4 text-white/30" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Ticket List */}
            <main className="flex-1 overflow-y-auto px-4 pb-4">
                {isLoading ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="w-7 h-7 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                    </div>
                ) : filteredTickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-60 text-white/30 animate-fade-in">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                            style={{ background: 'rgba(124,58,237,0.08)' }}>
                            <Zap className="w-7 h-7 text-purple-400/50" />
                        </div>
                        <p className="text-sm font-medium">Sin tickets abiertos</p>
                        <p className="text-xs text-white/20 mt-1">Los tickets guardados aparecerán aquí</p>
                        <button
                            onClick={() => navigate('/')}
                            className="mt-5 px-6 py-2.5 rounded-xl text-sm font-semibold text-white press"
                            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
                        >
                            Nueva Venta
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredTickets.map((ticket, idx) => (
                            <button
                                key={ticket.id}
                                onClick={() => handleSelectTicket(ticket)}
                                className="w-full p-4 rounded-xl glass text-left press animate-slide-up flex items-center gap-3"
                                style={{ animationDelay: `${idx * 0.04}s` }}
                            >
                                {/* Avatar */}
                                <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center"
                                    style={{ background: 'rgba(124,58,237,0.12)' }}>
                                    <span className="text-purple-300 font-bold text-sm">
                                        {getTicketName(ticket)[0]?.toUpperCase() || '#'}
                                    </span>
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-white/90 text-[14px] font-medium truncate">
                                        {getTicketName(ticket)}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <Clock className={`w-3 h-3 ${getTimeColor(ticket.createdAt)}`} />
                                        <span className={`text-[11px] ${getTimeColor(ticket.createdAt)}`}>
                                            {getElapsed(ticket.createdAt)}
                                        </span>
                                        <span className="text-white/15 text-[10px]">·</span>
                                        <span className="text-white/30 text-[11px]">Enigma</span>
                                    </div>
                                </div>

                                {/* Amount */}
                                <div className="text-right shrink-0">
                                    <p className="text-white font-semibold text-[15px] font-mono tabular-nums">
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
