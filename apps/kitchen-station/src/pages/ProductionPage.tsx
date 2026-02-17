import { useState, useEffect } from 'react';
import { ChefHat, Plus, Minus, CheckCircle, Package, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface ProductionItem {
    id: string;
    name: string;
    category: string;
    yieldQuantity: number;
    yieldUnit: string;
    stockQuantity: number;
}

export default function ProductionPage() {
    const { user } = useAuth();
    const [items, setItems] = useState<ProductionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<ProductionItem | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [isProducing, setIsProducing] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        try {
            const res = await api.get('/supply-items');
            const allItems = res.data.data || [];
            const zone2 = allItems.filter((i: any) => i.isProduction);
            setItems(zone2);
        } catch (e) {
            console.error("Failed to fetch production items", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (item: ProductionItem) => {
        setSelectedItem(item);
        setQuantity(1);
        setSuccessMessage('');
    };

    const handleProduce = async () => {
        if (!selectedItem) return;
        setIsProducing(true);

        try {
            const payload = {
                supplyItemId: selectedItem.id,
                quantity: quantity * (selectedItem.yieldQuantity || 1),
                unit: selectedItem.yieldUnit || 'und',
                reason: 'Manual Production (Kitchen Station)',
                userId: user?.id,
                userName: user?.name
            };

            await api.post('/production', payload);

            setSuccessMessage(`✓ Producido: ${quantity} batch de ${selectedItem.name}`);
            setSelectedItem(null);
            fetchItems();

            setTimeout(() => setSuccessMessage(''), 4000);
        } catch (e) {
            console.error(e);
            alert("Error al registrar producción");
        } finally {
            setIsProducing(false);
        }
    };

    const getStockColor = (stock: number) => {
        if (stock <= 0) return { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/20' };
        if (stock < 5) return { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/20' };
        return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/20' };
    };

    return (
        <div className="h-full flex flex-col p-6 overflow-hidden">
            {/* Header */}
            <header className="mb-6">
                <div className="flex items-center gap-3 mb-1">
                    <ChefHat className="text-violet-400" size={28} />
                    <h1 className="text-2xl font-bold text-white tracking-tight">Producción</h1>
                    <span className="text-xs font-bold text-zinc-500 bg-white/5 px-2.5 py-1 rounded-full border border-white/5 uppercase tracking-wider">Zone 2</span>
                </div>
                <p className="text-zinc-500 text-sm ml-[40px]">Seleccione un item y registre la producción del batch.</p>
            </header>

            {/* Success Toast */}
            {successMessage && (
                <div className="mb-4 glass-card px-5 py-3 rounded-xl flex items-center gap-3 animate-fade-in border-emerald-500/20 bg-emerald-500/10">
                    <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                    <span className="text-emerald-300 font-medium text-sm">{successMessage}</span>
                </div>
            )}

            {/* Grid */}
            <div className="flex-1 overflow-y-auto pb-28">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-3">
                        <Loader2 className="text-violet-400 animate-spin" size={32} />
                        <p className="text-zinc-500 text-sm">Cargando items de producción...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-3">
                        <Package className="text-zinc-700" size={48} />
                        <p className="text-zinc-500">No hay items de producción configurados.</p>
                        <p className="text-zinc-600 text-sm">Configure batches desde HQ → Inventory</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {items.map((item, idx) => {
                            const stock = getStockColor(item.stockQuantity);
                            const isSelected = selectedItem?.id === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelect(item)}
                                    className={`glass-card p-5 rounded-xl flex flex-col items-start transition-all duration-200 text-left relative overflow-hidden group animate-fade-in ${isSelected
                                            ? 'ring-2 ring-violet-500 border-violet-500/50 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.15)]'
                                            : 'hover:bg-white/[0.04] hover:border-white/10'
                                        }`}
                                    style={{ animationDelay: `${idx * 30}ms` }}
                                >
                                    {/* Name — large and prominent */}
                                    <h3 className={`text-base font-bold mb-2 leading-tight line-clamp-2 transition-colors ${isSelected ? 'text-violet-300' : 'text-white group-hover:text-violet-300'
                                        }`}>
                                        {item.name}
                                    </h3>

                                    {/* Category */}
                                    {item.category && (
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-3">
                                            {item.category}
                                        </span>
                                    )}

                                    {/* Bottom row — batch size + stock */}
                                    <div className="mt-auto w-full flex items-center justify-between gap-2 pt-2">
                                        {item.yieldQuantity ? (
                                            <span className="text-xs text-zinc-400 font-mono">
                                                {item.yieldQuantity} {item.yieldUnit || 'und'}/batch
                                            </span>
                                        ) : (
                                            <span className="text-xs text-zinc-600 italic">Sin receta</span>
                                        )}

                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stock.bg} ${stock.text} ${stock.border} border`}>
                                            {item.stockQuantity}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Action Bar (Fixed Bottom) */}
            <div className={`fixed bottom-0 left-20 right-0 transition-all duration-300 ${selectedItem ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
                <div className="bg-black/60 backdrop-blur-2xl border-t border-white/5 p-5">
                    {selectedItem && (
                        <div className="max-w-4xl mx-auto flex items-center justify-between gap-6">
                            {/* Item info */}
                            <div className="min-w-0">
                                <p className="text-[10px] text-violet-400 uppercase tracking-wider font-bold">Produciendo</p>
                                <h2 className="text-lg font-bold text-white truncate">{selectedItem.name}</h2>
                                {selectedItem.yieldQuantity ? (
                                    <p className="text-xs text-zinc-500">{selectedItem.yieldQuantity} {selectedItem.yieldUnit || 'und'} por batch</p>
                                ) : null}
                            </div>

                            {/* Quantity Control */}
                            <div className="flex items-center gap-3 glass-card rounded-xl p-1.5 shrink-0">
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                                >
                                    <Minus size={18} />
                                </button>
                                <div className="text-center min-w-[56px]">
                                    <span className="text-2xl font-bold text-white tabular-nums">{quantity}</span>
                                    <span className="block text-[9px] text-zinc-500 uppercase tracking-wider">batch</span>
                                </div>
                                <button
                                    onClick={() => setQuantity(quantity + 1)}
                                    className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>

                            {/* Produce Button */}
                            <button
                                onClick={handleProduce}
                                disabled={isProducing}
                                className="h-12 px-8 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white text-sm shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 flex items-center justify-center gap-2 transition-all duration-200 shrink-0"
                            >
                                {isProducing ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <>
                                        <ChefHat size={18} />
                                        PRODUCIR
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
