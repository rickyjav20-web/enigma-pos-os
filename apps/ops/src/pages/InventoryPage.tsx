import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Package, ChevronRight, Scale, Tag, DollarSign, X, TrendingUp, TrendingDown, History, ShoppingCart, Edit3 } from 'lucide-react';

const API_URL = 'https://enigma-pos-os-production.up.railway.app/api/v1';
const TENANT_HEADER = { 'x-tenant-id': 'enigma_hq', 'Content-Type': 'application/json' };

interface SupplyItem {
    id: string;
    name: string;
    sku: string;
    category: string;
    currentCost: number;
    averageCost?: number;
    defaultUnit: string;
    stockQuantity?: number;
}

interface PriceHistoryEntry {
    id: string;
    oldCost: number;
    newCost: number;
    createdAt: string;
    supplier?: { name: string };
}

const CATEGORIES = ['Lácteos', 'Panadería', 'Carnes', 'Vegetales', 'Bebidas', 'Secos', 'Frescos', 'Postres', 'Otros'];
const UNITS = ['kg', 'g', 'L', 'ml', 'und', 'docena', 'caja'];

export default function InventoryPage() {
    const navigate = useNavigate();
    const [items, setItems] = useState<SupplyItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);

    // Item Detail
    const [selectedItem, setSelectedItem] = useState<SupplyItem | null>(null);
    const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Edit Mode
    const [editMode, setEditMode] = useState(false);
    const [editedCost, setEditedCost] = useState(0);

    // New item form
    const [newItem, setNewItem] = useState({
        name: '',
        sku: '',
        category: 'Otros',
        defaultUnit: 'kg',
        currentCost: 0
    });

    useEffect(() => {
        loadItems();
    }, []);

    const loadItems = async () => {
        try {
            const res = await fetch(`${API_URL}/supply-items?limit=1000`, {
                headers: TENANT_HEADER
            });
            const data = await res.json();
            setItems(data?.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadPriceHistory = async (itemId: string) => {
        setLoadingHistory(true);
        try {
            const res = await fetch(`${API_URL}/supply-items/${itemId}/price-history`);
            if (res.ok) {
                const data = await res.json();
                setPriceHistory(data || []);
            } else {
                setPriceHistory([]);
            }
        } catch (e) {
            console.error(e);
            setPriceHistory([]);
        } finally {
            setLoadingHistory(false);
        }
    };

    const openItemDetail = async (item: SupplyItem) => {
        setSelectedItem(item);
        setEditedCost(item.currentCost);
        setEditMode(false);
        loadPriceHistory(item.id);
    };

    const updateItemCost = async () => {
        if (!selectedItem) return;

        try {
            const res = await fetch(`${API_URL}/supply-items/${selectedItem.id}`, {
                method: 'PATCH',
                headers: TENANT_HEADER,
                body: JSON.stringify({ currentCost: editedCost })
            });

            if (res.ok) {
                const updated = await res.json();
                setItems(items.map(i => i.id === updated.id ? updated : i));
                setSelectedItem(updated);
                setEditMode(false);
                loadPriceHistory(updated.id);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const createItem = async () => {
        if (!newItem.name.trim()) return;

        try {
            const res = await fetch(`${API_URL}/supply-items`, {
                method: 'POST',
                headers: TENANT_HEADER,
                body: JSON.stringify({
                    ...newItem,
                    sku: newItem.sku || `SKU-${Date.now()}`,
                    currentCost: Number(newItem.currentCost)
                })
            });

            if (res.ok) {
                const created = await res.json();
                setItems([created, ...items]);
                setShowModal(false);
                setNewItem({ name: '', sku: '', category: 'Otros', defaultUnit: 'kg', currentCost: 0 });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const filteredItems = items.filter(i =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const priceChange = selectedItem ?
        (selectedItem.currentCost - (selectedItem.averageCost || selectedItem.currentCost)) : 0;
    const priceChangePercent = selectedItem?.averageCost && selectedItem.averageCost > 0 ?
        ((priceChange / selectedItem.averageCost) * 100) : 0;

    return (
        <div className="min-h-screen bg-enigma-black p-4 pb-24">
            {/* Header */}
            <header className="mb-6">
                <h1 className="text-2xl font-bold">Inventario</h1>
                <p className="text-sm text-white/40">Gestiona tus ingredientes y productos</p>
            </header>

            {/* Search + Add */}
            <div className="flex gap-3 mb-6">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                    <input
                        type="text"
                        placeholder="Buscar ingredientes..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-enigma-gray/50 rounded-xl border border-white/10 
                            text-white placeholder-white/30 focus:border-enigma-purple focus:outline-none"
                    />
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="w-12 h-12 bg-enigma-purple rounded-xl flex items-center justify-center
                        hover:bg-enigma-purple/80 transition-all active:scale-95"
                >
                    <Plus className="w-6 h-6" />
                </button>
            </div>

            {/* Stats Bar */}
            <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
                <div className="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-blue-500/5 
                    border border-blue-500/20 rounded-xl">
                    <p className="text-lg font-bold text-blue-400">{items.length}</p>
                    <p className="text-[10px] text-white/50">Items</p>
                </div>
                <div className="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 
                    border border-emerald-500/20 rounded-xl">
                    <p className="text-lg font-bold text-emerald-400">
                        {new Set(items.map(i => i.category)).size}
                    </p>
                    <p className="text-[10px] text-white/50">Categorías</p>
                </div>
            </div>

            {/* Items List */}
            <div className="space-y-2">
                {loading ? (
                    <div className="text-center py-8 text-white/40">Cargando...</div>
                ) : filteredItems.length === 0 ? (
                    <div className="text-center py-8 text-white/40">
                        {searchQuery ? 'Sin resultados' : 'No hay items'}
                    </div>
                ) : (
                    filteredItems.map(item => (
                        <div
                            key={item.id}
                            onClick={() => openItemDetail(item)}
                            className="flex items-center gap-4 p-4 bg-enigma-gray/30 rounded-xl 
                                border border-white/5 hover:border-enigma-purple/30 transition-all cursor-pointer"
                        >
                            <div className="w-12 h-12 rounded-xl bg-enigma-purple/10 flex items-center justify-center">
                                <Package className="w-6 h-6 text-enigma-purple" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{item.name}</p>
                                <div className="flex items-center gap-3 text-xs text-white/40">
                                    <span className="flex items-center gap-1">
                                        <Tag className="w-3 h-3" /> {item.category}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Scale className="w-3 h-3" /> {item.defaultUnit}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-mono text-enigma-green">${item.currentCost.toFixed(2)}</p>
                                <p className="text-[10px] text-white/30">/{item.defaultUnit}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-white/20" />
                        </div>
                    ))
                )}
            </div>

            {/* Item Detail Modal */}
            {selectedItem && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end animate-fade-in"
                    onClick={() => setSelectedItem(null)}>
                    <div className="w-full bg-enigma-gray rounded-t-3xl p-6 animate-slide-up max-h-[85vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-xl font-bold">{selectedItem.name}</h2>
                                <div className="flex items-center gap-3 text-sm text-white/40 mt-1">
                                    <span className="flex items-center gap-1">
                                        <Tag className="w-4 h-4" /> {selectedItem.category}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Scale className="w-4 h-4" /> {selectedItem.defaultUnit}
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedItem(null)} className="p-2">
                                <X className="w-6 h-6 text-white/50" />
                            </button>
                        </div>

                        {/* Price Cards */}
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="p-4 bg-enigma-black/50 rounded-2xl border border-enigma-green/20">
                                <p className="text-xs text-white/50 mb-1">Último Precio</p>
                                {editMode ? (
                                    <div className="relative">
                                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editedCost}
                                            onChange={e => setEditedCost(parseFloat(e.target.value) || 0)}
                                            className="w-full pl-7 pr-2 py-1 bg-black/50 rounded-lg border border-enigma-purple text-xl font-bold font-mono text-enigma-green focus:outline-none"
                                            autoFocus
                                        />
                                    </div>
                                ) : (
                                    <p className="text-2xl font-bold font-mono text-enigma-green">
                                        ${selectedItem.currentCost.toFixed(2)}
                                    </p>
                                )}
                            </div>
                            <div className="p-4 bg-enigma-black/50 rounded-2xl border border-blue-500/20">
                                <p className="text-xs text-white/50 mb-1">Precio Promedio</p>
                                <p className="text-2xl font-bold font-mono text-blue-400">
                                    ${(selectedItem.averageCost || selectedItem.currentCost).toFixed(2)}
                                </p>
                                {Math.abs(priceChangePercent) > 0.1 && (
                                    <div className={`flex items-center gap-1 text-xs mt-1 ${priceChange > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                        {priceChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        <span>{priceChange > 0 ? '+' : ''}{priceChangePercent.toFixed(1)}%</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Price History */}
                        <div className="mb-6">
                            <h3 className="text-sm font-medium text-white/50 mb-3 flex items-center gap-2">
                                <History className="w-4 h-4" /> Historial de Precios
                            </h3>
                            {loadingHistory ? (
                                <p className="text-white/30 text-sm">Cargando...</p>
                            ) : priceHistory.length === 0 ? (
                                <p className="text-white/30 text-sm p-4 bg-enigma-black/30 rounded-xl text-center">
                                    Sin cambios de precio registrados
                                </p>
                            ) : (
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {priceHistory.slice(0, 5).map(entry => (
                                        <div key={entry.id} className="flex items-center justify-between p-3 bg-enigma-black/30 rounded-xl">
                                            <div>
                                                <p className="text-sm font-mono">
                                                    <span className="text-white/40">${entry.oldCost.toFixed(2)}</span>
                                                    <span className="text-white/30 mx-2">→</span>
                                                    <span className={entry.newCost > entry.oldCost ? 'text-red-400' : 'text-enigma-green'}>
                                                        ${entry.newCost.toFixed(2)}
                                                    </span>
                                                </p>
                                                <p className="text-[10px] text-white/30">
                                                    {new Date(entry.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                                                    {entry.supplier && ` • ${entry.supplier.name}`}
                                                </p>
                                            </div>
                                            <div className={`text-sm font-medium ${entry.newCost > entry.oldCost ? 'text-red-400' : 'text-enigma-green'}`}>
                                                {entry.newCost > entry.oldCost ? '+' : ''}
                                                {((entry.newCost - entry.oldCost) / entry.oldCost * 100).toFixed(0)}%
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="space-y-3">
                            {editMode ? (
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setEditMode(false)}
                                        className="flex-1 py-3 rounded-xl bg-white/5 text-white/70 font-medium"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={updateItemCost}
                                        className="flex-1 py-3 rounded-xl bg-enigma-green font-bold flex items-center justify-center gap-2"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setEditMode(true)}
                                        className="w-full py-3 rounded-xl bg-white/5 border border-white/10 font-medium
                                            flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                                    >
                                        <Edit3 className="w-5 h-5" />
                                        Editar Precio
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedItem(null);
                                            navigate('/purchases');
                                        }}
                                        className="w-full py-4 rounded-xl bg-enigma-purple font-bold
                                            flex items-center justify-center gap-2 hover:bg-enigma-purple/80 transition-all active:scale-[0.98]"
                                    >
                                        <ShoppingCart className="w-5 h-5" />
                                        Registrar Compra
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* New Item Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end animate-fade-in">
                    <div className="w-full bg-enigma-gray rounded-t-3xl p-6 animate-slide-up">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Nuevo Ingrediente</h2>
                            <button onClick={() => setShowModal(false)} className="p-2">
                                <X className="w-6 h-6 text-white/50" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-white/50 mb-1 block">Nombre *</label>
                                <input
                                    type="text"
                                    value={newItem.name}
                                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                    placeholder="Ej: Harina de Trigo"
                                    className="w-full px-4 py-3 bg-enigma-black/50 rounded-xl border border-white/10 
                                        text-white placeholder-white/30 focus:border-enigma-purple focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm text-white/50 mb-1 block">Categoría</label>
                                    <select
                                        value={newItem.category}
                                        onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                                        className="w-full px-4 py-3 bg-enigma-black/50 rounded-xl border border-white/10 
                                            text-white focus:border-enigma-purple focus:outline-none"
                                    >
                                        {CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm text-white/50 mb-1 block">Unidad</label>
                                    <select
                                        value={newItem.defaultUnit}
                                        onChange={e => setNewItem({ ...newItem, defaultUnit: e.target.value })}
                                        className="w-full px-4 py-3 bg-enigma-black/50 rounded-xl border border-white/10 
                                            text-white focus:border-enigma-purple focus:outline-none"
                                    >
                                        {UNITS.map(unit => (
                                            <option key={unit} value={unit}>{unit}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm text-white/50 mb-1 block">Costo Inicial (por unidad)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={newItem.currentCost}
                                        onChange={e => setNewItem({ ...newItem, currentCost: parseFloat(e.target.value) || 0 })}
                                        className="w-full pl-10 pr-4 py-3 bg-enigma-black/50 rounded-xl border border-white/10 
                                            text-white focus:border-enigma-purple focus:outline-none"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={createItem}
                                disabled={!newItem.name.trim()}
                                className="w-full py-4 bg-enigma-purple rounded-xl font-bold text-lg
                                    hover:bg-enigma-purple/80 disabled:opacity-50 disabled:cursor-not-allowed
                                    transition-all active:scale-[0.98]"
                            >
                                Crear Ingrediente
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
