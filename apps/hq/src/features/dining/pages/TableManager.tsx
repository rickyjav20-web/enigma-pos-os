/**
 * TableManager — HQ Back Office
 * Configure dining tables: create, edit zones, set capacity, seed defaults.
 * Branding: Dark Organic Tech — matches HQ glassmorphism system.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    LayoutGrid, Plus, Trash2, Edit2, Users, MapPin,
    Sparkles, Clock, CheckCircle2, Circle
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DiningTable {
    id: string;
    name: string;
    zone: string | null;
    capacity: number | null;
    sortOrder: number;
    isActive: boolean;
    isOccupied?: boolean;
    currentTicket?: {
        id: string;
        ticketName: string | null;
        totalAmount: number;
        createdAt: string;
    } | null;
}

const PRESET_ZONES = ['Interior', 'Bar', 'Terraza', 'Takeaway', 'VIP', 'Patio'];

function timeElapsed(dateStr: string): string {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TableManager() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editingTable, setEditingTable] = useState<DiningTable | null>(null);
    const [filterZone, setFilterZone] = useState('Todas');

    // Form state
    const [formName, setFormName] = useState('');
    const [formZone, setFormZone] = useState('Interior');
    const [formCustomZone, setFormCustomZone] = useState('');
    const [formCapacity, setFormCapacity] = useState('');
    const [formSortOrder, setFormSortOrder] = useState('');

    // ── Queries ──
    const { data: tables = [], isLoading } = useQuery<DiningTable[]>({
        queryKey: ['dining-tables'],
        queryFn: async () => {
            const res = await api.get('/tables');
            return res.data?.data || [];
        },
        refetchInterval: 15000,
    });

    // ── Mutations ──
    const createMutation = useMutation({
        mutationFn: (data: object) => api.post('/tables', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dining-tables'] });
            resetForm();
        },
        onError: (err: any) => {
            alert(`Error al crear mesa: ${err?.response?.data?.message || err.message}`);
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: object }) =>
            api.put(`/tables/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dining-tables'] });
            resetForm();
        },
        onError: (err: any) => {
            alert(`Error al actualizar mesa: ${err?.response?.data?.message || err.message}`);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/tables/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dining-tables'] }),
        onError: (err: any) => {
            alert(`Error al eliminar mesa: ${err?.response?.data?.message || err.message}`);
        },
    });

    const seedMutation = useMutation({
        mutationFn: () => api.post('/tables/seed'),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dining-tables'] }),
        onError: (err: any) => {
            alert(`Error al cargar mesas: ${err?.response?.data?.message || err.message}`);
        },
    });

    // ── Helpers ──
    const resetForm = () => {
        setShowForm(false);
        setEditingTable(null);
        setFormName('');
        setFormZone('Interior');
        setFormCustomZone('');
        setFormCapacity('');
        setFormSortOrder('');
    };

    const openEdit = (table: DiningTable) => {
        setEditingTable(table);
        setFormName(table.name);
        const isPreset = PRESET_ZONES.includes(table.zone || '');
        setFormZone(isPreset ? (table.zone || 'Interior') : 'custom');
        setFormCustomZone(!isPreset ? (table.zone || '') : '');
        setFormCapacity(table.capacity?.toString() || '');
        setFormSortOrder(table.sortOrder?.toString() || '');
        setShowForm(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const effectiveZone = formZone === 'custom' ? formCustomZone : formZone;
        const payload = {
            name: formName,
            zone: effectiveZone || null,
            capacity: formCapacity ? Number(formCapacity) : null,
            sortOrder: formSortOrder ? Number(formSortOrder) : 0,
        };
        if (editingTable) {
            updateMutation.mutate({ id: editingTable.id, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    // ── Derived data ──
    const zones = ['Todas', ...Array.from(new Set(tables.map(t => t.zone || 'General')))];
    const filteredTables = filterZone === 'Todas'
        ? tables
        : tables.filter(t => (t.zone || 'General') === filterZone);

    const occupiedCount = tables.filter(t => t.isOccupied).length;
    const freeCount = tables.filter(t => !t.isOccupied).length;

    const isMutating = createMutation.isPending || updateMutation.isPending;

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">

            {/* ── Page Header ── */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <LayoutGrid className="w-6 h-6 text-[#93B59D]" />
                        Gestión de Mesas
                    </h1>
                    <p className="text-zinc-400 mt-1 text-sm">
                        Configura zonas, mesas y capacidad del salón. Los cambios se reflejan en tiempo real en el POS.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => seedMutation.mutate()}
                        disabled={seedMutation.isPending}
                        className="border-white/10 text-zinc-400 hover:text-white text-xs gap-1.5"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        {seedMutation.isPending ? 'Cargando...' : 'Mesas predeterminadas'}
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => { resetForm(); setShowForm(true); }}
                        className="bg-[#93B59D] hover:bg-[#93B59D]/80 text-[#121413] font-semibold gap-1.5"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Mesa
                    </Button>
                </div>
            </div>

            {/* ── Stats Bar ── */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Total Mesas', value: tables.length, color: 'text-white' },
                    { label: 'Ocupadas ahora', value: occupiedCount, color: 'text-amber-400' },
                    { label: 'Libres', value: freeCount, color: 'text-[#93B59D]' },
                ].map(stat => (
                    <Card key={stat.label} className="p-4 bg-[#0a0a0c] border-white/[0.05] text-center">
                        <div className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
                        <div className="text-[11px] text-zinc-500 mt-0.5 uppercase tracking-wider">{stat.label}</div>
                    </Card>
                ))}
            </div>

            {/* ── Create / Edit Form ── */}
            {showForm && (
                <Card className="p-5 bg-black/40 border-[#93B59D]/20 backdrop-blur-xl animate-in slide-in-from-top-3">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <Edit2 className="w-4 h-4 text-[#93B59D]" />
                        {editingTable ? `Editando: ${editingTable.name}` : 'Nueva Mesa'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                            {/* Name */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                                    Nombre *
                                </label>
                                <Input
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    placeholder="Mesa 1, Bar 2..."
                                    required
                                    className="bg-black/40 border-white/10 text-sm"
                                />
                            </div>

                            {/* Zone */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                                    Zona
                                </label>
                                <select
                                    value={formZone}
                                    onChange={e => setFormZone(e.target.value)}
                                    className="w-full h-10 px-3 bg-black/40 border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#93B59D]/50"
                                >
                                    {PRESET_ZONES.map(z => (
                                        <option key={z} value={z}>{z}</option>
                                    ))}
                                    <option value="custom">Zona personalizada...</option>
                                </select>
                                {formZone === 'custom' && (
                                    <Input
                                        value={formCustomZone}
                                        onChange={e => setFormCustomZone(e.target.value)}
                                        placeholder="Nombre de la zona"
                                        className="bg-black/40 border-white/10 text-sm mt-2"
                                    />
                                )}
                            </div>

                            {/* Capacity */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                                    Capacidad (pax)
                                </label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={formCapacity}
                                    onChange={e => setFormCapacity(e.target.value)}
                                    placeholder="4"
                                    className="bg-black/40 border-white/10 text-sm"
                                />
                            </div>

                            {/* Sort Order */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                                    Orden
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={formSortOrder}
                                    onChange={e => setFormSortOrder(e.target.value)}
                                    placeholder="0"
                                    className="bg-black/40 border-white/10 text-sm"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                            <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                disabled={isMutating}
                                className="bg-[#93B59D] hover:bg-[#93B59D]/80 text-[#121413] font-semibold"
                            >
                                {isMutating ? 'Guardando...' : editingTable ? 'Guardar cambios' : 'Crear mesa'}
                            </Button>
                        </div>
                    </form>
                </Card>
            )}

            {/* ── Zone Filter ── */}
            {zones.length > 2 && (
                <div className="flex gap-2 flex-wrap">
                    {zones.map(zone => (
                        <button
                            key={zone}
                            onClick={() => setFilterZone(zone)}
                            className={`
                                px-3 py-1.5 rounded-full text-xs font-semibold transition-all
                                ${filterZone === zone
                                    ? 'bg-[#93B59D] text-[#121413] shadow-[0_0_10px_rgba(147,181,157,0.25)]'
                                    : 'bg-white/[0.04] text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-300 border border-white/[0.05]'
                                }
                            `}
                        >
                            {zone}
                        </button>
                    ))}
                </div>
            )}

            {/* ── Tables Grid ── */}
            {isLoading ? (
                <div className="py-16 text-center text-zinc-500 text-sm">Cargando mesas...</div>
            ) : filteredTables.length === 0 ? (
                <div className="py-20 text-center border border-dashed border-white/[0.06] rounded-2xl bg-white/[0.01]">
                    <LayoutGrid className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                    <h3 className="text-base font-medium text-white mb-1">Sin mesas en esta zona</h3>
                    <p className="text-sm text-zinc-500">
                        {tables.length === 0
                            ? 'Crea tu primera mesa o usa las predeterminadas.'
                            : `No hay mesas en "${filterZone}".`}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {filteredTables.map(table => (
                        <Card
                            key={table.id}
                            className={`
                                relative p-4 overflow-hidden
                                ${table.isOccupied
                                    ? 'bg-amber-500/[0.07] border-amber-500/25'
                                    : 'bg-[#0a0a0c] border-white/[0.05] hover:border-[#93B59D]/20'
                                }
                                transition-colors
                            `}
                        >
                            {/* Status indicator */}
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="font-bold text-sm text-white leading-none">{table.name}</h3>
                                    {table.zone && (
                                        <div className="flex items-center gap-1 mt-1">
                                            <MapPin className="w-3 h-3 text-zinc-600" />
                                            <span className="text-[11px] text-zinc-500">{table.zone}</span>
                                        </div>
                                    )}
                                </div>
                                {table.isOccupied
                                    ? <div className="w-2 h-2 rounded-full bg-amber-400 mt-0.5 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
                                    : <div className="w-2 h-2 rounded-full bg-[#93B59D] mt-0.5 shadow-[0_0_5px_rgba(147,181,157,0.4)]" />
                                }
                            </div>

                            {/* Capacity */}
                            {table.capacity && (
                                <div className="flex items-center gap-1 mb-3">
                                    <Users className="w-3 h-3 text-zinc-600" />
                                    <span className="text-[11px] text-zinc-500">{table.capacity} pax</span>
                                </div>
                            )}

                            {/* Ticket info */}
                            {table.isOccupied && table.currentTicket ? (
                                <div className="mb-3 p-2 bg-amber-500/10 rounded-lg border border-amber-500/15">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-amber-400 font-mono">
                                            ${table.currentTicket.totalAmount.toFixed(2)}
                                        </span>
                                        <div className="flex items-center gap-1 text-[10px] text-amber-400/60">
                                            <Clock className="w-3 h-3" />
                                            <span>{timeElapsed(table.currentTicket.createdAt)}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {/* Status badge */}
                            <div className="flex items-center gap-1 mb-4">
                                {table.isOccupied
                                    ? <><Circle className="w-3 h-3 text-amber-400 fill-amber-400" /><span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide">Ocupada</span></>
                                    : <><CheckCircle2 className="w-3 h-3 text-[#93B59D]" /><span className="text-[10px] text-[#93B59D] font-semibold uppercase tracking-wide">Libre</span></>
                                }
                            </div>

                            {/* Actions */}
                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => openEdit(table)}
                                    className="flex-1 py-1.5 text-xs text-zinc-400 bg-white/[0.04] hover:bg-white/[0.08]
                                        border border-white/[0.05] rounded-lg transition-colors flex items-center justify-center gap-1"
                                >
                                    <Edit2 className="w-3 h-3" />
                                    Editar
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm(`¿Eliminar "${table.name}"?`)) {
                                            deleteMutation.mutate(table.id);
                                        }
                                    }}
                                    className="p-1.5 text-zinc-600 hover:text-red-400 bg-white/[0.04] hover:bg-red-500/10
                                        border border-white/[0.05] hover:border-red-500/20 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
