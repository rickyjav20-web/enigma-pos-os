import React, { useEffect, useState } from 'react';
import { api, CURRENT_TENANT_ID } from '@/lib/api';

const getOperationalUnit = (item) => item?.operationalUnit || item?.yieldUnit || item?.defaultUnit || 'und';
const getPreferredRecipeUnit = (item) => item?.preferredRecipeUnit || item?.recipeUnit || getOperationalUnit(item);
const getEffectiveRecipeCost = (item) => {
    if (!item) return 0;
    const rawCost = item.averageCost || item.currentCost || 0;
    const factor = item.stockCorrectionFactor || 1;
    const yieldPct = item.yieldPercentage || 1;
    return rawCost / (factor * yieldPct);
};

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
            const res = await api.get(`/products/${product.id}`);
            setRecipes(res.data.recipes || []);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch recipes', error);
        }
    };

    const fetchSupplyItems = async () => {
        try {
            const res = await api.get(`/supply-items?limit=100&tenant_id=${CURRENT_TENANT_ID}`);
            setSupplyItems(res.data.data || []);
        } catch (error) {
            console.error('Failed to fetch supply items', error);
        }
    };

    const handleAddIngredient = async () => {
        if (!selectedItem || !quantity) return;

        try {
            await api.post(`/products/${product.id}/recipes`, {
                supplyItemId: selectedItem,
                quantity: parseFloat(quantity),
                unit,
            });

            fetchRecipe();
            setSelectedItem('');
            setQuantity('');
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error(error);
            alert('Error adding ingredient: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleRemove = async (recipeId) => {
        if (!confirm('Remove ingredient?')) return;
        try {
            await api.delete(`/products/${product.id}/recipes/${recipeId}`);
            fetchRecipe();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error(error);
        }
    };

    const totalRecipeCost = recipes.reduce((acc, recipe) => {
        return acc + getEffectiveRecipeCost(recipe.supplyItem) * recipe.quantity;
    }, 0);

    return (
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
            <h3 className="text-xl font-bold mb-4 text-emerald-400">Recipe / Composition</h3>

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

            <div className="space-y-2 mb-6">
                {recipes.map((recipe) => {
                    const recipeUnitCost = getEffectiveRecipeCost(recipe.supplyItem);
                    return (
                        <div key={recipe.id} className="flex justify-between items-center bg-gray-800 p-3 rounded border border-gray-700">
                            <div>
                                <div className="text-white font-medium">{recipe.supplyItem?.name}</div>
                                <div className="text-gray-500 text-xs">
                                    {recipe.quantity} {recipe.unit} x ${recipeUnitCost.toFixed(4)} / {getPreferredRecipeUnit(recipe.supplyItem)}
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-gray-300 font-mono">
                                    ${(recipeUnitCost * recipe.quantity).toFixed(2)}
                                </span>
                                <button
                                    onClick={() => handleRemove(recipe.id)}
                                    className="text-red-500 hover:text-red-400 text-sm"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-12 gap-2 bg-gray-800/50 p-4 rounded-lg">
                <div className="col-span-5">
                    <label className="text-xs text-gray-500 block mb-1">Ingredient</label>
                    <select
                        value={selectedItem}
                        onChange={(event) => {
                            setSelectedItem(event.target.value);
                            const item = supplyItems.find((candidate) => candidate.id === event.target.value);
                            if (item) setUnit(getPreferredRecipeUnit(item));
                        }}
                        className="w-full bg-black border border-gray-700 text-white rounded p-2 text-sm"
                    >
                        <option value="">Select Ingredient...</option>
                        {supplyItems.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name} (${getEffectiveRecipeCost(item).toFixed(4)} / {getPreferredRecipeUnit(item)})
                            </option>
                        ))}
                    </select>
                </div>
                <div className="col-span-3">
                    <label className="text-xs text-gray-500 block mb-1">Qty</label>
                    <input
                        type="number"
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                        className="w-full bg-black border border-gray-700 text-white rounded p-2 text-sm"
                        placeholder="0.00"
                    />
                </div>
                <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Unit</label>
                    <div className="p-2 text-sm text-gray-400 bg-gray-900 border border-gray-700 rounded select-none">
                        {unit}
                    </div>
                </div>
                <div className="col-span-2 flex items-end">
                    <button
                        onClick={handleAddIngredient}
                        disabled={!selectedItem || !quantity}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded text-sm font-bold disabled:opacity-50"
                    >
                        + Add
                    </button>
                </div>
            </div>
        </div>
    );
}
