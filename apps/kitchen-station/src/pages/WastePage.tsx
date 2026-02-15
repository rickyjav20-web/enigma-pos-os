import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, Search, AlertTriangle, AlertCircle, X, CheckCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

const WASTE_TYPES = [
    { id: 'PRODUCTION_FAILURE', label: 'Fallo de Producción', icon: '🔥', description: 'Se quemó, salió mal, error de receta' },
    { id: 'EXPIRED', label: 'Vencimiento / Mal Estado', icon: '🤢', description: 'Producto vencido o mal refrigerado' },
    { id: 'OPERATIONAL', label: 'Accidente Operativo', icon: '💥', description: 'Se cayó, se contaminó, error de manipulación' },
    { id: 'INVENTORY_CORRECTION', label: 'Corrección de Inventario', icon: '📉', description: 'Conteo físico no coincide (Faltante)' }
] as const;

export default function WastePage() {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [allItems, setAllItems] = useState<any[]>([]); // Products + SupplyItems
    const [loading, setLoading] = useState(false);

    // Form State
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

            const products = (prodRes.data.data || []).map((p: any) => ({ ...p, type: 'PRODUCT', displayType: 'Zone 1 (Venta)' }));
            const supplies = (supplyRes.data.data || []).map((s: any) => ({
                ...s,
                type: 'SUPPLY',
                displayType: s.isProduction ? 'Zone 2 (Batch)' : 'Zone 3 (Insumo)'
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
        setSearchTerm(''); // Clear search to show form focused
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
                unit: selectedItem.yieldUnit || selectedItem.defaultUnit || 'und', // Best guess unit
                type: wasteType,
                reason: notes,
                userId: user?.id
            });

            setSuccessMessage(`Reported waste for ${selectedItem.name}`);
            setSelectedItem(null);
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (e) {
            console.error(e);
            alert("Failed to report waste");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="h-full flex flex-col p-6 max-w-4xl mx-auto">
            <header className="mb-6">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Trash2 className="text-red-500" size={32} /> Reportar Merma
                </h1>
                <p className="text-zinc-500">Registre cualquier pérdida de inventario (Zone 1, 2, o 3).</p>
            </header>

            {successMessage && (
                <div className="mb-6 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 px-6 py-4 rounded-xl font-bold flex items-center gap-2">
                    <CheckCircle size={24} /> {successMessage}
                </div>
            )}

            {!selectedItem ? (
                <div className="flex-1 flex flex-col gap-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-4 text-zinc-500" size={24} />
                        <input
                            type="text"
                            placeholder="Buscar producto o ingrediente..."
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-14 pr-4 py-4 text-xl text-white focus:ring-2 focus:ring-red-500 outline-none"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2">
                        {loading && <p className="text-zinc-500 text-center mt-10">Cargando catálogo...</p>}

                        {filteredItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => handleSelect(item)}
                                className="w-full p-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-left flex justify-between items-center group transition-colors"
                            >
                                <div>
                                    <h3 className="font-bold text-lg text-white group-hover:text-red-400 transition-colors">{item.name}</h3>
                                    <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded uppercase tracking-wider font-bold">
                                        {item.displayType}
                                    </span>
                                </div>
                                <div className="text-zinc-500 group-hover:text-white">
                                    <AlertTriangle size={20} />
                                </div>
                            </button>
                        ))}

                        {searchTerm && filteredItems.length === 0 && !loading && (
                            <p className="text-zinc-500 text-center mt-10">No se encontraron productos.</p>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-red-500 font-bold text-xs uppercase tracking-wider">Reportando Merma</span>
                            <h2 className="text-3xl font-bold text-white mt-1">{selectedItem.name}</h2>
                            <p className="text-zinc-400">{selectedItem.displayType}</p>
                        </div>
                        <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Step 1: Quantity */}
                    <div>
                        <label className="block text-sm font-bold text-zinc-400 mb-2">Cantidad Perdida</label>
                        <div className="flex gap-4">
                            <input
                                type="number"
                                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-2xl text-white focus:ring-2 focus:ring-red-500 outline-none font-mono"
                                placeholder="0.00"
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                                autoFocus
                            />
                            <div className="bg-zinc-800 rounded-xl px-4 flex items-center text-zinc-400 font-bold">
                                {selectedItem.yieldUnit || selectedItem.defaultUnit || 'UND'}
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Type */}
                    <div className="grid grid-cols-2 gap-3">
                        {WASTE_TYPES.map(type => (
                            <button
                                key={type.id}
                                onClick={() => setWasteType(type.id)}
                                className={`p-4 rounded-xl border text-left transition-all ${wasteType === type.id
                                        ? 'bg-red-500/20 border-red-500 ring-1 ring-red-500'
                                        : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-800 text-zinc-400'
                                    }`}
                            >
                                <div className="text-2xl mb-2">{type.icon}</div>
                                <div className={`font-bold text-sm ${wasteType === type.id ? 'text-red-400' : 'text-zinc-300'}`}>{type.label}</div>
                                <div className="text-xs text-zinc-500 mt-1 line-clamp-2">{type.description}</div>
                            </button>
                        ))}
                    </div>

                    {/* Step 3: Notes */}
                    <div>
                        <label className="block text-sm font-bold text-zinc-400 mb-2">Nota (Opcional)</label>
                        <textarea
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-red-500 outline-none resize-none h-24"
                            placeholder="Detalles adicionales..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={!quantity || !wasteType || submitting}
                        className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold text-lg shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 mt-4"
                    >
                        {submitting ? 'Registrando...' : (
                            <>
                                <AlertCircle size={24} /> CONFIRMAR MERMA
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
