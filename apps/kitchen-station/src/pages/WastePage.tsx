import { useState, useEffect, useMemo } from 'react';
import { Trash2, Search, AlertCircle, X, CheckCircle, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

const WASTE_TYPES = [
    { id: 'WRONG_ORDER', label: 'Pedido Erróneo', icon: '🔄', description: 'Se preparó mal, el cliente lo rechazó' },
    { id: 'DAMAGED', label: 'Se Dañó / Accidente', icon: '💥', description: 'Se cayó, se derramó, se contaminó' },
    { id: 'LOST', label: 'Pérdida / Faltante', icon: '❓', description: 'No se encuentra, posible extravío' },
    { id: 'EXPIRED', label: 'Caducado / Vencido', icon: '🤢', description: 'Vencido, mal refrigerado' },
    { id: 'PRODUCTION_FAILURE', label: 'Fallo Producción', icon: '🔥', description: 'Se quemó, receta salió mal' },
    { id: 'INVENTORY_CORRECTION', label: 'Corrección Inventario', icon: '📉', description: 'Conteo físico no coincide' },
] as const;

export default function WastePage() {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [allItems, setAllItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [quantity, setQuantity] = useState('');
    const [wasteType, setWasteType] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        fetchAllItems();
    }, []);

    const fetchAllItems = async () => {
        setLoading(true);
        try {
            const [prodRes, supplyRes] = await Promise.all([
                api.get('/products'),
                api.get('/supply-items')
            ]);

            const products = (prodRes.data.data || []).map((p: any) => ({ ...p, type: 'PRODUCT', displayType: 'Zone 1 · Venta' }));
            const supplies = (supplyRes.data.data || []).map((s: any) => ({
                ...s,
                type: 'SUPPLY',
                displayType: s.isProduction ? 'Zone 2 · Batch' : 'Zone 3 · Insumo'
            }));

            setAllItems([...products, ...supplies]);
        } catch (e) {
            console.error("Failed to fetch items", e);
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = useMemo(() => {
        if (!searchTerm) return [];
        const lower = searchTerm.toLowerCase();
        return allItems.filter(i => i.name.toLowerCase().includes(lower)).slice(0, 10);
    }, [searchTerm, allItems]);

    const handleSelect = (item: any) => {
        setSelectedItem(item);
        setSearchTerm('');
        setQuantity('');
        setWasteType('');
        setNotes('');
    };

    const handleSubmit = async () => {
        if (!selectedItem || !quantity || !wasteType) return;
        setSubmitting(true);

        try {
            await api.post('/waste', {
                itemId: selectedItem.id,
                quantity: parseFloat(quantity),
                unit: selectedItem.yieldUnit || selectedItem.defaultUnit || 'und',
                type: wasteType,
                reason: notes,
                userId: user?.id,
                userName: user?.name
            });

            setSuccessMessage(`✓ Merma registrada: ${selectedItem.name}`);
            setSelectedItem(null);
            fetchAllItems();
            setTimeout(() => setSuccessMessage(''), 4000);
        } catch (e) {
            console.error(e);
            alert("Error al registrar merma");
        } finally {
            setSubmitting(false);
        }
    };

    const getZoneColor = (displayType: string) => {
        if (displayType.includes('Zone 1')) return 'text-violet-400 bg-violet-500/10 border-violet-500/20';
        if (displayType.includes('Zone 2')) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    };

    return (
        <div className="h-full flex flex-col p-6 max-w-3xl mx-auto">
            {/* Header */}
            <header className="mb-6">
                <div className="flex items-center gap-3 mb-1">
                    <Trash2 className="text-red-400" size={28} />
                    <h1 className="text-2xl font-bold text-white tracking-tight">Reportar Merma</h1>
                </div>
                <p className="text-zinc-500 text-sm ml-[40px]">Registre pérdida de inventario (Zone 1, 2 o 3).</p>
            </header>

            {/* Success */}
            {successMessage && (
                <div className="mb-4 glass-card px-5 py-3 rounded-xl flex items-center gap-3 animate-fade-in border-emerald-500/20 bg-emerald-500/10">
                    <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                    <span className="text-emerald-300 font-medium text-sm">{successMessage}</span>
                </div>
            )}

            {!selectedItem ? (
                /* ═══ SEARCH MODE ═══ */
                <div className="flex-1 flex flex-col gap-4">
                    {/* Search Input */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar producto o ingrediente..."
                            className="w-full glass-input rounded-xl pl-12 pr-4 py-3.5 text-base text-white placeholder-zinc-600 focus:ring-2 focus:ring-red-500/30 outline-none"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {/* Results */}
                    <div className="flex-1 overflow-y-auto space-y-2">
                        {loading && (
                            <div className="flex items-center justify-center h-32 gap-2">
                                <Loader2 className="text-zinc-500 animate-spin" size={20} />
                                <p className="text-zinc-500 text-sm">Cargando catálogo...</p>
                            </div>
                        )}

                        {filteredItems.map((item, idx) => (
                            <button
                                key={item.id}
                                onClick={() => handleSelect(item)}
                                className="w-full p-4 glass-card hover:bg-white/[0.04] hover:border-white/10 rounded-xl text-left flex justify-between items-center group transition-all duration-200 animate-fade-in"
                                style={{ animationDelay: `${idx * 40}ms` }}
                            >
                                <div>
                                    <h3 className="font-bold text-white group-hover:text-red-400 transition-colors">{item.name}</h3>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-bold ${getZoneColor(item.displayType)}`}>
                                            {item.displayType}
                                        </span>
                                        {item.type === 'SUPPLY' && (
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-bold ${item.stockQuantity <= 0 ? 'bg-red-500/15 text-red-400 border-red-500/20'
                                                    : item.stockQuantity < 5 ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                                                        : 'bg-white/5 text-zinc-400 border-white/10'
                                                }`}>
                                                Stock: {item.stockQuantity} {item.defaultUnit || 'und'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-zinc-700 group-hover:text-red-500/60 transition-colors">
                                    <AlertCircle size={18} />
                                </div>
                            </button>
                        ))}

                        {searchTerm && filteredItems.length === 0 && !loading && (
                            <p className="text-zinc-600 text-center mt-12 text-sm">No se encontraron resultados para "{searchTerm}"</p>
                        )}

                        {!searchTerm && !loading && (
                            <p className="text-zinc-700 text-center mt-12 text-sm">Escriba para buscar en el catálogo...</p>
                        )}
                    </div>
                </div>
            ) : (
                /* ═══ FORM MODE ═══ */
                <div className="glass-card rounded-xl p-6 flex flex-col gap-5 animate-fade-in">
                    {/* Selected Item Header */}
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Reportando Merma</span>
                            <h2 className="text-2xl font-bold text-white mt-0.5">{selectedItem.name}</h2>
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-bold ${getZoneColor(selectedItem.displayType)}`}>
                                    {selectedItem.displayType}
                                </span>
                                {selectedItem.type === 'SUPPLY' && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-bold ${selectedItem.stockQuantity <= 0 ? 'bg-red-500/15 text-red-400 border-red-500/20'
                                            : 'bg-white/5 text-zinc-400 border-white/10'
                                        }`}>
                                        Stock actual: {selectedItem.stockQuantity} {selectedItem.defaultUnit || 'und'}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-white/5" />

                    {/* Step 1: Quantity */}
                    <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">Cantidad Perdida</label>
                        <div className="flex gap-3">
                            <input
                                type="number"
                                className="flex-1 glass-input rounded-xl p-3.5 text-xl text-white focus:ring-2 focus:ring-red-500/30 outline-none font-mono"
                                placeholder="0.00"
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                                autoFocus
                            />
                            <div className="glass-card rounded-xl px-4 flex items-center text-zinc-400 font-bold text-sm">
                                {(selectedItem.yieldUnit || selectedItem.defaultUnit || 'UND').toUpperCase()}
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Type */}
                    <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">Tipo de Merma</label>
                        <div className="grid grid-cols-3 gap-2">
                            {WASTE_TYPES.map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => setWasteType(type.id)}
                                    className={`p-3 rounded-xl border text-left transition-all duration-200 ${wasteType === type.id
                                        ? 'bg-red-500/15 border-red-500/40 ring-1 ring-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
                                        : 'glass-card hover:bg-white/[0.04] hover:border-white/10'
                                        }`}
                                >
                                    <div className="text-xl mb-1">{type.icon}</div>
                                    <div className={`font-bold text-xs ${wasteType === type.id ? 'text-red-400' : 'text-zinc-300'}`}>{type.label}</div>
                                    <div className="text-[10px] text-zinc-600 mt-0.5 line-clamp-1">{type.description}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Step 3: Notes */}
                    <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">Nota (Opcional)</label>
                        <textarea
                            className="w-full glass-input rounded-xl p-3 text-sm text-white placeholder-zinc-600 focus:ring-2 focus:ring-red-500/30 outline-none resize-none h-20"
                            placeholder="Detalles adicionales..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                    </div>

                    {/* Submit */}
                    <button
                        onClick={handleSubmit}
                        disabled={!quantity || !wasteType || submitting}
                        className="w-full py-3.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white font-bold text-sm shadow-lg shadow-red-500/15 hover:shadow-red-500/25 flex items-center justify-center gap-2 transition-all duration-200"
                    >
                        {submitting ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <>
                                <AlertCircle size={18} />
                                CONFIRMAR MERMA
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
