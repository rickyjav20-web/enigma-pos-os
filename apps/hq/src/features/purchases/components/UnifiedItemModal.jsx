
import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Search, Save, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * Unified Modal for creating/editing items across the 3 Zones.
 * @param {string} type - 'PRODUCT' | 'BATCH' | 'SUPPLY'
 * @param {object} initialData - If provided, we are in EDIT mode.
 */
export function UnifiedItemModal({ isOpen, onClose, type, initialData, onSuccess, allItems = [] }) {
    if (!isOpen) return null;

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        category: '',
        // Product Specific
        price: '',
        // Supply/Batch Specific
        currentCost: '',
        unitOfMeasure: 'und', // Default Unit
        // Batch Specific
        yieldQuantity: '',
        yieldUnit: 'und',
        // Smart Yield (Supply)
        yieldPercentage: 1.0,
        recipeUnit: '',
        stockCorrectionFactor: 1,
        // Common
        preferredSupplierId: null
    });

    const [recipe, setRecipe] = useState([]); // [{ id, name, cost, quantity, unit }]
    const [searchTerm, setSearchTerm] = useState('');

    // --- INIT ---
    useEffect(() => {
        if (initialData) {
            // Mapping initial data to form
            setFormData({
                name: initialData.name || '',
                sku: initialData.sku || '',
                category: initialData.category || '',
                price: initialData.price || '', // Product
                currentCost: initialData.currentCost || '', // Supply
                stockQuantity: initialData.stockQuantity !== undefined ? initialData.stockQuantity : '',
                unitOfMeasure: initialData.defaultUnit || 'und', // Supply
                yieldQuantity: initialData.yieldQuantity || '', // Batch
                yieldUnit: initialData.yieldUnit || 'und', // Batch
                // Smart Yield
                yieldPercentage: initialData.yieldPercentage || 1.0,
                recipeUnit: initialData.recipeUnit || '',
                stockCorrectionFactor: initialData.stockCorrectionFactor || 1,

                preferredSupplierId: initialData.preferredSupplierId || null
            });

            // Load Recipe if exists
            // Ideally initialData comes with 'ingredients' or 'recipes' populated
            // For now, we might need to fetch it if not full.
            // Assuming initialData *might* have it or we fetch.
            // Simplified: If editing, we assume Recipe is loaded or we fetch separately?
            // Let's assume passed strictly for now, or empty.
            // Load Recipe from Initial Data
            let loadedRecipe = [];
            if (initialData.recipes && initialData.recipes.length > 0) {
                // Product Recipe
                loadedRecipe = initialData.recipes.map(r => ({
                    id: r.supplyItemId,
                    name: r.supplyItem?.name || 'Unknown',
                    // Prefer averageCost (WAC) for accuracy, fallback to currentCost (last price)
                    cost: r.supplyItem?.averageCost || r.supplyItem?.currentCost || 0,
                    quantity: r.quantity,
                    unit: r.unit
                }));
            } else if (initialData.ingredients && initialData.ingredients.length > 0) {
                // Batch/Prep Recipe (uses nested 'component')
                loadedRecipe = initialData.ingredients.map(r => ({
                    id: r.supplyItemId,
                    name: r.component?.name || 'Unknown',
                    // Prefer averageCost (WAC) for accuracy, fallback to currentCost (last price)
                    cost: r.component?.averageCost || r.component?.currentCost || 0,
                    quantity: r.quantity,
                    unit: r.unit
                }));
            }
            setRecipe(loadedRecipe);
        } else {
            // Reset
            setFormData({
                name: '', sku: `SKU-${Date.now()}`, category: '',
                price: '', currentCost: '', unitOfMeasure: 'und', stockQuantity: '',
                yieldQuantity: '10', yieldUnit: 'kg', // Defaults for Batch
                preferredSupplierId: null
            });
            setRecipe([]);
        }
    }, [initialData, isOpen]);

    // --- LOGIC ---

    // Calculate Estimated Cost from Recipe
    const calculatedCost = useMemo(() => {
        return recipe.reduce((acc, item) => acc + (item.quantity * item.cost), 0);
    }, [recipe]);

    // Calculate Unit Cost (for Batches)
    const calculatedUnitCost = useMemo(() => {
        if (type !== 'BATCH') return 0;
        const yieldQty = parseFloat(formData.yieldQuantity) || 1;
        return calculatedCost / yieldQty;
    }, [calculatedCost, formData.yieldQuantity, type]);

    const handleAddIngredient = (item) => {
        // Prevent dupes? Or allow with warning?
        if (recipe.find(r => r.id === item.id)) return;

        setRecipe([...recipe, {
            id: item.id,
            name: item.name,
            cost: item.currentCost || 0,
            quantity: 1, // Default
            // UX Fix: If recipeUnit is 'und' or empty, use 'defaultUnit' (KG/LT) for coherence.
            unit: (item.recipeUnit && item.recipeUnit !== 'und') ? item.recipeUnit : (item.defaultUnit || 'und')
        }]);
        console.log(`[RecipeBuilder] Added ${item.name}. Unit Selection: Recipe(${item.recipeUnit}) vs Default(${item.defaultUnit}) -> Result: ${(item.recipeUnit && item.recipeUnit !== 'und') ? item.recipeUnit : (item.defaultUnit || 'und')}`);
        setSearchTerm(''); // Clear search
    };

    const handleRemoveIngredient = (id) => {
        setRecipe(recipe.filter(r => r.id !== id));
    };

    const handleUpdateIngredient = (id, field, value) => {
        setRecipe(recipe.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const payload = { ...formData };

            // Format numbers
            if (payload.price) payload.price = parseFloat(payload.price);
            if (payload.currentCost) payload.currentCost = parseFloat(payload.currentCost);
            if (payload.stockQuantity !== '') payload.stockQuantity = parseFloat(payload.stockQuantity);
            if (payload.yieldQuantity) payload.yieldQuantity = parseFloat(payload.yieldQuantity);

            // Mapping for Backend consistency
            // API PUT /supply-items expects 'defaultUnit'
            if (type !== 'PRODUCT') {
                payload.defaultUnit = formData.unitOfMeasure;
                // Smart Yield
                payload.yieldPercentage = parseFloat(formData.yieldPercentage) || 1.0;
                payload.recipeUnit = formData.recipeUnit;
                payload.stockCorrectionFactor = parseFloat(formData.stockCorrectionFactor) || 1;
            }

            // Attach Recipe
            // API expects: 'ingredients' (for Supply) or 'recipes' (for Product)
            // Format: { id, quantity, unit }
            const recipePayload = recipe.map(r => ({
                id: r.id,
                quantity: parseFloat(r.quantity),
                unit: r.unit
            }));

            if (type === 'PRODUCT') {
                payload.recipes = recipePayload;
                // Cost is auto-calculated by backend sync, but we can send current calc as cache
                // payload.cost = calculatedCost; 
            } else {
                payload.ingredients = recipePayload;
                // If Batch, we force isProduction=true
                if (type === 'BATCH') {
                    // payload.isProduction = true; // Handled by API logic presence of ingredients, or explicit?
                    // Let's rely on ingredients presence OR backend logic.
                }
            }

            // API Call
            let endpoint = type === 'PRODUCT' ? '/products' : '/supply-items';
            let method = initialData ? 'PUT' : 'POST';
            let url = initialData ? `${endpoint}/${initialData.id}` : endpoint;

            await api({
                method,
                url,
                data: payload
            });

            onSuccess();
            onClose();
        } catch (e) {
            console.error("Save failed", e);
            // Prioritize detailed message
            const errMsg = e.response?.data?.message || e.response?.data?.error || e.message;
            alert("Error saving item: " + errMsg);
        } finally {
            setLoading(false);
        }
    };

    // Filter Search
    const searchResults = useMemo(() => {
        if (!searchTerm) return [];
        return allItems.filter(i =>
            i.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            i.id !== initialData?.id // Don't add self
        ).slice(0, 5);
    }, [searchTerm, allItems, initialData]);

    // --- RENDER ---
    const getTitle = () => {
        if (initialData) return `Edit ${initialData.name}`;
        switch (type) {
            case 'PRODUCT': return "New Menu Product";
            case 'BATCH': return "New Kitchen Batch";
            case 'SUPPLY': return "New Pantry Item";
            default: return "New Item";
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

                {/* Header */}
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
                    <div>
                        <h2 className="text-xl font-bold text-white">{getTitle()}</h2>
                        <p className="text-xs text-zinc-400">
                            {type === 'PRODUCT' ? 'Create a sellable item linked to recipes.' :
                                type === 'BATCH' ? 'Create a preparation made from ingredients.' :
                                    'Register a raw purchase item.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400">
                        <X size={20} />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-medium text-zinc-400 mb-1">Name</label>
                            <input
                                className="w-full bg-zinc-800 border-zinc-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Tomato Sauce"
                            />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-medium text-zinc-400 mb-1">SKU</label>
                            <input
                                className={`w-full bg-zinc-800 border-zinc-700 rounded-lg p-2 text-zinc-300 focus:ring-2 focus:ring-emerald-500 outline-none ${initialData ? 'opacity-50 cursor-not-allowed' : ''}`}
                                value={formData.sku}
                                onChange={e => setFormData({ ...formData, sku: e.target.value })}
                                disabled={!!initialData}
                            />
                        </div>

                        {type === 'PRODUCT' && (
                            <div className="col-span-2 sm:col-span-1">
                                <label className="block text-xs font-medium text-zinc-400 mb-1">Sale Price ($)</label>
                                <input
                                    type="number"
                                    className="w-full bg-zinc-800 border-zinc-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={formData.price}
                                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                                />
                            </div>
                        )}

                        {type !== 'PRODUCT' && (
                            <div className="col-span-2 sm:col-span-1">
                                <label className="block text-xs font-medium text-zinc-400 mb-1">Default Unit</label>
                                <select
                                    className="w-full bg-zinc-800 border-zinc-700 rounded-lg p-2 text-white outline-none"
                                    value={formData.unitOfMeasure}
                                    onChange={e => {
                                        const newUnit = e.target.value;
                                        setFormData(prev => ({
                                            ...prev,
                                            unitOfMeasure: newUnit,
                                            // Auto-sync recipeUnit if it's not set or was same as old default
                                            recipeUnit: (!prev.recipeUnit || prev.recipeUnit === 'und' || prev.recipeUnit === prev.unitOfMeasure) ? newUnit : prev.recipeUnit
                                        }));
                                    }}
                                >
                                    <option value="und">Units (und)</option>
                                    <option value="kg">Kilograms (kg)</option>
                                    <option value="g">Grams (g)</option>
                                    <option value="lt">Liters (lt)</option>
                                    <option value="ml">Milliliters (ml)</option>
                                </select>
                            </div>
                        )}

                        {/* Batch Yield */}
                        {type === 'BATCH' && (
                            <>
                                <div className="col-span-2 sm:col-span-1 bg-indigo-900/20 p-2 rounded-lg border border-indigo-500/30">
                                    <label className="block text-xs font-medium text-indigo-300 mb-1">Batch Yield (Output)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            className="w-2/3 bg-zinc-800 border-zinc-700 rounded-lg p-2 text-white"
                                            value={formData.yieldQuantity}
                                            onChange={e => setFormData({ ...formData, yieldQuantity: e.target.value })}
                                            placeholder="Example: 5"
                                        />
                                        <input
                                            className="w-1/3 bg-zinc-800 border-zinc-700 rounded-lg p-2 text-zinc-400 text-center"
                                            value={formData.yieldUnit}
                                            onChange={e => setFormData({ ...formData, yieldUnit: e.target.value })}
                                            placeholder="lt"
                                        />
                                    </div>
                                    <p className="text-[10px] text-indigo-400 mt-1">
                                        Unit Cost: ${calculatedUnitCost.toFixed(2)} / {formData.yieldUnit}
                                    </p>
                                </div>
                            </>
                        )}

                        <>
                            <div className="col-span-2 sm:col-span-1">
                                <label className="block text-xs font-medium text-zinc-400 mb-1">Direct Cost ($)</label>
                                <input
                                    type="number"
                                    className="w-full bg-zinc-800 border-zinc-700 rounded-lg p-2 text-white outline-none"
                                    value={formData.currentCost}
                                    onChange={e => setFormData({ ...formData, currentCost: e.target.value })}
                                />
                            </div>
                            <div className="col-span-2 sm:col-span-1 bg-blue-900/10 p-2 rounded-lg border border-blue-500/20">
                                <label className="block text-xs font-medium text-blue-300 mb-1">Current Stock (Physical)</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        className="w-full bg-zinc-800 border-zinc-700 rounded-lg p-2 text-white outline-none"
                                        value={formData.stockQuantity}
                                        onChange={e => setFormData({ ...formData, stockQuantity: e.target.value })}
                                        placeholder="0.00"
                                    />
                                    <span className="text-xs text-zinc-500">{formData.unitOfMeasure}</span>
                                </div>
                            </div>

                            {/* PROTOCOLO SMART YIELD (Nuevo) - Exclusivo para Supply Items y Batches */}
                            {(type === 'SUPPLY' || type === 'BATCH') && (
                                <div className="col-span-2 bg-zinc-800/30 p-3 rounded-lg border border-zinc-700/50 space-y-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                        <h4 className="text-xs font-bold text-zinc-300 uppercase">Protocolo Smart Yield</h4>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        {/* 1. Yield % */}
                                        <div className="col-span-1">
                                            <label className="block text-[10px] font-medium text-zinc-400 mb-1">Rendimiento (%)</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    step="1"
                                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-white outline-none focus:border-amber-500"
                                                    value={Math.round((parseFloat(formData.yieldPercentage) || 0) * 100)}
                                                    onChange={e => {
                                                        const val = parseFloat(e.target.value);
                                                        setFormData({ ...formData, yieldPercentage: isNaN(val) ? 0 : val / 100 });
                                                    }}
                                                    placeholder="100"
                                                />
                                                <span className="absolute right-2 top-2 text-xs text-zinc-500">%</span>
                                            </div>
                                        </div>

                                        {/* 2. Recipe Unit */}
                                        <div className="col-span-1">
                                            <label className="block text-[10px] font-medium text-zinc-400 mb-1">Unidad Receta</label>
                                            <select
                                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-white outline-none"
                                                value={formData.recipeUnit || ''}
                                                onChange={e => {
                                                    const unit = e.target.value;
                                                    // Auto-set factor for known conversions
                                                    let newFactor = formData.stockCorrectionFactor;
                                                    if (formData.unitOfMeasure === 'kg' && unit === 'g') newFactor = 1000;
                                                    if (formData.unitOfMeasure === 'lt' && unit === 'ml') newFactor = 1000;
                                                    setFormData({ ...formData, recipeUnit: unit, stockCorrectionFactor: newFactor });
                                                }}
                                            >
                                                <option value="">Select Unit</option>
                                                <option value="g">Grams (g)</option>
                                                <option value="ml">Milliliters (ml)</option>
                                                <option value="oz">Ounces (oz)</option>
                                                <option value="und">Units (und)</option>
                                            </select>
                                        </div>

                                        {/* 3. Factor */}
                                        <div className="col-span-1">
                                            <div className="flex items-center gap-1 mb-1">
                                                <label className="block text-[10px] font-medium text-zinc-400">Factor</label>
                                                <div className="group relative">
                                                    <AlertCircle size={10} className="text-zinc-500 cursor-help" />
                                                    <div className="absolute bottom-full right-0 mb-1 w-48 bg-black border border-zinc-700 p-2 rounded text-[10px] text-zinc-300 hidden group-hover:block z-50">
                                                        ¿Cuántos {formData.recipeUnit || 'items'} caben en 1 {formData.unitOfMeasure}?
                                                        <br />Ej: 1 Kg = 1000 g → Factor 1000
                                                    </div>
                                                </div>
                                            </div>
                                            <input
                                                type="number"
                                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-white outline-none"
                                                value={formData.stockCorrectionFactor}
                                                onChange={e => setFormData({ ...formData, stockCorrectionFactor: e.target.value })}
                                                placeholder="1000"
                                            />
                                        </div>
                                    </div>

                                    {/* Preview Calculation */}
                                    <div className="text-[10px] text-zinc-500 bg-zinc-900/50 p-2 rounded border border-zinc-800">
                                        <p>
                                            Costo Real: <span className="text-amber-400 font-mono">
                                                ${(
                                                    (parseFloat(formData.currentCost) || 0) /
                                                    (parseFloat(formData.stockCorrectionFactor) || 1) /
                                                    (parseFloat(formData.yieldPercentage) || 1)
                                                ).toFixed(4)}
                                            </span> / {formData.recipeUnit || formData.unitOfMeasure}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>

                    </div>

                    {/* RECIPE BUILDER (Product or Batch) */}
                    {(type === 'PRODUCT' || type === 'BATCH') && (
                        <div className="border-t border-zinc-800 pt-6">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="text-sm font-semibold text-white">Recipe / Composition</h3>
                                    <p className="text-xs text-zinc-500">What is this item made of?</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-zinc-400">Total Recipe Cost</p>
                                    <p className="text-lg font-bold text-emerald-400">${calculatedCost.toFixed(2)}</p>
                                </div>
                            </div>

                            {/* Search */}
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-2.5 text-zinc-500" size={16} />
                                <input
                                    className="w-full bg-zinc-800 border-zinc-700 rounded-lg pl-9 p-2 text-sm text-white placeholder-zinc-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                                    placeholder="Search ingredient to add..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                                {searchResults.length > 0 && (
                                    <div className="absolute top-10 left-0 right-0 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-10 max-h-40 overflow-y-auto">
                                        {searchResults.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => handleAddIngredient(item)}
                                                className="w-full text-left px-4 py-2 hover:bg-zinc-700 text-sm text-white flex justify-between"
                                            >
                                                <span>{item.name}</span>
                                                <span className="text-zinc-500 text-xs">${item.currentCost?.toFixed(2) || '0.00'}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* List */}
                            <div className="space-y-2">
                                {recipe.length === 0 && (
                                    <div className="text-center py-6 border border-dashed border-zinc-800 rounded-lg">
                                        <p className="text-zinc-500 text-sm">No ingredients added yet.</p>
                                        <p className="text-zinc-600 text-xs mt-1">Search above to add components.</p>
                                    </div>
                                )}
                                {recipe.map(r => (
                                    <div key={r.id} className="flex items-center gap-3 bg-zinc-800/50 p-2 rounded-lg border border-zinc-700/50">
                                        <div className="flex-1">
                                            <p className="text-sm text-white">{r.name}</p>
                                            <p className="text-[10px] text-zinc-500">${r.cost.toFixed(2)} per unit</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-white text-right outline-none focus:border-emerald-500"
                                                value={r.quantity}
                                                onChange={e => handleUpdateIngredient(r.id, 'quantity', e.target.value)}
                                            />
                                            <input
                                                className="w-14 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-400 text-center outline-none"
                                                value={r.unit}
                                                onChange={e => handleUpdateIngredient(r.id, 'unit', e.target.value)}
                                            />
                                            <button
                                                onClick={() => handleRemoveIngredient(r.id)}
                                                className="p-1 hover:text-red-400 text-zinc-500"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-zinc-400 hover:text-white text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        {loading ? 'Saving...' : <><Save size={16} /> Save Item</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
