import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Package, ChevronRight, Scale, Tag, DollarSign, X, ShoppingCart, Edit3, ChefHat, Utensils, Flame } from 'lucide-react';

const API_URL = 'https://enigma-pos-os-production.up.railway.app/api/v1';
const TENANT_HEADER = { 'x-tenant-id': 'enigma_hq', 'Content-Type': 'application/json' };

interface Ingredient {
    id: string;
    supplyItemId: string;
    quantity: number;
    unit: string;
    component?: SupplyItem;
}

interface SupplyItem {
    id: string;
    name: string;
    sku: string;
    category: string;
    currentCost: number;
    averageCost?: number;
    defaultUnit: string;
    stockQuantity?: number;
    preferredSupplierId?: string;
    // Batch Fields
    isProduction?: boolean;
    yieldQuantity?: number;
    yieldUnit?: string;
    ingredients?: Ingredient[];
}

const CATEGORIES = ['Lácteos', 'Panadería', 'Carnes', 'Vegetales', 'Bebidas', 'Secos', 'Frescos', 'Postres', 'Salsas', 'Preparaciones', 'Otros'];
const UNITS = ['kg', 'g', 'L', 'ml', 'und', 'docena', 'caja'];

export default function InventoryPage() {
    const navigate = useNavigate();
    const [items, setItems] = useState<SupplyItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);

    // Item Detail
    const [selectedItem, setSelectedItem] = useState<SupplyItem | null>(null);

    // Edit Mode
    const [editMode, setEditMode] = useState(false);
    const [editedItem, setEditedItem] = useState<Partial<SupplyItem>>({});

    // Production Modal
    const [showProductionModal, setShowProductionModal] = useState(false);
    const [productionQty, setProductionQty] = useState('');
    const [producing, setProducing] = useState(false);

    // Recipe Editor State
    const [recipeIngredients, setRecipeIngredients] = useState<Ingredient[]>([]);
    const [newIngredientId, setNewIngredientId] = useState('');
    const [newIngredientQty, setNewIngredientQty] = useState('');

    // New item form
    const [newItem, setNewItem] = useState({
        name: '',
        sku: '',
        category: 'Otros',
        defaultUnit: 'kg',
        currentCost: 0,
        isProduction: false,
        yieldQuantity: 1,
        yieldUnit: 'kg'
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

    const openItemDetail = (item: SupplyItem) => {
        setSelectedItem(item);
        setEditedItem({ ...item });
        setRecipeIngredients(item.ingredients || []);
        setEditMode(false);
    };

    const handleSaveEdit = async () => {
        if (!selectedItem || !editedItem) return;

        try {
            // Prepare body. If it's production, include ingredients
            const body: any = {
                ...editedItem,
                currentCost: Number(editedItem.currentCost),
                yieldQuantity: Number(editedItem.yieldQuantity),
            };

            if (editedItem.isProduction) {
                body.ingredients = recipeIngredients.map(ing => ({
                    id: ing.supplyItemId || ing.component?.id, // Handle both existing and new
                    quantity: Number(ing.quantity),
                    unit: ing.unit || 'und'
                }));
            }

            const res = await fetch(`${API_URL}/supply-items/${selectedItem.id}`, {
                method: 'PUT', // Changed to PUT for full update support
                headers: TENANT_HEADER,
                body: JSON.stringify(body)
            });

            if (res.ok) {
                const updated = await res.json();

                // Refresh list with new data
                const newItems = items.map(i => i.id === updated.id ? updated : i);
                setItems(newItems);

                // Fetch fresh details (including populated ingredients)
                const freshRes = await fetch(`${API_URL}/supply-items/${updated.id}`);
                const freshData = await freshRes.json();

                setSelectedItem(freshData);
                setEditMode(false);
            }
        } catch (e) {
            console.error(e);
            alert("Error saving item");
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
                    currentCost: Number(newItem.currentCost),
                    // If production, yield is important
                    yieldQuantity: newItem.isProduction ? Number(newItem.yieldQuantity) : null,
                    yieldUnit: newItem.isProduction ? newItem.yieldUnit : null
                })
            });

            if (res.ok) {
                const created = await res.json();
                setItems([created, ...items]);
                setShowModal(false);
                setNewItem({
                    name: '', sku: '', category: 'Otros', defaultUnit: 'kg', currentCost: 0,
                    isProduction: false, yieldQuantity: 1, yieldUnit: 'kg'
                });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const executeProduction = async () => {
        if (!selectedItem || !productionQty) return;
        setProducing(true);

        try {
            const res = await fetch(`${API_URL}/production`, {
                method: 'POST',
                headers: TENANT_HEADER,
                body: JSON.stringify({
                    supplyItemId: selectedItem.id,
                    quantity: Number(productionQty),
                    unit: selectedItem.yieldUnit || selectedItem.defaultUnit
                })
            });

            if (res.ok) {
                const result = await res.json();
                alert(`¡Producción Exitosa!\nNuevo Stock: ${result.newStock}`);
                setShowProductionModal(false);
                setProductionQty('');

                // Refresh Item
                const freshRes = await fetch(`${API_URL}/supply-items/${selectedItem.id}`);
                const freshData = await freshRes.json();
                setSelectedItem(freshData);
                setItems(items.map(i => i.id === freshData.id ? freshData : i));
            } else {
                const err = await res.json();
                alert(`Error: ${err.error || 'Fallo en producción'}`);
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión");
        } finally {
            setProducing(false);
        }
    };

    // Recipe Editor Helpers
    const addIngredient = () => {
        if (!newIngredientId || !newIngredientQty) return;
        const component = items.find(i => i.id === newIngredientId);
        if (!component) return;

        const newIng: Ingredient = {
            id: `temp-${Date.now()}`,
            supplyItemId: component.id,
            quantity: Number(newIngredientQty),
            unit: component.defaultUnit, // Default to component's unit
            component: component
        };

        setRecipeIngredients([...recipeIngredients, newIng]);
        setNewIngredientId('');
        setNewIngredientQty('');
    };

    const removeIngredient = (index: number) => {
        const newIngs = [...recipeIngredients];
        newIngs.splice(index, 1);
        setRecipeIngredients(newIngs);
    };

    const filteredItems = items.filter(i =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-enigma-black p-4 pb-24">
            {/* Header */}
            <header className="mb-6">
                <h1 className="text-2xl font-bold">Inventario & Cocina</h1>
                <p className="text-sm text-white/40">Gestiona ingredientes y recetas de producción</p>
            </header>

            {/* Search + Add */}
            <div className="flex gap-3 mb-6">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                    <input
                        type="text"
                        placeholder="Buscar ingredientes o recetas..."
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
                    <p className="text-lg font-bold text-blue-400">{items.filter(i => !i.isProduction).length}</p>
                    <p className="text-[10px] text-white/50">Insumos</p>
                </div>
                <div className="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-orange-500/10 to-orange-500/5 
                    border border-orange-500/20 rounded-xl">
                    <p className="text-lg font-bold text-orange-400">{items.filter(i => i.isProduction).length}</p>
                    <p className="text-[10px] text-white/50">Recetas (Batches)</p>
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
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.isProduction ? 'bg-orange-500/10' : 'bg-enigma-purple/10'
                                }`}>
                                {item.isProduction ? (
                                    <ChefHat className="w-6 h-6 text-orange-400" />
                                ) : (
                                    <Package className="w-6 h-6 text-enigma-purple" />
                                )}
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
                                {item.isProduction && (
                                    <p className="text-[10px] text-orange-400 flex items-center justify-end gap-1">
                                        <Flame className="w-3 h-3" /> Producción
                                    </p>
                                )}
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
                    <div className="w-full bg-enigma-gray rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    {selectedItem.name}
                                    {selectedItem.isProduction && <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-1 rounded-full border border-orange-500/30">Batch</span>}
                                </h2>
                                <div className="flex items-center gap-3 text-sm text-white/40 mt-1">
                                    <span className="flex items-center gap-1">
                                        <Tag className="w-4 h-4" /> {selectedItem.category}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Scale className="w-4 h-4" /> {selectedItem.defaultUnit}
                                    </span>
                                    {selectedItem.stockQuantity !== undefined && (
                                        <span className="flex items-center gap-1 text-enigma-green">
                                            <Package className="w-4 h-4" /> Stock: {selectedItem.stockQuantity}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button onClick={() => setSelectedItem(null)} className="p-2">
                                <X className="w-6 h-6 text-white/50" />
                            </button>
                        </div>

                        {/* Edit Form - Properties */}
                        {editMode ? (
                            <div className="space-y-4 mb-6 bg-black/30 p-4 rounded-xl border border-white/5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-white/50 block mb-1">Nombre</label>
                                        <input
                                            value={editedItem.name}
                                            onChange={e => setEditedItem({ ...editedItem, name: e.target.value })}
                                            className="w-full bg-black/50 p-2 rounded border border-white/10 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-white/50 block mb-1">Costo ($)</label>
                                        <input
                                            type="number"
                                            value={editedItem.currentCost}
                                            onChange={e => setEditedItem({ ...editedItem, currentCost: Number(e.target.value) })}
                                            className="w-full bg-black/50 p-2 rounded border border-white/10 text-white"
                                            disabled={!!editedItem.isProduction} // Auto-calculated if production
                                        />
                                    </div>
                                </div>
                                {editedItem.isProduction && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-white/50 block mb-1">Rendimiento (Yield)</label>
                                            <input
                                                type="number"
                                                value={editedItem.yieldQuantity}
                                                onChange={e => setEditedItem({ ...editedItem, yieldQuantity: Number(e.target.value) })}
                                                className="w-full bg-black/50 p-2 rounded border border-white/10 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-white/50 block mb-1">Unidad Batch</label>
                                            <select
                                                value={editedItem.yieldUnit}
                                                onChange={e => setEditedItem({ ...editedItem, yieldUnit: e.target.value })}
                                                className="w-full bg-black/50 p-2 rounded border border-white/10 text-white"
                                            >
                                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : null}

                        {/* Recipe Editor (Only available in Edit Mode + Production Type) */}
                        {editMode && editedItem.isProduction && (
                            <div className="mb-6 space-y-3">
                                <h3 className="text-sm font-bold text-orange-400 flex items-center gap-2">
                                    <Utensils className="w-4 h-4" /> Receta (Ingredientes)
                                </h3>

                                <div className="space-y-2">
                                    {recipeIngredients.map((ing, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 bg-black/30 rounded-lg border border-white/5">
                                            <div className="text-sm">
                                                <span className="text-white">{ing.component?.name}</span>
                                                <span className="text-white/50 ml-2">x {ing.quantity} {ing.unit}</span>
                                            </div>
                                            <button onClick={() => removeIngredient(idx)} className="p-1 hover:text-red-400">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Add Ingredient Form */}
                                <div className="flex gap-2">
                                    <select
                                        value={newIngredientId}
                                        onChange={e => setNewIngredientId(e.target.value)}
                                        className="flex-1 bg-black/50 rounded-lg border border-white/10 text-sm p-2 text-white"
                                    >
                                        <option value="">+ Agregar ingrediente...</option>
                                        {items.filter(i => i.id !== selectedItem.id).map(i => (
                                            <option key={i.id} value={i.id}>{i.name}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        placeholder="Cant."
                                        value={newIngredientQty}
                                        onChange={e => setNewIngredientQty(e.target.value)}
                                        className="w-20 bg-black/50 rounded-lg border border-white/10 text-sm p-2 text-white"
                                    />
                                    <button
                                        onClick={addIngredient}
                                        className="bg-enigma-purple px-3 rounded-lg text-white"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Read-Only Recipe View */}
                        {!editMode && selectedItem.isProduction && selectedItem.ingredients && selectedItem.ingredients.length > 0 && (
                            <div className="mb-6 p-4 bg-orange-500/5 rounded-2xl border border-orange-500/20">
                                <h3 className="text-sm font-bold text-orange-400 mb-2">Composición:</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {selectedItem.ingredients.map(ing => (
                                        <div key={ing.id} className="text-xs text-white/70 flex items-center gap-1">
                                            <span className="w-1 h-1 rounded-full bg-orange-500"></span>
                                            {ing.component?.name || 'Item'} ({ing.quantity} {ing.unit})
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

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
                                        onClick={handleSaveEdit}
                                        className="flex-1 py-3 rounded-xl bg-enigma-green font-bold flex items-center justify-center gap-2"
                                    >
                                        Guardar Cambios
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {selectedItem.isProduction ? (
                                        <button
                                            onClick={() => setShowProductionModal(true)}
                                            className="w-full py-4 rounded-xl bg-orange-500 font-bold text-white
                                                flex items-center justify-center gap-2 hover:bg-orange-600 transition-all active:scale-[0.98] shadow-lg shadow-orange-500/20"
                                        >
                                            <ChefHat className="w-5 h-5" />
                                            Ejecutar Producción
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                setSelectedItem(null);
                                                navigate(`/purchases?supplierId=${selectedItem.preferredSupplierId || ''}`); // Simple redirect logic
                                            }}
                                            className="w-full py-4 rounded-xl bg-enigma-purple font-bold
                                                flex items-center justify-center gap-2 hover:bg-enigma-purple/80 transition-all active:scale-[0.98]"
                                        >
                                            <ShoppingCart className="w-5 h-5" />
                                            Registrar Compra
                                        </button>
                                    )}

                                    <button
                                        onClick={() => setEditMode(true)}
                                        className="w-full py-3 rounded-xl bg-white/5 border border-white/10 font-medium
                                            flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                                    >
                                        <Edit3 className="w-5 h-5" />
                                        Editar {selectedItem.isProduction ? 'Receta' : 'Detalles'}
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
                            <h2 className="text-xl font-bold">Nuevo Item</h2>
                            <button onClick={() => setShowModal(false)} className="p-2">
                                <X className="w-6 h-6 text-white/50" />
                            </button>
                        </div>

                        {/* Type Selector (New) */}
                        <div className="flex gap-2 mb-6 p-1 bg-black/30 rounded-xl">
                            <button
                                onClick={() => setNewItem({ ...newItem, isProduction: false })}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${!newItem.isProduction ? 'bg-enigma-purple text-white' : 'text-white/50'}`}
                            >
                                Insumo (Compra)
                            </button>
                            <button
                                onClick={() => setNewItem({ ...newItem, isProduction: true })}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${newItem.isProduction ? 'bg-orange-500 text-white' : 'text-white/50'}`}
                            >
                                Producción (Batch)
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-white/50 mb-1 block">Nombre *</label>
                                <input
                                    type="text"
                                    value={newItem.name}
                                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                    placeholder={newItem.isProduction ? "Ej: Salsa Napolitana" : "Ej: Harina de Trigo"}
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
                                    <label className="text-sm text-white/50 mb-1 block">Unidad Base</label>
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

                            {newItem.isProduction && (
                                <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                                    <p className="text-orange-400 text-xs font-bold mb-2 flex items-center gap-1">
                                        <Scale className="w-3 h-3" /> RENDIMIENTO DE LOTE
                                    </p>
                                    <div className="flex gap-3 items-center">
                                        <div className="flex-1">
                                            <label className="text-[10px] text-white/50 block mb-1">Cantidad Resultante</label>
                                            <input
                                                type="number"
                                                value={newItem.yieldQuantity}
                                                onChange={e => setNewItem({ ...newItem, yieldQuantity: Number(e.target.value) })}
                                                className="w-full p-2 bg-black/30 rounded border border-white/10 text-white"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] text-white/50 block mb-1">Unidad</label>
                                            <select
                                                value={newItem.yieldUnit}
                                                onChange={e => setNewItem({ ...newItem, yieldUnit: e.target.value })}
                                                className="w-full p-2 bg-black/30 rounded border border-white/10 text-white"
                                            >
                                                {UNITS.map(unit => (
                                                    <option key={unit} value={unit}>{unit}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-white/40 mt-2 italic">
                                        Define cuánto se produce en una sola tanda (Batch) de esta receta.
                                    </p>
                                </div>
                            )}

                            {!newItem.isProduction && (
                                <div>
                                    <label className="text-sm text-white/50 mb-1 block">Costo Inicial</label>
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
                            )}

                            <button
                                onClick={createItem}
                                disabled={!newItem.name.trim()}
                                className={`w-full py-4 rounded-xl font-bold text-lg transition-all active:scale-[0.98]
                                    ${newItem.isProduction ? 'bg-orange-500 hover:bg-orange-600' : 'bg-enigma-purple hover:bg-enigma-purple/80'}
                                    disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                Crear {newItem.isProduction ? 'Lote de Producción' : 'Ingrediente'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Production Execution Modal */}
            {showProductionModal && selectedItem && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center animate-fade-in">
                    <div className="bg-enigma-gray border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-6">
                        <div className="text-center space-y-2">
                            <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                                <ChefHat className="w-8 h-8 text-orange-500" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Ejecutar Producción</h3>
                            <p className="text-white/50">Estás produciendo <span className="text-orange-400 font-bold">{selectedItem.name}</span></p>

                            <div className="p-3 bg-white/5 rounded-lg border border-white/5 text-sm flex justify-between items-center">
                                <span className="text-white/40">Rendimiento (1 Batch):</span>
                                <span className="font-mono text-white font-bold">{selectedItem.yieldQuantity} {selectedItem.yieldUnit}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs uppercase text-white/40 mb-1">¿Cuántos Batches hiciste?</label>
                                <div className="flex gap-2 items-center">
                                    <button
                                        onClick={() => setProductionQty(String(Math.max(1, (Number(productionQty) / (selectedItem.yieldQuantity || 1)) - 1) * (selectedItem.yieldQuantity || 1)))}
                                        className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xl font-bold"
                                    >-</button>

                                    <div className="flex-1 relative">
                                        <input
                                            type="number"
                                            value={productionQty ? (Number(productionQty) / (selectedItem.yieldQuantity || 1)) : ''}
                                            onChange={e => setProductionQty(String(Number(e.target.value) * (selectedItem.yieldQuantity || 1)))}
                                            placeholder="1"
                                            className="w-full bg-black/50 border border-orange-500/50 rounded-xl p-3 text-2xl font-bold text-center text-white focus:outline-none focus:border-orange-500"
                                            autoFocus
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30 font-bold uppercase">Batches</span>
                                    </div>

                                    <button
                                        onClick={() => setProductionQty(String(((Number(productionQty) / (selectedItem.yieldQuantity || 1)) + 1) * (selectedItem.yieldQuantity || 1)))}
                                        className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xl font-bold"
                                    >+</button>
                                </div>
                            </div>

                            {productionQty && selectedItem.yieldQuantity && (
                                <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20 text-center">
                                    <p className="text-xs text-orange-300 mb-1">Total Resultante:</p>
                                    <p className="text-2xl font-bold text-orange-400">
                                        {Number(productionQty)} <span className="text-sm font-normal text-white/60">{selectedItem.yieldUnit || selectedItem.defaultUnit}</span>
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setShowProductionModal(false)}
                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={executeProduction}
                                disabled={!productionQty || producing}
                                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl text-white font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {producing ? 'Procesando...' : (
                                    <>
                                        <Flame className="w-4 h-4" />
                                        Confirmar
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

