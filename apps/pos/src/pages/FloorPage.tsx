import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Plus, Clock, LayoutGrid, ChevronRight, Users, ArrowRightLeft, Merge } from 'lucide-react';
import api from '../lib/api';
import { useCartStore } from '../stores/cartStore';
import { Toast, ConfirmModal } from '../components/ui';

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
    guestCount?: number | null;
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
    const queryClient = useQueryClient();
    const { setTable, clearCart, loadTicket } = useCartStore();
    const [activeZone, setActiveZone] = useState('Todas');
    const [loadingTableId, setLoadingTableId] = useState<string | null>(null);
    const [toastMsg, setToastMsg] = useState<string | null>(null);
    const [toastType, setToastType] = useState<'error' | 'success' | 'info'>('error');

    // Move/Merge state
    const [actionMode, setActionMode] = useState<'move' | 'merge' | null>(null);
    const [sourceTable, setSourceTable] = useState<DiningTable | null>(null);
    const [confirmTarget, setConfirmTarget] = useState<DiningTable | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

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
                        guestCount: ticket.guestCount || null,
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
                setToastMsg('Error cargando el ticket');
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

    const showToast = (msg: string, type: 'error' | 'success' | 'info' = 'error') => {
        setToastType(type);
        setToastMsg(msg);
    };

    const startAction = (mode: 'move' | 'merge', table: DiningTable) => {
        setActionMode(mode);
        setSourceTable(table);
    };

    const cancelAction = () => {
        setActionMode(null);
        setSourceTable(null);
        setConfirmTarget(null);
    };

    const handleTargetSelect = (target: DiningTable) => {
        if (target.id === sourceTable?.id) return;
        setConfirmTarget(target);
    };

    const executeAction = async () => {
        if (!sourceTable || !confirmTarget || !actionMode) return;
        setActionLoading(true);
        try {
            const endpoint = actionMode === 'move'
                ? `/tables/${sourceTable.id}/move-to/${confirmTarget.id}`
                : `/tables/${sourceTable.id}/merge-into/${confirmTarget.id}`;
            await api.post(endpoint);
            showToast(
                actionMode === 'move'
                    ? `${sourceTable.name} → ${confirmTarget.name}`
                    : `${sourceTable.name} + ${confirmTarget.name} combinadas`,
                'success'
            );
            cancelAction();
            refetch();
            queryClient.invalidateQueries({ queryKey: ['open-ticket-count'] });
        } catch {
            showToast(`Error al ${actionMode === 'move' ? 'mover' : 'mezclar'} mesa`);
        } finally {
            setActionLoading(false);
        }
    };

    const handleTableAction = (table: DiningTable) => {
        if (actionMode && sourceTable) {
            handleTargetSelect(table);
            return;
        }
        handleTableTap(table);
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
                                        const isSource = actionMode && sourceTable?.id === table.id;
                                        const isPickingTarget = actionMode && sourceTable && sourceTable.id !== table.id;

                                        return (
                                            <button
                                                key={table.id}
                                                onClick={() => handleTableAction(table)}
                                                disabled={busy || !!isSource}
                                                className="relative p-4 rounded-2xl text-left press transition-all"
                                                style={{
                                                    background: isSource
                                                        ? 'rgba(59,130,246,0.15)'
                                                        : isPickingTarget
                                                            ? 'rgba(59,130,246,0.05)'
                                                            : table.isOccupied
                                                                ? `rgba(${rgb},0.07)`
                                                                : 'rgba(244,240,234,0.03)',
                                                    border: `1px solid ${isSource
                                                        ? 'rgba(59,130,246,0.4)'
                                                        : isPickingTarget
                                                            ? 'rgba(59,130,246,0.15)'
                                                            : table.isOccupied
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

                                                <div className="flex items-center gap-1 mb-2">
                                                    <Users className="w-3 h-3"
                                                        style={{ color: table.guestCount ? 'rgba(147,181,157,0.6)' : 'rgba(244,240,234,0.2)' }} />
                                                    {table.guestCount ? (
                                                        <span className="text-[10px] font-semibold"
                                                            style={{ color: '#93B59D' }}>
                                                            {table.guestCount} persona{table.guestCount > 1 ? 's' : ''}
                                                        </span>
                                                    ) : table.capacity ? (
                                                        <span className="text-[10px]"
                                                            style={{ color: 'rgba(244,240,234,0.2)' }}>
                                                            {table.capacity} pax
                                                        </span>
                                                    ) : null}
                                                </div>

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
                                                            <div className="flex items-center gap-1">
                                                                {!actionMode && (
                                                                    <>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); startAction('move', table); }}
                                                                            className="w-6 h-6 rounded-md flex items-center justify-center"
                                                                            style={{ background: 'rgba(59,130,246,0.12)' }}
                                                                            title="Mover mesa"
                                                                        >
                                                                            <ArrowRightLeft className="w-3 h-3" style={{ color: '#3b82f6' }} />
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); startAction('merge', table); }}
                                                                            className="w-6 h-6 rounded-md flex items-center justify-center"
                                                                            style={{ background: 'rgba(168,85,247,0.12)' }}
                                                                            title="Mezclar mesa"
                                                                        >
                                                                            <Merge className="w-3 h-3" style={{ color: '#a855f7' }} />
                                                                        </button>
                                                                    </>
                                                                )}
                                                                <ChevronRight className="w-3.5 h-3.5"
                                                                    style={{ color: `rgba(${rgb},0.5)` }} />
                                                            </div>
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

            {toastMsg && <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg(null)} />}

            {/* ── Action Mode Banner ── */}
            {actionMode && sourceTable && (
                <div className="fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between"
                    style={{
                        background: actionMode === 'move' ? 'rgba(59,130,246,0.15)' : 'rgba(168,85,247,0.15)',
                        borderBottom: `1px solid ${actionMode === 'move' ? 'rgba(59,130,246,0.3)' : 'rgba(168,85,247,0.3)'}`,
                    }}>
                    <div className="flex items-center gap-2">
                        {actionMode === 'move'
                            ? <ArrowRightLeft className="w-4 h-4" style={{ color: '#3b82f6' }} />
                            : <Merge className="w-4 h-4" style={{ color: '#a855f7' }} />}
                        <span className="text-sm font-semibold" style={{ color: '#F4F0EA' }}>
                            {actionMode === 'move' ? 'Mover' : 'Mezclar'} {sourceTable.name} →
                            <span style={{ color: 'rgba(244,240,234,0.5)' }}> Selecciona destino</span>
                        </span>
                    </div>
                    <button onClick={cancelAction}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: 'rgba(244,240,234,0.1)', color: 'rgba(244,240,234,0.6)' }}>
                        Cancelar
                    </button>
                </div>
            )}

            {/* ── Confirm Move/Merge Modal ── */}
            {confirmTarget && sourceTable && actionMode && (
                <ConfirmModal
                    title={actionMode === 'move' ? 'Mover Mesa' : 'Mezclar Mesas'}
                    message={actionMode === 'move'
                        ? `¿Mover tickets de ${sourceTable.name} a ${confirmTarget.name}? Los items ya enviados a cocina no se re-envían.`
                        : `¿Combinar ${sourceTable.name} con ${confirmTarget.name}? Todos los items se unen en un solo ticket.`}
                    confirmLabel={actionLoading ? 'Procesando...' : actionMode === 'move' ? 'Mover' : 'Mezclar'}
                    confirmColor={actionMode === 'move' ? '#3b82f6' : '#a855f7'}
                    onConfirm={executeAction}
                    onCancel={() => setConfirmTarget(null)}
                />
            )}

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
