import { X, Search, SlidersHorizontal, Clock } from 'lucide-react';
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
        if (mins < 60) return `${mins} minutes ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs} hours ${mins % 60} minutes ago`;
        const days = Math.floor(hrs / 24);
        return `${days} day ${hrs % 24} hours ${mins % 60} minutes ago`;
    };

    const getTicketName = (ticket: Ticket) => {
        // Try to extract name from notes or customer
        if (ticket.customerName) return ticket.customerName;
        if (ticket.notes) {
            const parts = ticket.notes.split('|');
            return parts[0]?.trim() || `Ticket #${ticket.id.slice(-4)}`;
        }
        return ticket.items?.[0]?.productNameSnapshot || `Ticket #${ticket.id.slice(-4)}`;
    };

    const handleSelectTicket = (ticket: Ticket) => {
        // Load ticket into cart
        loadTicket({
            id: ticket.id,
            name: getTicketName(ticket),
            items: ticket.items?.map(i => ({
                productId: i.productNameSnapshot, // placeholder — real app would use productId
                name: i.productNameSnapshot,
                price: i.unitPrice,
                quantity: i.quantity,
            })) || [],
        });
        navigate('/');
    };

    return (
        <div className="min-h-dvh bg-[#2d2d2d] flex flex-col safe-top safe-bottom">

            {/* Header */}
            <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                <button
                    onClick={() => navigate('/')}
                    className="w-9 h-9 flex items-center justify-center rounded-lg active:bg-white/10"
                >
                    <X className="w-5 h-5 text-white/80" />
                </button>
                <h1 className="flex-1 text-white font-bold text-base">Open tickets</h1>
            </header>

            {/* Filter bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <input type="checkbox" className="w-4 h-4 accent-[#4caf50] rounded" />
                </div>
                <div className="flex items-center gap-3">
                    <button className="w-8 h-8 flex items-center justify-center">
                        <SlidersHorizontal className="w-4 h-4 text-white/60" />
                    </button>
                    {showSearch ? (
                        <div className="flex items-center gap-1">
                            <input
                                type="text"
                                placeholder="Search..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                autoFocus
                                className="bg-transparent border-b border-white/30 text-white text-sm outline-none w-32 py-1"
                            />
                            <button onClick={() => { setSearch(''); setShowSearch(false); }}>
                                <X className="w-4 h-4 text-white/50" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowSearch(true)}
                            className="w-8 h-8 flex items-center justify-center"
                        >
                            <Search className="w-4 h-4 text-white/60" />
                        </button>
                    )}
                </div>
            </div>

            {/* Section header */}
            <div className="px-4 py-2">
                <p className="text-[#4caf50] text-xs font-bold uppercase tracking-wider">My tickets</p>
            </div>

            {/* Ticket List */}
            <main className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="w-7 h-7 border-2 border-white/20 border-t-[#4caf50] rounded-full animate-spin" />
                    </div>
                ) : filteredTickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-60 text-white/40 px-6">
                        <Clock className="w-10 h-10 mb-3 opacity-20" />
                        <p className="text-sm font-medium text-center">No open tickets</p>
                        <p className="text-xs mt-1 text-center">Tickets you save will appear here</p>
                        <button
                            onClick={() => navigate('/')}
                            className="mt-4 px-5 py-2.5 rounded-lg bg-[#4caf50] text-white text-sm font-bold active:brightness-90"
                        >
                            New Sale
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {filteredTickets.map(ticket => (
                            <button
                                key={ticket.id}
                                onClick={() => handleSelectTicket(ticket)}
                                className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-white/5 transition-colors"
                            >
                                {/* Checkbox */}
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 accent-[#4caf50] rounded shrink-0"
                                    onClick={e => e.stopPropagation()}
                                />

                                {/* Ticket info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-[15px] font-medium truncate">
                                        {getTicketName(ticket)}
                                    </p>
                                    <p className="text-white/40 text-xs mt-0.5 truncate">
                                        {getElapsed(ticket.createdAt)}, Enigma
                                    </p>
                                </div>

                                {/* Amount */}
                                <span className="text-white text-[15px] font-medium shrink-0">
                                    ${ticket.totalAmount?.toFixed(2) || '0.00'}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
