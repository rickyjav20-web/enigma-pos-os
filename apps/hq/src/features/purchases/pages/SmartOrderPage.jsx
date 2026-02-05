import React, { useEffect, useState } from 'react';
import { ShoppingCart, Check, Sparkles, ArrowRight, DollarSign, Store, BarChart3, History } from 'lucide-react';
import { api } from '@/lib/api';

export default function SmartOrderPage() {
    const [activeTab, setActiveTab] = useState('optimizer'); // 'optimizer' | 'suppliers'

    return (
        <div className="space-y-6 animate-fade-in p-6 h-[calc(100vh-20px)] flex flex-col">
            {/* Header with Tabs */}
            <div className="flex justify-between items-end flex-shrink-0 mb-2">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-white mb-2 flex items-center gap-3">
                        <Sparkles className="text-enigma-purple" />
                        Smart Order
                    </h1>
                    <p className="text-enigma-text-secondary">Intelligent purchasing and supplier management.</p>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                    <button
                        onClick={() => setActiveTab('optimizer')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'optimizer' ? 'bg-enigma-purple text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Smart Optimizer
                    </button>
                    <button
                        onClick={() => setActiveTab('suppliers')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'suppliers' ? 'bg-enigma-purple text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Store className="w-4 h-4" /> Supplier Intelligence
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0 relative">
                {activeTab === 'optimizer' && <OptimizerView />}
                {activeTab === 'suppliers' && <SupplierIntelligenceView />}
            </div>
        </div>
    );
}

// --- SUB-COMPONENTS ---

function SupplierIntelligenceView() {
    const [suppliers, setSuppliers] = useState([]);
    const [selectedSupplier, setSelectedSupplier] = useState(null);

    useEffect(() => {
        api.get('/suppliers').then(res => setSuppliers(res.data));
    }, []);

    return (
        <div className="grid grid-cols-12 gap-6 h-full">
            {/* Supplier List */}
            <div className="col-span-4 glass-panel rounded-3xl overflow-hidden flex flex-col">
                <div className="p-4 border-b border-white/5 bg-white/5">
                    <h3 className="font-bold text-white">Your Network</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {suppliers.map(s => (
                        <div
                            key={s.id}
                            onClick={() => setSelectedSupplier(s)}
                            className={`p-4 rounded-xl cursor-pointer border transition-all ${selectedSupplier?.id === s.id ? 'bg-white/10 border-enigma-purple' : 'hover:bg-white/5 border-transparent'}`}
                        >
                            <h4 className="text-white font-medium">{s.name}</h4>
                            <p className="text-xs text-gray-500">Last order: 2 days ago</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Analytics Panel */}
            <div className="col-span-8 glass-panel rounded-3xl p-8 flex flex-col">
                {selectedSupplier ? (
                    <div className="space-y-8">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-3xl font-bold text-white mb-1">{selectedSupplier.name}</h2>
                                <div className="flex gap-2">
                                    <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-xs border border-green-500/30">Active</span>
                                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs border border-blue-500/30">Preferred</span>
                                </div>
                            </div>
                            <button className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors text-sm">
                                Edit Details
                            </button>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                <div className="flex items-center gap-2 text-gray-400 mb-2">
                                    <DollarSign className="w-4 h-4" /> Total Spend (YTD)
                                </div>
                                <p className="text-2xl font-mono text-white">$12,450.00</p>
                            </div>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                <div className="flex items-center gap-2 text-gray-400 mb-2">
                                    <History className="w-4 h-4" /> Last Order
                                </div>
                                <p className="text-2xl font-mono text-white">Jan 28</p>
                            </div>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                <div className="flex items-center gap-2 text-gray-400 mb-2">
                                    <BarChart3 className="w-4 h-4" /> Frequency
                                </div>
                                <p className="text-2xl font-mono text-white">Weekly</p>
                            </div>
                        </div>

                        {/* Templates / History */}
                        <div className="grid grid-cols-2 gap-6">
                            {/* Templates */}
                            <div>
                                <h3 className="text-lg font-bold text-white mb-4">Order Templates</h3>
                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-enigma-purple transition-colors cursor-pointer group">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-bold text-white">Standard Weekly Restock</h4>
                                            <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                                        </div>
                                        <p className="text-xs text-gray-400">Milk, Coffee Beans, Sugar (12 items)</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-enigma-purple transition-colors cursor-pointer group">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-bold text-white">Emergency Restock</h4>
                                            <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                                        </div>
                                        <p className="text-xs text-gray-400">Cups, Lids, Napkins (5 items)</p>
                                    </div>
                                </div>
                            </div>

                            {/* Item History (New Section) */}
                            <div>
                                <h3 className="text-lg font-bold text-white mb-4">Frequently Purchased Items</h3>
                                <div className="space-y-2">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                            <div>
                                                <p className="text-sm font-medium text-white">Item Name {i}</p>
                                                <p className="text-xs text-gray-500">Last: $10.50 / kg</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-enigma-green">Low Cost</p>
                                                <p className="text-xs text-gray-400">Vol: High</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <Store className="w-16 h-16 mb-4 opacity-50" />
                        <p>Select a supplier to view intelligence</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function OptimizerView() {
    // State
    const [items, setItems] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadInventory();
    }, []);

    const loadInventory = async () => {
        const res = await api.get('/supply-items');
        // Handle both Array directly (legacy) or { data: [] } (new standard)
        const itemsData = Array.isArray(res.data) ? res.data : (res.data.data || []);
        setItems(itemsData);
    };

    const toggleItem = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const generatePlan = async () => {
        if (selectedIds.size === 0) return;
        setLoading(true);
        try {
            const res = await api.post('/optimizer/analyze', {
                itemIds: Array.from(selectedIds)
            });
            setPlan(res.data);
        } catch (error) {
            console.error("Optimization failed:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-12 gap-8 h-full">

            {/* LEFT: Item Selector */}
            <div className="col-span-12 lg:col-span-5 flex flex-col min-h-0 h-full">
                <div className="glass-panel flex-1 rounded-3xl p-1 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-white/5 bg-white/5 backdrop-blur-md flex justify-between items-center">
                        <div>
                            <h3 className="font-medium text-white">Inventory Source</h3>
                            <p className="text-xs text-gray-500">{items.length} items available</p>
                        </div>
                        {plan && (
                            <button
                                onClick={() => { setPlan(null); setSelectedIds(new Set()); }}
                                className="text-xs text-red-400 hover:text-red-300 transition-colors"
                            >
                                Reset
                            </button>
                        )}
                    </div>

                    <div className="overflow-y-auto flex-1 p-2 space-y-1 custom-scrollbar">
                        {items.map(item => {
                            const isSelected = selectedIds.has(item.id);
                            return (
                                <div
                                    key={item.id}
                                    onClick={() => toggleItem(item.id)}
                                    className={`
                                        p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all border
                                        ${isSelected
                                            ? 'bg-enigma-purple/20 border-enigma-purple/50'
                                            : 'hover:bg-white/5 border-transparent'}
                                    `}
                                >
                                    <div>
                                        <p className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                            {item.name}
                                        </p>
                                        <p className="text-xs text-gray-500 font-mono">{item.sku}</p>
                                    </div>
                                    {isSelected && <Check className="w-4 h-4 text-enigma-purple" />}
                                </div>
                            );
                        })}
                    </div>

                    {/* Action Bar */}
                    <div className="p-4 border-t border-white/5 bg-black/20">
                        <button
                            onClick={generatePlan}
                            disabled={selectedIds.size === 0 || loading}
                            className={`
                                w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all
                                ${selectedIds.size > 0
                                    ? 'bg-gradient-to-r from-enigma-purple to-indigo-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:scale-[1.02]'
                                    : 'bg-white/10 text-gray-500 cursor-not-allowed'}
                            `}
                        >
                            {loading ? (
                                <span className="animate-pulse">Analyzing Prices...</span>
                            ) : (
                                <>
                                    Optimize Selection <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* RIGHT: The Plan */}
            <div className="col-span-12 lg:col-span-7 flex flex-col min-h-0 h-full">
                {!plan ? (
                    <div className="flex-1 glass-panel rounded-3xl flex flex-col items-center justify-center text-center p-12 border-dashed border-white/10">
                        <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                            <ShoppingCart className="w-10 h-10 text-gray-600" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Ready to Optimize</h3>
                        <p className="text-gray-400 max-w-sm">
                            Select items from the list on the left and click "Optimize".
                            The AI will check historical prices and split your order by supplier to save costs.
                        </p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                        {/* Summary */}
                        <div className="glass-card p-6 rounded-2xl bg-gradient-to-br from-green-500/10 to-transparent border-enigma-green/20">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">Optimization Complete</h2>
                                    <p className="text-enigma-green">You should split this order across {plan.length} suppliers.</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-400">Total Estimate</p>
                                    <p className="text-3xl font-mono text-white font-bold">
                                        ${plan.reduce((acc, p) => acc + p.totalEst, 0).toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Lists */}
                        {plan.map((group, idx) => (
                            <div key={idx} className="glass-panel p-6 rounded-2xl animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
                                <div className="flex justify-between items-start mb-6 pb-4 border-b border-white/5">
                                    <div>
                                        <h3 className="text-xl font-bold text-white">{group.supplierName}</h3>
                                        <p className="text-sm text-gray-400">Order {group.items.length} items from here</p>
                                    </div>
                                    <div className="bg-white/5 px-4 py-2 rounded-lg border border-white/5">
                                        <p className="text-sm text-gray-400">Subtotal</p>
                                        <p className="text-lg font-mono text-white">${group.totalEst.toFixed(2)}</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {group.items.map((item, i) => (
                                        <div key={i} className="flex justify-between items-center py-2 px-3 hover:bg-white/5 rounded-lg transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-xs text-gray-400">
                                                    {i + 1}
                                                </div>
                                                <span className="text-gray-200">{item.name}</span>
                                            </div>
                                            <span className="font-mono text-enigma-green text-sm">
                                                ${item.estCost.toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-6 flex justify-end">
                                    <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-all flex items-center gap-2">
                                        Create Purchase Order <ArrowRight className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
