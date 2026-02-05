import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Package, Building2, ShoppingCart, Check, Search, Zap } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
const TENANT_HEADER = { 'x-tenant-id': 'enigma_hq', 'Content-Type': 'application/json' };

interface SupplyItem {
    id: string;
    name: string;
    sku: string;
    currentCost: number;
    defaultUnit: string;
}

interface OptimizedPlan {
    supplierId: string;
    supplierName: string;
    supplierPhone?: string;
    supplierAddress?: string;
    supplierEmail?: string;
    items: {
        itemId: string;
        name: string;
        estCost: number;
        sku: string;
        lastDate?: string;
        averageCost?: number;
    }[];
    totalEst: number;
}

export default function SmartShopperPage() {
    const navigate = useNavigate();
    const [allItems, setAllItems] = useState<SupplyItem[]>([]);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [optimizedPlan, setOptimizedPlan] = useState<OptimizedPlan[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'select' | 'result'>('select');

    useEffect(() => {
        loadItems();
    }, []);

    const loadItems = async () => {
        try {
            const res = await fetch(`${API_URL}/supply-items?limit=200`, {
                headers: TENANT_HEADER
            });
            const data = await res.json();
            setAllItems(data?.data || []);
        } catch (e) {
            console.error(e);
        }
    };

    const toggleItem = (id: string) => {
        setSelectedItems(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const analyzeShoppingList = async () => {
        if (selectedItems.length === 0) return;

        setLoading(true);
        try {
            console.log('[SmartShopper] Analyzing items:', selectedItems);

            const res = await fetch(`${API_URL}/optimizer/analyze`, {
                method: 'POST',
                headers: TENANT_HEADER,
                body: JSON.stringify({ itemIds: selectedItems })
            });

            console.log('[SmartShopper] Response status:', res.status);

            if (res.ok) {
                const plan = await res.json();
                console.log('[SmartShopper] Plan received:', plan);

                // If no purchase history exists, create a fallback plan using current costs
                if (!plan || plan.length === 0) {
                    console.log('[SmartShopper] No plan returned, creating fallback');
                    // Create fallback plan with all items under "Market/Unknown"
                    const selectedItemsList = allItems.filter(i => selectedItems.includes(i.id));
                    const fallbackPlan: OptimizedPlan[] = [{
                        supplierId: 'unknown',
                        supplierName: 'Mercado General (Sin historial)',
                        items: selectedItemsList.map(item => ({
                            itemId: item.id,
                            name: item.name,
                            estCost: item.currentCost,
                            sku: item.sku
                        })),
                        totalEst: selectedItemsList.reduce((acc, item) => acc + item.currentCost, 0)
                    }];
                    setOptimizedPlan(fallbackPlan);
                } else {
                    setOptimizedPlan(plan);
                }
                setStep('result');
            } else {
                const err = await res.text();
                console.error('[SmartShopper] API Error:', err);
                alert('Error al analizar: ' + err);
            }
        } catch (e) {
            console.error('[SmartShopper] Fetch error:', e);
            alert('Error de conexión con el servidor');
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = searchQuery.length >= 1
        ? allItems.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : allItems;

    const totalEstimated = optimizedPlan?.reduce((acc, p) => acc + p.totalEst, 0) || 0;

    return (
        <div className="min-h-screen bg-enigma-black text-white">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-enigma-black/95 backdrop-blur-xl border-b border-white/5 p-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => step === 'result' ? setStep('select') : navigate('/')}
                        className="p-2 -ml-2 rounded-xl hover:bg-white/5"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-amber-400" />
                            Smart Shopper
                        </h1>
                        <p className="text-sm text-white/40">
                            {step === 'select' ? 'Selecciona qué necesitas comprar' : 'Plan de compras optimizado'}
                        </p>
                    </div>
                </div>
            </header>

            <main className="p-4 pb-32">
                {/* Step 1: Select Items */}
                {step === 'select' && (
                    <div className="space-y-4 animate-fade-in">
                        {/* Info Card */}
                        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                            <div className="flex items-start gap-3">
                                <Zap className="w-6 h-6 text-amber-400 flex-shrink-0" />
                                <div>
                                    <p className="font-medium text-amber-400">Optimización Inteligente</p>
                                    <p className="text-sm text-white/60 mt-1">
                                        Selecciona los items que necesitas comprar. El sistema analizará
                                        el historial de compras y te sugerirá los mejores proveedores por precio.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-4 top-3.5 w-5 h-5 text-white/30" />
                            <input
                                type="text"
                                placeholder="Buscar ingrediente..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full p-3 pl-12 rounded-2xl bg-enigma-gray border border-white/10 text-white 
                                    placeholder:text-white/30 focus:outline-none focus:border-enigma-purple"
                            />
                        </div>

                        {/* Selected Counter */}
                        {selectedItems.length > 0 && (
                            <div className="flex items-center justify-between p-3 bg-enigma-purple/10 rounded-xl border border-enigma-purple/30">
                                <span className="text-sm text-enigma-purple">
                                    {selectedItems.length} item(s) seleccionados
                                </span>
                                <button
                                    onClick={() => setSelectedItems([])}
                                    className="text-xs text-white/50 hover:text-white"
                                >
                                    Limpiar
                                </button>
                            </div>
                        )}

                        {/* Items List */}
                        <div className="space-y-2">
                            {filteredItems.map(item => {
                                const isSelected = selectedItems.includes(item.id);
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => toggleItem(item.id)}
                                        className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4
                                            ${isSelected
                                                ? 'bg-enigma-purple/20 border-enigma-purple/50'
                                                : 'bg-enigma-gray/30 border-white/5 hover:border-white/20'
                                            }`}
                                    >
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center
                                            ${isSelected ? 'bg-enigma-purple' : 'bg-white/10'}`}>
                                            {isSelected && <Check className="w-4 h-4" />}
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="font-medium">{item.name}</p>
                                            <p className="text-xs text-white/40">{item.defaultUnit}</p>
                                        </div>
                                        <p className="font-mono text-enigma-green">${item.currentCost.toFixed(2)}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Step 2: Optimized Results */}
                {step === 'result' && optimizedPlan && (
                    <div className="space-y-4 animate-fade-in">
                        {/* Summary Card */}
                        <div className="p-4 rounded-2xl bg-gradient-to-r from-enigma-green/10 to-emerald-500/10 border border-enigma-green/30">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-white/50">Total Estimado</p>
                                    <p className="text-3xl font-bold font-mono text-enigma-green">
                                        ${totalEstimated.toFixed(2)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-white/50">Distribuido en</p>
                                    <p className="text-xl font-bold text-white">
                                        {optimizedPlan.length} proveedor(es)
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Plan by Supplier */}
                        {optimizedPlan.map((supplier, idx) => (
                            <div key={idx} className="rounded-2xl bg-enigma-gray border border-white/5 overflow-hidden">
                                {/* Supplier Header */}
                                <div className="p-4 border-b border-white/5 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-enigma-green/10 flex items-center justify-center flex-shrink-0">
                                        <Building2 className="w-5 h-5 text-enigma-green" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-white">{supplier.supplierName}</p>
                                            {supplier.supplierId && supplier.supplierId !== 'unknown' && (
                                                <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1 rounded font-mono" title="Supplier ID used for this price">
                                                    ID: {supplier.supplierId.substring(0, 6)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-0.5">
                                            {supplier.supplierPhone ? (
                                                <p className="text-xs text-zinc-400 flex items-center gap-1">
                                                    📞 {supplier.supplierPhone}
                                                </p>
                                            ) : (
                                                <span className="text-[10px] text-zinc-600 italic">Sin teléfono</span>
                                            )}

                                            {supplier.supplierAddress ? (
                                                <p className="text-xs text-zinc-400 flex items-center gap-1">
                                                    📍 {supplier.supplierAddress}
                                                </p>
                                            ) : (
                                                <span className="text-[10px] text-zinc-600 italic">Sin dirección</span>
                                            )}
                                        </div>
                                    </div>
                                    <p className="font-mono text-enigma-green font-bold text-lg">
                                        ${supplier.totalEst.toFixed(2)}
                                    </p>
                                </div>

                                {/* Items */}
                                <div className="divide-y divide-white/5">
                                    {supplier.items.map(item => {
                                        const isStale = item.lastDate && (new Date().getTime() - new Date(item.lastDate).getTime() > 30 * 24 * 60 * 60 * 1000); // 30 days
                                        const dateStr = item.lastDate ? new Date(item.lastDate).toLocaleDateString() : 'N/A';

                                        const avgCost = item.averageCost || 0;
                                        const saving = avgCost > item.estCost ? ((avgCost - item.estCost) / avgCost * 100).toFixed(0) : 0;

                                        return (
                                            <div key={item.itemId} className="p-4 flex items-center gap-3 hover:bg-white/5 transition-colors">
                                                <div className="p-2 bg-white/5 rounded-lg">
                                                    <Package className="w-5 h-5 text-white/50" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-white">{item.name}</span>
                                                        {Number(saving) > 0 && (
                                                            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                                                                -{saving}% vs Avg
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                                                        <span title="Average Market Cost">Avg: ${avgCost.toFixed(2)}</span>
                                                        <span>•</span>
                                                        <span className={isStale ? "text-amber-500 flex items-center gap-1" : ""}>
                                                            {isStale && <Zap size={10} />} Last bought: {dateStr}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-mono font-bold text-enigma-green text-lg">${item.estCost.toFixed(2)}</span>
                                                    <p className="text-[10px] text-zinc-500">Unit Cost</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {/* Action: Convert to Orders */}
                        <div className="pt-4">
                            <button
                                onClick={() => navigate('/purchases')}
                                className="w-full py-4 rounded-2xl bg-enigma-purple font-bold text-lg
                                    flex items-center justify-center gap-2 hover:bg-enigma-purple/80 transition-all"
                            >
                                <ShoppingCart className="w-5 h-5" />
                                Iniciar Compras
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* Bottom Action Bar */}
            {step === 'select' && selectedItems.length > 0 && (
                <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-enigma-black via-enigma-black to-transparent">
                    <button
                        onClick={analyzeShoppingList}
                        disabled={loading}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 font-bold text-lg
                            flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
                    >
                        {loading ? 'Analizando...' : (
                            <>
                                <Sparkles className="w-5 h-5" />
                                Optimizar Compras ({selectedItems.length})
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
