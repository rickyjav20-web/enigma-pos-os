import { useState, useEffect } from 'react';
import { ChefHat, Plus, Minus, CheckCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface ProductionItem {
    id: string;
    name: string;
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
            const res = await api.get('/supply-items'); // Need to filter for Zone 2 in generic endpoint or specific query
            // Assuming the endpoint returns all, we filter client side for MVP or better: add query param
            // Filter: isProduction = true
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
                unit: selectedItem.yieldUnit,
                reason: 'Manual Production (Kitchen Station)',
                userId: user?.id,
                userName: user?.name
            };

            await api.post('/production', payload);

            setSuccessMessage(`Produced ${quantity} batch(es) of ${selectedItem.name}`);
            setSelectedItem(null);
            fetchItems(); // Refresh stock

            // Auto-hide success
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (e) {
            console.error(e);
            alert("Failed to register production");
        } finally {
            setIsProducing(false);
        }
    };

    return (
        <div className="h-full flex flex-col p-6 overflow-hidden">
            <header className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <ChefHat className="text-amber-500" size={32} /> Production (Zone 2)
                    </h1>
                    <p className="text-zinc-500">Tap an item to reproduce a batch.</p>
                </div>
            </header>

            {/* FEEDBACK */}
            {successMessage && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 px-6 py-3 rounded-xl font-bold flex items-center gap-2 animate-bounce">
                    <CheckCircle size={20} /> {successMessage}
                </div>
            )}

            {/* GRID */}
            <div className="flex-1 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                {loading ? (
                    <p className="text-zinc-500">Loading items...</p>
                ) : items.map(item => (
                    <button
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        className={`p-6 rounded-2xl border flex flex-col items-start transition-all text-left relative overflow-hidden group ${selectedItem?.id === item.id
                            ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500 shadow-xl'
                            : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800'
                            }`}
                    >
                        {/* Background Decor */}
                        <ChefHat className="absolute -right-4 -bottom-4 text-white/5 group-hover:text-amber-500/10 transition-colors" size={120} />

                        <h3 className="text-lg font-bold text-white mb-1 group-hover:text-amber-400 transition-colors line-clamp-2">{item.name}</h3>
                        <div className="text-zinc-400 text-sm mb-4">
                            Batch Size: <span className="text-zinc-300 font-mono">{item.yieldQuantity} {item.yieldUnit}</span>
                        </div>

                        <div className="mt-auto flex items-center gap-2">
                            <div className={`px-2 py-1 rounded text-xs font-bold ${item.stockQuantity <= 0 ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-zinc-400'}`}>
                                Stock: {item.stockQuantity}
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* ACTION BAR (Fixed Bottom) */}
            <div className={`fixed bottom-0 left-24 right-0 p-6 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800 transition-transform duration-300 ${selectedItem ? 'translate-y-0' : 'translate-y-full'}`}>
                {selectedItem && (
                    <div className="max-w-4xl mx-auto flex items-center justify-between gap-8">
                        <div>
                            <p className="text-zinc-500 text-sm uppercase font-bold">Producing</p>
                            <h2 className="text-2xl font-bold text-white">{selectedItem.name}</h2>
                        </div>

                        <div className="flex items-center gap-6 bg-zinc-900 rounded-xl p-2 border border-zinc-800">
                            <button
                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                className="w-12 h-12 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center justify-center text-white"
                            >
                                <Minus />
                            </button>
                            <div className="text-center min-w-[80px]">
                                <span className="text-3xl font-bold text-white">{quantity}</span>
                                <span className="block text-xs text-zinc-500">BATCH(ES)</span>
                            </div>
                            <button
                                onClick={() => setQuantity(quantity + 1)}
                                className="w-12 h-12 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center justify-center text-white"
                            >
                                <Plus />
                            </button>
                        </div>

                        <button
                            onClick={handleProduce}
                            disabled={isProducing}
                            className="flex-1 max-w-xs h-16 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 rounded-xl font-bold text-black text-xl shadow-lg flex items-center justify-center gap-2"
                        >
                            {isProducing ? 'Registering...' : (
                                <>
                                    <ChefHat /> PRODUCE
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
