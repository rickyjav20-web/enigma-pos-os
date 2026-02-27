import { ArrowLeft, Clock, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

interface Ticket {
    id: string;
    totalAmount: number;
    paymentMethod: string;
    status: string;
    createdAt: string;
    items: { productNameSnapshot: string; quantity: number; unitPrice: number }[];
}

export default function OpenTicketsPage() {
    const navigate = useNavigate();

    // For now, fetch recent sales as "tickets"
    // In the future, this will be Orders with status != closed
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

    const getElapsed = (created: string) => {
        const diff = Date.now() - new Date(created).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        return `${hrs}h ${mins % 60}m`;
    };

    const getTimeColor = (created: string) => {
        const mins = (Date.now() - new Date(created).getTime()) / 60000;
        if (mins > 60) return 'text-wave-red';
        if (mins > 30) return 'text-wave-amber';
        return 'text-wave-green';
    };

    return (
        <div className="min-h-dvh bg-wave-dark flex flex-col safe-top safe-bottom">

            {/* Header */}
            <header className="px-4 pt-3 pb-3 flex items-center gap-3">
                <button onClick={() => navigate('/')} className="w-10 h-10 rounded-xl bg-wave-gray border border-wave-border flex items-center justify-center press">
                    <ArrowLeft className="w-5 h-5 text-wave-text-secondary" />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-bold">Órdenes Abiertas</h1>
                    <p className="text-xs text-wave-text-muted">{tickets.length} tickets activos</p>
                </div>
            </header>

            {/* Tickets List */}
            <main className="flex-1 px-4 pb-4 overflow-y-auto space-y-2">
                {isLoading ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="w-8 h-8 border-2 border-wave-purple/30 border-t-wave-purple rounded-full animate-spin" />
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-60 text-wave-text-muted animate-fade-in">
                        <DollarSign className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-sm font-medium">No hay órdenes abiertas</p>
                        <p className="text-xs mt-1">Las órdenes nuevas aparecerán aquí</p>
                        <button
                            onClick={() => navigate('/order/new')}
                            className="mt-4 px-5 py-2.5 rounded-xl bg-wave-purple text-sm font-semibold press"
                        >
                            Nueva Orden
                        </button>
                    </div>
                ) : (
                    tickets.map((ticket, idx) => (
                        <div
                            key={ticket.id}
                            className="p-4 rounded-2xl glass flex items-center gap-3 press animate-slide-up"
                            style={{ animationDelay: `${idx * 0.03}s` }}
                        >
                            {/* Ticket Avatar */}
                            <div className="w-12 h-12 rounded-xl bg-wave-purple/15 flex items-center justify-center shrink-0">
                                <span className="text-wave-purple font-bold text-sm">#{ticket.id.slice(-4)}</span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">
                                    {ticket.items?.[0]?.productNameSnapshot || 'Orden'}
                                    {ticket.items?.length > 1 && ` +${ticket.items.length - 1}`}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <Clock className={`w-3 h-3 ${getTimeColor(ticket.createdAt)}`} />
                                    <span className={`text-xs font-mono ${getTimeColor(ticket.createdAt)}`}>
                                        {getElapsed(ticket.createdAt)}
                                    </span>
                                    <span className="text-wave-text-muted text-xs">·</span>
                                    <span className="text-wave-text-muted text-xs">{ticket.items?.length || 0} items</span>
                                </div>
                            </div>

                            {/* Amount */}
                            <p className="text-base font-bold font-mono text-wave-green shrink-0">
                                ${ticket.totalAmount?.toFixed(2) || '0.00'}
                            </p>
                        </div>
                    ))
                )}
            </main>
        </div>
    );
}
