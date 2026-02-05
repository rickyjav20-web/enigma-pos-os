import React, { useState, useEffect } from 'react';
import { api, CURRENT_TENANT_ID } from '@/lib/api';

export default function RecipeEditor({ product, onUpdate }) {
    const [recipes, setRecipes] = useState([]);
    const [supplyItems, setSupplyItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState('');
    const [quantity, setQuantity] = useState('');
    const [unit, setUnit] = useState('und');

    useEffect(() => {
        if (product?.id) {
            fetchRecipe();
            fetchSupplyItems();
        }
    }, [product]);

    const fetchRecipe = async () => {
        try {
            // Fetch product to get latest recipes
            const res = await api.get(`/products/${product.id}`);
            setRecipes(res.data.recipes || []);
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch recipes", error);
        }
    };

    const fetchSupplyItems = async () => {
        try {
            const res = await api.get(`/supply-items?limit=100&tenant_id=${CURRENT_TENANT_ID}`);
            setSupplyItems(res.data.data || []);
        } catch (error) {
            console.error("Failed to fetch supply items", error);
        }
    };

    const handleAddIngredient = async () => {
        if (!selectedItem || !quantity) return;

        try {
            // Objective Proof Log (Console)
            console.log(`[UI_ACTION] Adding Ingredient: Prod=${product.id}, Item=${selectedItem}, Qty=${quantity}`);

            await api.post(`/products/${product.id}/recipes`, {
                supplyItemId: selectedItem,
                quantity: parseFloat(quantity),
                unit: unit
            });

            fetchRecipe(); // Refresh
            setSelectedItem('');
            setQuantity('');
            if (onUpdate) onUpdate(); // Trigger parent refresh (Cost)
        } catch (error) {
            console.error(error);
            alert("Error adding ingredient: " + (error.response?.data?.error || error.message));
        }
    };

    const handleRemove = async (recipeId) => {
        if (!confirm("Remove ingredient?")) return;
        try {
            await api.delete(`/products/${product.id}/recipes/${recipeId}`);
            fetchRecipe();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error(error);
        }
    };

    // Calculate Total Recipe Cost directly here for verification
    const totalRecipeCost = recipes.reduce((acc, r) => {
        return acc + ((r.supplyItem?.currentCost || 0) * r.quantity);
    }, 0);

    return (
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
            <h3 className="text-xl font-bold mb-4 text-emerald-400">🍳 Recipe / Composition</h3>

            {/* COST VERIFICATION CARD */}
            <div className="bg-black/50 p-4 rounded-lg mb-6 flex justify-between items-center border border-gray-700">
                <div>
                    <span className="text-gray-400 text-sm block">Values from DB (Live)</span>
                    <span className="text-white font-mono text-sm">Product Cost Field: </span>
                    <span className="text-yellow-400 font-bold ml-2">${product.cost?.toFixed(2)}</span>
                </div>
                <div>
                    <span className="text-white font-mono text-sm">Recipe Sum: </span>
                    <span className="text-emerald-400 font-bold ml-2">${totalRecipeCost.toFixed(2)}</span>
                </div>
            </div>

            {/* LIST */}
            <div className="space-y-2 mb-6">
                {recipes.map(r => (
                    <div key={r.id} className="flex justify-between items-center bg-gray-800 p-3 rounded border border-gray-700">
                        <div>
                            <div className="text-white font-medium">{r.supplyItem?.name}</div>
                            <div className="text-gray-500 text-xs">
                                {r.quantity} {r.unit} x ${r.supplyItem?.currentCost?.toFixed(2)}
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-gray-300 font-mono">
                                ${((r.supplyItem?.currentCost || 0) * r.quantity).toFixed(2)}
                            </span>
                            <button
                                onClick={() => handleRemove(r.id)}
                                className="text-red-500 hover:text-red-400 text-sm"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* ADD FORM */}
            <div className="grid grid-cols-12 gap-2 bg-gray-800/50 p-4 rounded-lg">
                <div className="col-span-6">
                    <label className="text-xs text-gray-500 block mb-1">Ingredient</label>
                    <select
                        value={selectedItem}
                        onChange={e => setSelectedItem(e.target.value)}
                        className="w-full bg-black border border-gray-700 text-white rounded p-2 text-sm"
                    >
                        <option value="">Select Ingredient...</option>
                        {supplyItems.map(item => (
                            <option key={item.id} value={item.id}>
                                {item.name} (${item.currentCost})
                            </option>
                        ))}
                    </select>
                </div>
                <div className="col-span-3">
                    <label className="text-xs text-gray-500 block mb-1">Qty</label>
                    <input
                        type="number"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        className="w-full bg-black border border-gray-700 text-white rounded p-2 text-sm"
                        placeholder="0.00"
                    />
                </div>
                <div className="col-span-3 flex items-end">
                    <button
                        onClick={handleAddIngredient}
                        disabled={!selectedItem || !quantity}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded text-sm font-bold disabled:opacity-50"
                    >
                        + Add Check
                    </button>
                </div>
            </div>
        </div>
    );
}
