import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Plus, Clock, LayoutGrid, ChevronRight, Users } from 'lucide-react';
import api from '../lib/api';
import { useCartStore } from '../stores/cartStore';

interface CurrentTicket {
    id: string;
    ticketName: string | null;
    totalAmount: number;
    createdAt: string;
}

interface DiningTable {
    id: string;
    name: string;
    zone: string | null;
    capacity: number | null;
    isOccupied: boolean;
    currentTicket: CurrentTicket | null;
}

function timeElapsed(dateStr: string): string {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function urgencyColor(dateStr: string): string {
    const mins = (Date.now() - new Date(dateStr).getTime()) / 60000;
    if (mins > 45) return '#ef4444';
    if (mins > 20) return '#f59e0b';
    return '#93B59D';
}

function urgencyRgb(color: string): string {
    if (color === '#ef4444') return '239,68,68';
    if (color === '#f59e0b') return '245,158,11';
    return '147,181,157';
}

export default function FloorPage() {
    const navigate = useNavigate();
    const { setTable, clearCart, loadTicket } = useCartStore();
    const [activeZone, setActiveZone] = useState('Todas');
    const [loadingTableId, setLoadingTableId] = useState<string | null>(null);

    const { data: tables = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['floor-tables'],
        queryFn: async () => {
            const { data } = await api.get('/tables');
            return (data?.data || []) as DiningTable[];
        },
        refetchInterval: 15_000,
    });

    const { data: openCount = 0 } = useQuery({
        queryKey: ['open-ticket-count'],
        queryFn: async () => {
            const { data } = await api.get('/sales?status=open');
            return (data?.data || []).length as number;
        },
        refetchInterval: 20_000,
    });

    const zones = ['Todas', ...Array.from(new Set(tables.map(t => t.zone || 'General'))).sort()];

    const filteredTables = activeZone === 'Todas'
        ? tables
        : tables.filter(t => (t.zone || 'General') === activeZone);

    const occupiedCount = tables.filter(t => t.isOccupied).length;

    // Group filtered tables by zone for display
    const zonesToShow = activeZone === 'Todas'
        ? Array.from(new Set(tables.map(t => t.zone || 'General'))).sort()
        : [activeZone];

    const tableGroups: Record<string, DiningTable[]> = {};
    zonesToShow.forEach(z => {
        tableGroups[z] = filteredTables.filter(t => (t.zone || 'General') === z);
    });

    const handleTableTap = async (table: DiningTable) => {
        if (table.isOccupied && table.currentTicket) {
            setLoadingTableId(table.id);
            try {
                const { data } = await api.get(`/sales/${table.currentTicket.id}`);
                const ticket = data?.data || data;
                if (ticket?.items) {
                    loadTicket({
                        id: ticket.id,
                        name: ticket.tableName || ticket.ticketName || table.name,
                        tableId: ticket.tableId || table.id,
                        tableName: ticket.tableName || table.name,
                        items: ticket.items.map((i: any) => ({
                            productId: i.productId,
                            name: i.productNameSnapshot,
                            price: i.unitPrice,
                            quantity: i.quantity,
                        })),
                    });
                    navigate('/sale');
                }
            } catch {
                alert('Error cargando el ticket');
            } finally {
                setLoadingTableId(null);
            }
        } else {
            clearCart();
            setTable(table.id, table.name);
            navigate('/sale');
        }
    };

    const handleNewSale = () => {
        clearCart();
        navigate('/sale');
    };

    return (
        <div className="min-h-dvh flex flex-col safe-top safe-bottom" style={{ background: '#121413' }}>

            {/* ── Header ── */}
            <header className="px-4 pt-4 pb-3 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold" style={{ color: '#F4F0EA' }}>Salón</h1>
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(244,240,234,0.3)' }}>
                        <span style={{ color: '#f59e0b' }}>{occupiedCount} ocupadas</span>
                        {' · '}
                        <span style={{ color: '#93B59D' }}>{tables.length - occupiedCount} libres</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {openCount > 0 && (
                        <button
                            onClick={() => navigate('/tickets')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl press"
                            style={{
                                background: 'rgba(245,158,11,0.08)',
                                border: '1px solid rgba(245,158,11,0.2)',
                                color: '#f59e0b',
                            }}
                        >
                            <span className="text-xs font-bold">{openCount}</span>
                            <span className="text-[11px]">tickets</span>
                        </button>
                    )}
                    <button
                        onClick={() => refetch()}
                        className="w-9 h-9 rounded-xl flex items-center justify-center press"
                        style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`}
                            style={{ color: 'rgba(244,240,234,0.4)' }} />
                    </button>
                </div>
            </header>

            {/* ── Zone Filter Pills ── */}
            {zones.length > 2 && (
                <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
                    {zones.map(z => (
                        <button
                            key={z}
                            onClick={() => setActiveZone(z)}
                            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold press transition-all"
                            style={{
                                background: activeZone === z ? '#93B59D' : 'rgba(244,240,234,0.04)',
                                color: activeZone === z ? '#121413' : 'rgba(244,240,234,0.45)',
                                border: activeZone === z ? 'none' : '1px solid rgba(244,240,234,0.06)',
                            }}
                        >
                            {z}
                        </button>
                    ))}
                </div>
            )}

            {/* ── Tables ── */}
            <main className="flex-1 overflow-y-auto px-4 pb-32 space-y-6">
                {isLoading ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="w-7 h-7 border-2 rounded-full animate-spin"
                            style={{ borderColor: 'rgba(147,181,157,0.2)', borderTopColor: '#93B59D' }} />
                    </div>
                ) : tables.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-60 animate-fade-in"
                        style={{ color: 'rgba(244,240,234,0.25)' }}>
                        <LayoutGrid className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-sm font-medium">Sin mesas configuradas</p>
                        <p className="text-xs mt-1" style={{ color: 'rgba(244,240,234,0.15)' }}>
                            Crea tus mesas en Enigma HQ
                        </p>
                        <button
                            onClick={handleNewSale}
                            className="mt-5 px-6 py-2.5 rounded-xl text-sm font-semibold press"
                            style={{ background: '#1C402E', color: '#93B59D' }}
                        >
                            Nueva Venta Directa
                        </button>
                    </div>
                ) : (
                    Object.entries(tableGroups).map(([zone, zoneTables]) => {
                        if (!zoneTables.length) return null;
                        const zoneOccupied = zoneTables.filter(t => t.isOccupied).length;
                        return (
                            <div key={zone}>
                                {/* Zone header */}
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase flex-shrink-0"
                                        style={{ color: 'rgba(244,240,234,0.25)' }}>
                                        {zone}
                                    </span>
                                    <div className="flex-1 h-px" style={{ background: 'rgba(244,240,234,0.04)' }} />
                                    {zoneOccupied > 0 && (
                                        <span className="text-[10px] flex-shrink-0"
                                            style={{ color: 'rgba(245,158,11,0.6)' }}>
                                            {zoneOccupied}/{zoneTables.length}
                                        </span>
                                    )}
                                </div>

                                {/* Table grid */}
                                <div className="grid grid-cols-2 gap-2.5">
                                    {zoneTables.map(table => {
                                        const busy = loadingTableId === table.id;
                                        const color = table.isOccupied && table.currentTicket
                                            ? urgencyColor(table.currentTicket.createdAt)
                                            : '#93B59D';
                                        const rgb = urgencyRgb(color);

                                        return (
                                            <button
                                                key={table.id}
                                                onClick={() => handleTableTap(table)}
                                                disabled={busy}
                                                className="relative p-4 rounded-2xl text-left press transition-all"
                                                style={{
                                                    background: table.isOccupied
                                                        ? `rgba(${rgb},0.07)`
                                                        : 'rgba(244,240,234,0.03)',
                                                    border: `1px solid ${table.isOccupied
                                                        ? `rgba(${rgb},0.2)`
                                                        : 'rgba(244,240,234,0.06)'}`,
                                                }}
                                            >
                                                {/* Live dot */}
                                                <div
                                                    className={`absolute top-3 right-3 w-2 h-2 rounded-full ${table.isOccupied ? 'animate-pulse' : ''}`}
                                                    style={{ background: color }}
                                                />

                                                <p className="font-bold text-[16px] mb-0.5 pr-4"
                                                    style={{ color: '#F4F0EA' }}>
                                                    {table.name}
                                                </p>

                                                {table.capacity && (
                                                    <div className="flex items-center gap-1 mb-2">
                                                        <Users className="w-3 h-3"
                                                            style={{ color: 'rgba(244,240,234,0.2)' }} />
                                                        <span className="text-[10px]"
                                                            style={{ color: 'rgba(244,240,234,0.2)' }}>
                                                            {table.capacity}
                                                        </span>
                                                    </div>
                                                )}

                                                {table.isOccupied && table.currentTicket ? (
                                                    <>
                                                        <p className="text-[16px] font-bold font-mono tabular-nums"
                                                            style={{ color }}>
                                                            ${table.currentTicket.totalAmount.toFixed(2)}
                                                        </p>
                                                        <div className="flex items-center gap-1 mt-0.5 mb-2">
                                                            <Clock className="w-3 h-3"
                                                                style={{ color: `rgba(${rgb},0.6)` }} />
                                                            <span className="text-[11px]"
                                                                style={{ color: `rgba(${rgb},0.7)` }}>
                                                                {timeElapsed(table.currentTicket.createdAt)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                                                style={{
                                                                    background: `rgba(${rgb},0.12)`,
                                                                    color,
                                                                }}>
                                                                Abrir
                                                            </span>
                                                            <ChevronRight className="w-3.5 h-3.5"
                                                                style={{ color: `rgba(${rgb},0.5)` }} />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                                        style={{
                                                            background: 'rgba(147,181,157,0.1)',
                                                            color: '#93B59D',
                                                        }}>
                                                        Libre
                                                    </span>
                                                )}

                                                {/* Loading overlay */}
                                                {busy && (
                                                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl"
                                                        style={{ background: 'rgba(18,20,19,0.75)' }}>
                                                        <div className="w-5 h-5 border-2 rounded-full animate-spin"
                                                            style={{ borderColor: 'rgba(147,181,157,0.2)', borderTopColor: '#93B59D' }} />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                )}
            </main>

            {/* ── Bottom Action Bar ── */}
            <div className="fixed bottom-0 left-0 right-0 z-30 p-4 safe-bottom">
                <div className="flex gap-2">
                    {openCount > 0 && (
                        <button
                            onClick={() => navigate('/tickets')}
                            className="flex-1 py-3.5 rounded-2xl font-semibold text-sm press"
                            style={{
                                background: 'rgba(244,240,234,0.05)',
                                border: '1px solid rgba(244,240,234,0.08)',
                                color: 'rgba(244,240,234,0.5)',
                            }}
                        >
                            {openCount} tickets abiertos
                        </button>
                    )}
                    <button
                        onClick={handleNewSale}
                        className={`${openCount > 0 ? 'flex-1' : 'w-full'} py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 press`}
                        style={{
                            background: 'linear-gradient(135deg, #1C402E, #255639)',
                            color: '#F4F0EA',
                            boxShadow: '0 8px 24px rgba(28,64,46,0.3)',
                        }}
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Venta
                    </button>
                </div>
            </div>
        </div>
    );
}
