import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Check, Monitor, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
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

interface ProductOption {
    id: string;
    name: string;
    categoryId?: string | null;
    kdsStation?: string | null;
    isActive: boolean;
}

const COLORS = ['#93B59D', '#FBBF24', '#F87171', '#818CF8', '#34D399', '#F472B6', '#FB923C', '#38BDF8'];

export default function KdsStations() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [color, setColor] = useState(COLORS[0]);
    const [categoriesInput, setCategoriesInput] = useState('');
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [productSearch, setProductSearch] = useState('');

    const { data: stations = [], isLoading } = useQuery<Station[]>({
        queryKey: ['kitchen-stations'],
        queryFn: async () => {
            const res = await api.get('/kitchen-stations');
            return res.data?.data || [];
        },
    });

    const { data: products = [] } = useQuery<ProductOption[]>({
        queryKey: ['kds-products'],
        queryFn: async () => {
            const res = await api.get('/products?limit=500');
            const productList = (res.data?.data || res.data || []) as ProductOption[];
            return productList.filter((product) => product.isActive).sort((a, b) => a.name.localeCompare(b.name));
        },
    });

    const categories = useMemo(() => {
        return [...new Set(products.map((product) => product.categoryId).filter(Boolean) as string[])].sort();
    }, [products]);

    const createMutation = useMutation({
        mutationFn: async (data: any) => editId
            ? api.put(`/kitchen-stations/${editId}`, data)
            : api.post('/kitchen-stations', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kitchen-stations'] });
            queryClient.invalidateQueries({ queryKey: ['kds-products'] });
            resetForm();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => api.delete(`/kitchen-stations/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kitchen-stations'] });
            queryClient.invalidateQueries({ queryKey: ['kds-products'] });
        },
    });

    const syncMutation = useMutation({
        mutationFn: async () => api.post('/kitchen-stations/sync'),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kitchen-stations'] });
            queryClient.invalidateQueries({ queryKey: ['kds-products'] });
        },
    });

    const resetForm = () => {
        setShowForm(false);
        setEditId(null);
        setName('');
        setColor(COLORS[0]);
        setCategoriesInput('');
        setSelectedProductIds([]);
        setProductSearch('');
    };

    const handleEdit = (station: Station) => {
        setEditId(station.id);
        setName(station.name);
        setColor(station.color);
        setCategoriesInput((station.categories || []).join(', '));
        setSelectedProductIds((station.productIds as string[]) || []);
        setProductSearch('');
        setShowForm(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const categories = categoriesInput.split(',').map((category) => category.trim()).filter(Boolean);
        createMutation.mutate({
            name,
            color,
            categories,
            productIds: selectedProductIds,
        });
    };

    const assignedCategories = new Set(stations.flatMap((station) => (station.categories as string[]) || []));
    const assignedProductIds = new Set(
        stations
            .filter((station) => station.id !== editId)
            .flatMap((station) => (station.productIds as string[]) || [])
    );

    const selectedProducts = products.filter((product) => selectedProductIds.includes(product.id));
    const filteredProducts = products.filter((product) => {
        const q = productSearch.trim().toLowerCase();
        if (!q) return true;
        return product.name.toLowerCase().includes(q) || (product.categoryId || '').toLowerCase().includes(q);
    });

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <Monitor className="w-6 h-6 text-[#93B59D]" />
                        Estaciones KDS
                    </h1>
                    <p className="text-zinc-400 mt-1">
                        Configura pantallas de cocina y dirige productos del menu por categoria o manualmente.
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
                    <Button
                        onClick={() => {
                            resetForm();
                            setShowForm(true);
                        }}
                        className="bg-[#93B59D] hover:bg-[#93B59D]/80 text-[#121413]"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Nueva Estacion
                    </Button>
                </div>
            </div>

            {showForm && (
                <Card className="p-5 bg-black/40 border-[#93B59D]/20 backdrop-blur-xl animate-in slide-in-from-top-4">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">Nombre</label>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ej. Cocina, Barra, Postres"
                                    className="bg-black/40 border-white/10"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">Color</label>
                                <div className="flex gap-2">
                                    {COLORS.map((swatch) => (
                                        <button
                                            key={swatch}
                                            type="button"
                                            onClick={() => setColor(swatch)}
                                            className="w-8 h-8 rounded-lg border-2 transition-all"
                                            style={{
                                                background: swatch,
                                                borderColor: color === swatch ? 'white' : 'transparent',
                                                opacity: color === swatch ? 1 : 0.4,
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">Categorias (coma)</label>
                                <Input
                                    value={categoriesInput}
                                    onChange={(e) => setCategoriesInput(e.target.value)}
                                    placeholder="Ej. Bebidas, Cocteles"
                                    className="bg-black/40 border-white/10"
                                />
                            </div>
                        </div>

                        {categories.length > 0 && (
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">Categorias disponibles</label>
                                <div className="flex flex-wrap gap-2">
                                    {categories.map((category) => {
                                        const currentCategories = categoriesInput.split(',').map((entry) => entry.trim()).filter(Boolean);
                                        const isSelected = currentCategories.includes(category);
                                        const isAssigned = assignedCategories.has(category) && !isSelected;
                                        return (
                                            <button
                                                key={category}
                                                type="button"
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setCategoriesInput(currentCategories.filter((entry) => entry !== category).join(', '));
                                                        return;
                                                    }
                                                    setCategoriesInput([...currentCategories, category].join(', '));
                                                }}
                                                disabled={isAssigned}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                                    isSelected
                                                        ? 'bg-[#93B59D]/15 border-[#93B59D]/30 text-[#93B59D]'
                                                        : isAssigned
                                                            ? 'bg-black/20 border-white/5 text-zinc-600 cursor-not-allowed line-through'
                                                            : 'bg-black/20 border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
                                                }`}
                                            >
                                                {category}
                                                {isSelected && <Check className="w-3 h-3 inline ml-1" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-zinc-400 uppercase">Productos manuales</label>
                                    <p className="text-[11px] text-zinc-500 mt-1">
                                        Productos del menu de Zona 1 que deben ir a esta estacion aunque no dependan solo de la categoria.
                                    </p>
                                </div>
                                <div className="text-[11px] text-zinc-500 shrink-0">
                                    {selectedProductIds.length} producto(s)
                                </div>
                            </div>

                            <Input
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                placeholder="Buscar producto o categoria..."
                                className="bg-black/40 border-white/10"
                            />

                            {selectedProducts.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {selectedProducts.map((product) => (
                                        <button
                                            key={product.id}
                                            type="button"
                                            onClick={() => setSelectedProductIds((prev) => prev.filter((id) => id !== product.id))}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-[#93B59D]/15 border-[#93B59D]/30 text-[#93B59D]"
                                        >
                                            {product.name}
                                            {product.categoryId ? ` · ${product.categoryId}` : ''}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-black/20">
                                {filteredProducts.length === 0 ? (
                                    <div className="px-4 py-6 text-center text-sm text-zinc-500">
                                        No hay productos que coincidan.
                                    </div>
                                ) : (
                                    filteredProducts.map((product) => {
                                        const isSelected = selectedProductIds.includes(product.id);
                                        const isAssigned = assignedProductIds.has(product.id) && !isSelected;
                                        return (
                                            <button
                                                key={product.id}
                                                type="button"
                                                onClick={() => {
                                                    if (isAssigned) return;
                                                    setSelectedProductIds((prev) =>
                                                        isSelected ? prev.filter((id) => id !== product.id) : [...prev, product.id]
                                                    );
                                                }}
                                                disabled={isAssigned}
                                                className={`w-full px-4 py-3 text-left border-b border-white/5 last:border-b-0 transition-colors ${
                                                    isSelected
                                                        ? 'bg-[#93B59D]/10'
                                                        : isAssigned
                                                            ? 'bg-white/[0.02] opacity-50 cursor-not-allowed'
                                                            : 'hover:bg-white/[0.03]'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className={`text-sm font-medium ${isSelected ? 'text-[#93B59D]' : 'text-zinc-200'}`}>
                                                            {product.name}
                                                        </div>
                                                        <div className="text-[11px] text-zinc-500 mt-1">
                                                            {product.categoryId || 'Sin categoria'}
                                                            {product.kdsStation ? ` · actual: ${product.kdsStation}` : ''}
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0 text-[11px] font-medium">
                                                        {isSelected ? (
                                                            <span className="text-[#93B59D]">Asignado</span>
                                                        ) : isAssigned ? (
                                                            <span className="text-zinc-500">Otra estacion</span>
                                                        ) : (
                                                            <span className="text-zinc-500">Agregar</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="ghost" onClick={resetForm}>Cancelar</Button>
                            <Button
                                type="submit"
                                className="bg-[#93B59D] hover:bg-[#93B59D]/80 text-[#121413] font-semibold"
                                disabled={createMutation.isPending}
                            >
                                {editId ? 'Guardar cambios' : 'Crear estacion'}
                            </Button>
                        </div>
                    </form>
                </Card>
            )}

            {isLoading ? (
                <div className="py-20 text-center text-zinc-500">Cargando estaciones...</div>
            ) : stations.length === 0 ? (
                <div className="py-20 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                    <Monitor className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-white mb-1">Sin estaciones configuradas</h3>
                    <p className="text-sm text-zinc-400">
                        Crea estaciones como Cocina y Barra para enrutar pedidos automaticamente.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stations.map((station) => (
                        <Card key={station.id} className="p-5 bg-[#0a0a0c] border-white/5 relative group">
                            <div className="flex items-center gap-3 mb-3">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: `${station.color}20`, border: `1px solid ${station.color}40` }}
                                >
                                    <Monitor className="w-5 h-5" style={{ color: station.color }} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-white">{station.name}</h3>
                                    <p className="text-xs text-zinc-500">
                                        {`${((station.categories as string[]) || []).length} categoria(s) · ${((station.productIds as string[]) || []).length} producto(s)`}
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

                            <div className="flex flex-wrap gap-1.5">
                                {((station.categories as string[]) || []).map((category) => (
                                    <span
                                        key={category}
                                        className="px-2 py-0.5 rounded text-[11px] font-medium"
                                        style={{ background: `${station.color}15`, color: station.color, border: `1px solid ${station.color}25` }}
                                    >
                                        {category}
                                    </span>
                                ))}
                                {((station.productIds as string[]) || []).length > 0 && (
                                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-white/5 text-zinc-300 border border-white/10">
                                        {((station.productIds as string[]) || []).length} productos manuales
                                    </span>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
