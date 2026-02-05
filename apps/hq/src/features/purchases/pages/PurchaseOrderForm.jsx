import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus, Trash, ArrowLeft, Save } from 'lucide-react';
import { api } from '@/lib/api';

export default function PurchaseOrderForm() {
    const navigate = useNavigate();
    const [suppliers, setSuppliers] = useState([]);
    const [items, setItems] = useState([]);

    // Form State
    const [supplierId, setSupplierId] = useState('');
    const [lines, setLines] = useState([]); // { itemId, quantity, unitCost }

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [s, i] = await Promise.all([
            api.get('/suppliers'),
            api.get('/supply-items')
        ]);
        setSuppliers(s.data.data || []);
        setItems(i.data.data || []);
    };

    const addLine = () => {
        setLines([...lines, { itemId: '', quantity: 1, unitCost: 0 }]);
    };

    const updateLine = (index, field, value) => {
        const newLines = [...lines];
        newLines[index][field] = value;
        setLines(newLines);
    };

    const removeLine = (index) => {
        setLines(lines.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!supplierId || lines.length === 0) return alert("Please select a supplier and add items.");

        try {
            // Prepare payload
            const payload = {
                supplierId,
                status: 'confirmed', // Immediate confirm for manual entry
                items: lines.map(l => ({
                    supplyItemId: l.itemId,
                    quantity: parseFloat(l.quantity),
                    unitCost: parseFloat(l.unitCost)
                }))
            };

            await api.post('/purchases', payload);
            alert("Purchase Recorded!");
            navigate('/purchases/suppliers');
        } catch (error) {
            console.error(error);
            alert("Failed to save purchase.");
        }
    };

    const total = lines.reduce((acc, l) => acc + (l.quantity * l.unitCost), 0);

    return (
        <div className="space-y-8 animate-fade-in p-6 max-w-4xl mx-auto">
            <button onClick={() => navigate(-1)} className="flex items-center text-gray-400 hover:text-white mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </button>

            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white">Record Purchase</h1>
                <div className="text-right">
                    <p className="text-sm text-gray-400">Total Amount</p>
                    <p className="text-3xl font-mono text-enigma-green font-bold">${total.toFixed(2)}</p>
                </div>
            </div>

            <div className="glass-panel p-6 rounded-3xl space-y-6">
                {/* Supplier Select */}
                <div>
                    <label className="block text-sm text-gray-400 mb-2">Supplier</label>
                    <select
                        value={supplierId}
                        onChange={(e) => setSupplierId(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-enigma-purple"
                    >
                        <option value="">Select Supplier...</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>

                {/* Items Table */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-medium text-white">Items</h3>
                        <button onClick={addLine} className="text-sm text-enigma-purple hover:text-white flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Add Line
                        </button>
                    </div>

                    {lines.map((line, idx) => (
                        <div key={idx} className="flex gap-4 items-end animate-fade-in">
                            <div className="flex-1">
                                <label className="text-xs text-gray-500 mb-1 block">Item</label>
                                <select
                                    value={line.itemId}
                                    onChange={(e) => updateLine(idx, 'itemId', e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                                >
                                    <option value="">Select Item...</option>
                                    {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                            </div>
                            <div className="w-24">
                                <label className="text-xs text-gray-500 mb-1 block">Qty</label>
                                <input
                                    type="number"
                                    value={line.quantity}
                                    onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm text-center"
                                />
                            </div>
                            <div className="w-32">
                                <label className="text-xs text-gray-500 mb-1 block">Unit Cost</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={line.unitCost}
                                    onChange={(e) => updateLine(idx, 'unitCost', e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm text-right"
                                />
                            </div>
                            <button onClick={() => removeLine(idx)} className="p-2 text-red-400 hover:bg-white/5 rounded-lg">
                                <Trash className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="pt-6 border-t border-white/5 flex justify-end">
                    <button
                        onClick={handleSubmit}
                        className="px-6 py-3 bg-enigma-green text-black font-bold rounded-xl hover:bg-emerald-400 transition-all flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" /> Save Purchase
                    </button>
                </div>
            </div>
        </div>
    );
}
