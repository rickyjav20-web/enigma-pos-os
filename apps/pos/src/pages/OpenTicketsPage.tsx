import { X, Search, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useCartStore } from '../stores/cartStore';
import { useAuth } from '../context/AuthContext';

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
    employeeId?: string;
    items: { productId: string; productNameSnapshot: string; quantity: number; unitPrice: number }[];
}

type SortMode = 'time' | 'alpha' | 'amount';

export default function OpenTicketsPage() {
    const navigate = useNavigate();
    const { loadTicket } = useCartStore();
    const { employee } = useAuth();

    const [search, setSearch] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [sortMode, setSortMode] = useState<SortMode>('time');
    const [showSortSheet, setShowSortSheet] = useState(false);

    const { data: ticketsData, isLoading } = useQuery({
        queryKey: ['open-tickets'],
        queryFn: async () => {
            try {
                const { data } = await api.get('/sales?status=open');
                const list = Array.isArray(data) ? data : data?.data || [];
                return list as Ticket[];
            } catch { return [] as Ticket[]; }
        },
        refetchInterval: 8000,
    });

    const tickets = ticketsData || [];

    const getTicketLabel = (t: Ticket) =>
        t.ticketName || t.tableName || t.customerName ||
        (t.notes ? t.notes.split('|')[0]?.trim() : null) ||
        `Ticket #${t.id.slice(-4)}`;

    const getElapsed = (created: string) => {
        const diff = Date.now() - new Date(created).getTime();
        const totalMins = Math.floor(diff / 60000);
        if (totalMins < 1) return 'Just now';
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        if (hrs === 0) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
        if (mins === 0) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
        return `${hrs} hour${hrs !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''} ago`;
    };

    const myTickets = tickets.filter(t => employee && t.employeeId === employee.id);
    const otherTickets = tickets.filter(t => !employee || t.employeeId !== employee.id);

    const applySort = (list: Ticket[]) => {
        const filtered = search
            ? list.filter(t => getTicketLabel(t).toLowerCase().includes(search.toLowerCase()))
            : list;

        if (sortMode === 'alpha') return [...filtered].sort((a, b) => getTicketLabel(a).localeCompare(getTicketLabel(b)));
        if (sortMode === 'amount') return [...filtered].sort((a, b) => b.totalAmount - a.totalAmount);
        return [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    };

    const sortedMy = applySort(myTickets);
    const sortedOther = applySort(otherTickets);
    const allSorted = applySort(tickets);
    const hasMyTickets = sortedMy.length > 0;

    const handleSelectTicket = (ticket: Ticket) => {
        loadTicket({
            id: ticket.id,
            name: getTicketLabel(ticket),
            tableId: ticket.tableId,
            tableName: ticket.tableName,
            items: ticket.items?.map(i => ({
                productId: i.productId,
                name: i.productNameSnapshot,
                price: i.unitPrice,
                quantity: i.quantity,
            })) || [],
        });
        navigate('/');
    };

    const sortLabels: Record<SortMode, string> = {
        time: 'By Time',
        alpha: 'Alphabetical (A–Z)',
        amount: 'By Amount ($)',
    };

    const TicketRow = ({ ticket }: { ticket: Ticket }) => (
        <button
            onClick={() => handleSelectTicket(ticket)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left active:opacity-60 transition-opacity"
            style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}
        >
            {/* Checkbox */}
            <div className="w-5 h-5 rounded shrink-0 flex items-center justify-center"
                style={{ border: '1.5px solid rgba(244,240,234,0.25)', background: 'transparent' }} />

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold truncate" style={{ color: '#F4F0EA' }}>
                    {getTicketLabel(ticket)}
                </p>
                <p className="text-[12px] mt-0.5 truncate" style={{ color: 'rgba(244,240,234,0.35)' }}>
                    {getElapsed(ticket.createdAt)}
                    {ticket.tableName ? `, ${ticket.tableName}` : ', Enigma'}
                </p>
            </div>

            {/* Amount */}
            <span className="font-semibold text-[15px] font-mono tabular-nums shrink-0" style={{ color: '#F4F0EA' }}>
                ${(ticket.totalAmount ?? 0).toFixed(2)}
            </span>
        </button>
    );

    return (
        <div className="min-h-dvh flex flex-col safe-top safe-bottom" style={{ background: '#121413' }}>

            {/* Header */}
            <header className="px-4 pt-3 pb-2 flex items-center gap-3">
                <button onClick={() => navigate('/')}
                    className="w-9 h-9 rounded-lg flex items-center justify-center active:opacity-60 transition-opacity"
                    style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}>
                    <X className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.5)' }} />
                </button>

                <div className="flex-1">
                    <h1 className="font-semibold text-[15px]" style={{ color: '#F4F0EA' }}>Open tickets</h1>
                    {!search && (
                        <p className="text-[11px]" style={{ color: 'rgba(244,240,234,0.3)' }}>
                            {tickets.length} active · {sortLabels[sortMode]}
                        </p>
                    )}
                </div>

                <button onClick={() => setShowSortSheet(true)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center active:opacity-60 transition-opacity"
                    style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}>
                    <SlidersHorizontal className="w-4 h-4" style={{ color: sortMode !== 'time' ? '#93B59D' : 'rgba(244,240,234,0.4)' }} />
                </button>

                <button onClick={() => { setShowSearch(s => !s); setSearch(''); }}
                    className="w-9 h-9 rounded-lg flex items-center justify-center active:opacity-60 transition-opacity"
                    style={{ background: showSearch ? 'rgba(147,181,157,0.15)' : 'rgba(244,240,234,0.04)', border: `1px solid ${showSearch ? 'rgba(147,181,157,0.3)' : 'rgba(244,240,234,0.06)'}` }}>
                    <Search className="w-4 h-4" style={{ color: showSearch ? '#93B59D' : 'rgba(244,240,234,0.4)' }} />
                </button>
            </header>

            {/* Search bar */}
            {showSearch && (
                <div className="px-4 pb-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(244,240,234,0.2)' }} />
                        <input
                            type="text"
                            placeholder="Search ticket..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                            className="w-full rounded-lg pl-9 pr-9 py-2.5 text-sm focus:outline-none"
                            style={{ background: 'rgba(244,240,234,0.05)', border: '1px solid rgba(244,240,234,0.08)', color: '#F4F0EA' }}
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 active:opacity-60">
                                <X className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.3)' }} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* List */}
            <main className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="w-7 h-7 border-2 rounded-full animate-spin"
                            style={{ borderColor: 'rgba(147,181,157,0.2)', borderTopColor: '#93B59D' }} />
                    </div>
                ) : allSorted.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-60" style={{ color: 'rgba(244,240,234,0.25)' }}>
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                            style={{ background: 'rgba(28,64,46,0.15)' }}>
                            <span className="text-2xl">📋</span>
                        </div>
                        <p className="text-sm font-medium">{search ? 'No results' : 'No open tickets'}</p>
                        <p className="text-xs mt-1" style={{ color: 'rgba(244,240,234,0.15)' }}>
                            {search ? 'Try a different name' : 'Saved tickets will appear here'}
                        </p>
                        {!search && (
                            <button onClick={() => navigate('/')}
                                className="mt-5 px-6 py-2.5 rounded-xl text-sm font-semibold active:opacity-70 transition-opacity"
                                style={{ background: '#1C402E', color: '#93B59D' }}>
                                New Sale
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* My Tickets section */}
                        {hasMyTickets && (
                            <>
                                <div className="px-4 pt-4 pb-2">
                                    <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#93B59D' }}>
                                        My tickets
                                    </span>
                                </div>
                                {sortedMy.map(t => <TicketRow key={t.id} ticket={t} />)}
                            </>
                        )}

                        {/* Other / All tickets */}
                        {hasMyTickets && sortedOther.length > 0 && (
                            <div className="px-4 pt-4 pb-2">
                                <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(244,240,234,0.25)' }}>
                                    Other tickets
                                </span>
                            </div>
                        )}
                        {(hasMyTickets ? sortedOther : allSorted).map(t => <TicketRow key={t.id} ticket={t} />)}
                    </>
                )}
            </main>

            {/* Sort sheet */}
            {showSortSheet && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.6)' }}
                    onClick={() => setShowSortSheet(false)}>
                    <div className="rounded-t-2xl p-4 space-y-1" style={{ background: '#1A1C1B' }}
                        onClick={e => e.stopPropagation()}>
                        <p className="text-[11px] font-semibold uppercase tracking-widest px-2 pb-2"
                            style={{ color: 'rgba(244,240,234,0.3)' }}>Sort by</p>

                        {([
                            { key: 'time', label: 'By Time', sub: 'Most recent first' },
                            { key: 'alpha', label: 'Alphabetical (A–Z)', sub: 'Sort by ticket name' },
                            { key: 'amount', label: 'By Amount ($)', sub: 'Highest total first' },
                        ] as { key: SortMode; label: string; sub: string }[]).map(opt => (
                            <button key={opt.key}
                                onClick={() => { setSortMode(opt.key); setShowSortSheet(false); }}
                                className="w-full flex items-center justify-between px-3 py-3 rounded-xl active:opacity-60 transition-opacity"
                                style={{ background: sortMode === opt.key ? 'rgba(147,181,157,0.12)' : 'transparent' }}>
                                <div className="text-left">
                                    <p className="text-[14px] font-medium" style={{ color: sortMode === opt.key ? '#93B59D' : '#F4F0EA' }}>
                                        {opt.label}
                                    </p>
                                    <p className="text-[11px]" style={{ color: 'rgba(244,240,234,0.3)' }}>{opt.sub}</p>
                                </div>
                                {sortMode === opt.key && (
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center"
                                        style={{ background: '#93B59D' }}>
                                        <div className="w-2 h-2 rounded-full" style={{ background: '#121413' }} />
                                    </div>
                                )}
                            </button>
                        ))}

                        <div className="pt-2 pb-safe">
                            <button onClick={() => setShowSortSheet(false)}
                                className="w-full py-3 rounded-xl text-sm font-semibold active:opacity-70 transition-opacity"
                                style={{ background: 'rgba(244,240,234,0.06)', color: 'rgba(244,240,234,0.6)' }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
