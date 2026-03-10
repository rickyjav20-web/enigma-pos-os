/**
 * KdsStations — HQ Back Office
 * Manage KDS stations: create Cocina, Barra, etc. and assign categories/products.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Monitor, Plus, Trash2, RefreshCw, Check, Pencil, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Station {
    id: string;
    name: string;
    color: string;
    isActive: boolean;
    sortOrder: number;
    categories: string[] | null;
    productIds: string[] | null;
}

const COLORS = ['#93B59D', '#FBBF24', '#F87171', '#818CF8', '#34D399', '#F472B6', '#FB923C', '#38BDF8'];

export default function KdsStations() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [color, setColor] = useState(COLORS[0]);
    const [categoriesInput, setCategoriesInput] = useState('');

    const { data: stations = [], isLoading } = useQuery<Station[]>({
        queryKey: ['kitchen-stations'],
        queryFn: async () => {
            const res = await api.get('/kitchen-stations');
            return res.data?.data || [];
        },
    });

    // Get unique categories from products
    const { data: categories = [] } = useQuery<string[]>({
        queryKey: ['product-categories'],
        queryFn: async () => {
            const res = await api.get('/products?limit=500');
            const prods = res.data?.data || res.data || [];
            const cats = [...new Set(prods.map((p: any) => p.categoryId).filter(Boolean))] as string[];
            return cats.sort();
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => editId
            ? api.put(`/kitchen-stations/${editId}`, data)
            : api.post('/kitchen-stations', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kitchen-stations'] });
            resetForm();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => api.delete(`/kitchen-stations/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kitchen-stations'] }),
    });

    const syncMutation = useMutation({
        mutationFn: async () => api.post('/kitchen-stations/sync'),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kitchen-stations'] }),
    });

    const resetForm = () => {
        setShowForm(false);
        setEditId(null);
        setName('');
        setColor(COLORS[0]);
        setCategoriesInput('');
    };

    const handleEdit = (station: Station) => {
        setEditId(station.id);
        setName(station.name);
        setColor(station.color);
        setCategoriesInput((station.categories || []).join(', '));
        setShowForm(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const cats = categoriesInput.split(',').map(c => c.trim()).filter(Boolean);
        createMutation.mutate({ name, color, categories: cats });
    };

    // Categories already assigned to other stations
    const assignedCategories = new Set(stations.flatMap(s => (s.categories as string[]) || []));

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <Monitor className="w-6 h-6 text-[#93B59D]" />
                        Estaciones KDS
                    </h1>
                    <p className="text-zinc-400 mt-1">
                        Configura las pantallas de cocina: cada estación muestra solo los items que le corresponden.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncMutation.mutate()}
                        disabled={syncMutation.isPending}
                        className="text-zinc-400 border-white/10"
                    >
                        <RefreshCw className={`w-4 h-4 mr-1 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                        Sincronizar productos
                    </Button>
                    <Button onClick={() => { resetForm(); setShowForm(true); }} className="bg-[#93B59D] hover:bg-[#93B59D]/80 text-[#121413]">
                        <Plus className="w-4 h-4 mr-2" /> Nueva Estación
                    </Button>
                </div>
            </div>

            {/* Create/Edit Form */}
            {showForm && (
                <Card className="p-5 bg-black/40 border-[#93B59D]/20 backdrop-blur-xl animate-in slide-in-from-top-4">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">Nombre</label>
                                <Input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Ej. Cocina, Barra, Postres"
                                    className="bg-black/40 border-white/10"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">Color</label>
                                <div className="flex gap-2">
                                    {COLORS.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setColor(c)}
                                            className="w-8 h-8 rounded-lg border-2 transition-all"
                                            style={{
                                                background: c,
                                                borderColor: color === c ? 'white' : 'transparent',
                                                opacity: color === c ? 1 : 0.4,
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">Categorías (separadas por coma)</label>
                                <Input
                                    value={categoriesInput}
                                    onChange={e => setCategoriesInput(e.target.value)}
                                    placeholder="Ej. Bebidas, Cocteles"
                                    className="bg-black/40 border-white/10"
                                />
                            </div>
                        </div>

                        {/* Category quick-pick */}
                        {categories.length > 0 && (
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">Categorías disponibles</label>
                                <div className="flex flex-wrap gap-2">
                                    {categories.map(cat => {
                                        const currentCats = categoriesInput.split(',').map(c => c.trim()).filter(Boolean);
                                        const isSelected = currentCats.includes(cat);
                                        const isAssigned = assignedCategories.has(cat) && !isSelected;
                                        return (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setCategoriesInput(currentCats.filter(c => c !== cat).join(', '));
                                                    } else {
                                                        setCategoriesInput([...currentCats, cat].join(', '));
                                                    }
                                                }}
                                                disabled={isAssigned}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${isSelected
                                                    ? 'bg-[#93B59D]/15 border-[#93B59D]/30 text-[#93B59D]'
                                                    : isAssigned
                                                        ? 'bg-black/20 border-white/5 text-zinc-600 cursor-not-allowed line-through'
                                                        : 'bg-black/20 border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
                                                    }`}
                                            >
                                                {cat}
                                                {isSelected && <Check className="w-3 h-3 inline ml-1" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="ghost" onClick={resetForm}>Cancelar</Button>
                            <Button type="submit" className="bg-[#93B59D] hover:bg-[#93B59D]/80 text-[#121413] font-semibold" disabled={createMutation.isPending}>
                                {editId ? 'Guardar cambios' : 'Crear estación'}
                            </Button>
                        </div>
                    </form>
                </Card>
            )}

            {/* Stations List */}
            {isLoading ? (
                <div className="py-20 text-center text-zinc-500">Cargando estaciones...</div>
            ) : stations.length === 0 ? (
                <div className="py-20 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                    <Monitor className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-white mb-1">Sin estaciones configuradas</h3>
                    <p className="text-sm text-zinc-400">Crea estaciones como "Cocina" y "Barra" para enrutar los pedidos automáticamente.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stations.map(station => (
                        <Card key={station.id} className="p-5 bg-[#0a0a0c] border-white/5 relative group">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${station.color}20`, border: `1px solid ${station.color}40` }}>
                                    <Monitor className="w-5 h-5" style={{ color: station.color }} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-white">{station.name}</h3>
                                    <p className="text-xs text-zinc-500">
                                        {(station.categories as string[] || []).length > 0
                                            ? `${(station.categories as string[]).length} categoría(s)`
                                            : 'Sin categorías'}
                                    </p>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(station)} className="p-1.5 rounded-lg hover:bg-white/5">
                                        <Pencil className="w-3.5 h-3.5 text-zinc-400" />
                                    </button>
                                    <button onClick={() => deleteMutation.mutate(station.id)} className="p-1.5 rounded-lg hover:bg-red-500/10">
                                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                    </button>
                                </div>
                            </div>

                            {/* Categories */}
                            <div className="flex flex-wrap gap-1.5">
                                {((station.categories as string[]) || []).map(cat => (
                                    <span key={cat} className="px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: `${station.color}15`, color: station.color, border: `1px solid ${station.color}25` }}>
                                        {cat}
                                    </span>
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
