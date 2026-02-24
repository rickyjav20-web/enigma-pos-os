import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, RefreshCw, CheckCircle, AlertTriangle, Package, Loader2, ChefHat, Flame } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface BatchItem {
    id: string;
    name: string;
    sku: string | null;
    category: string | null;
    yieldQuantity: number | null;
    yieldUnit: string | null;
    defaultUnit: string;
    stockQuantity: number;
    parLevel: number | null;
    minStock: number | null;
    maxStock: number | null;
}

function getShift(): 'MORNING' | 'EVENING' {
    return new Date().getHours() < 15 ? 'MORNING' : 'EVENING';
}

function getStockStatus(stock: number, par: number | null, min: number | null): 'critical' | 'low' | 'ok' | 'none' {
    if (par === null) return 'none';
    if (min !== null && stock < min) return 'critical';
    if (stock < par) return 'low';
    return 'ok';
}

export default function InventoryPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const shift = getShift();

    const [items, setItems] = useState<BatchItem[]>([]);
    const [counts, setCounts] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedCount, setSavedCount] = useState(0);

    const fetchItems = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/supply-items?limit=500');
            const all = res.data.data || [];
            const batches: BatchItem[] = all
                .filter((i: any) => i.isProduction)
                .sort((a: any, b: any) => {
                    // Sort: with par first (sorted by urgency), then without par
                    const aHasPar = a.parLevel !== null;
                    const bHasPar = b.parLevel !== null;
                    if (aHasPar && !bHasPar) return -1;
                    if (!aHasPar && bHasPar) return 1;
                    return a.name.localeCompare(b.name);
                })
                .map((i: any) => ({
                    id: i.id,
                    name: i.name,
                    sku: i.sku || null,
                    category: i.category || null,
                    yieldQuantity: i.yieldQuantity || null,
                    yieldUnit: i.yieldUnit || null,
                    defaultUnit: i.defaultUnit || 'und',
                    stockQuantity: Math.max(0, i.stockQuantity || 0),
                    parLevel: i.parLevel ?? null,
                    minStock: i.minStock ?? null,
                    maxStock: i.maxStock ?? null,
                }));
            setItems(batches);
            // Pre-fill inputs with current system stock
            const init: Record<string, string> = {};
            for (const b of batches) {
                init[b.id] = '';  // blank = not yet counted
            }
            setCounts(init);
        } catch (e) {
            console.error('Failed to fetch production items', e);
            setError('No se pudo cargar el inventario.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchItems(); }, []);

    const filledCount = Object.values(counts).filter(v => v !== '').length;

    const handleSubmit = async () => {
        if (!user) return;
        setSubmitting(true);
        setError(null);

        const toUpdate = items.filter(i => counts[i.id] !== '');
        let success = 0;
        const errors: string[] = [];

        for (const item of toUpdate) {
            const val = parseFloat(counts[item.id]);
            if (isNaN(val) || val < 0) continue;
            try {
                // Update stock directly + log via inventory count endpoint
                await api.post('/inventory/count', {
                    supplyItemId: item.id,
                    countedQty: val,
                    shift,
                    userId: user.id,
                    userName: user.name,
                });
                success++;
            } catch {
                // Fallback: direct stock update
                try {
                    await api.put(`/supply-items/${item.id}`, { stockQuantity: val });
                    success++;
                } catch (e2: any) {
                    errors.push(item.name);
                }
            }
        }

        setSubmitting(false);
        setSavedCount(success);

        if (errors.length > 0) {
            setError(`${success} guardados. Error en: ${errors.join(', ')}`);
        } else {
            setDone(true);
        }
    };

    // ── Done screen ────────────────────────────────────────────────────────
    if (done) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-5 p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                    <CheckCircle size={38} className="text-emerald-400" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white mb-1">Conteo Guardado</h2>
                    <p className="text-zinc-400 text-sm">{savedCount} batches actualizados · turno {shift === 'MORNING' ? 'Mañana' : 'Cierre'}</p>
                </div>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <button
                        onClick={() => navigate('/production')}
                        className="w-full px-6 py-3.5 bg-violet-600 hover:bg-violet-500 active:scale-[0.99] rounded-xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
                    >
                        <Flame size={16} />
                        Ver Tareas de Produccion
                    </button>
                    <button
                        onClick={() => { setDone(false); fetchItems(); }}
                        className="w-full px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-white font-semibold text-sm transition-colors"
                    >
                        Nuevo Conteo
                    </button>
                </div>
            </div>
        );
    }

    const dateStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-white/5 shrink-0">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-0.5">
                            <ClipboardList size={18} className="text-violet-400" />
                            <h1 className="text-lg font-bold text-white capitalize">{dateStr}</h1>
                        </div>
                        <p className="text-xs text-zinc-500 ml-[26px]">
                            Inventario {shift === 'MORNING' ? 'de Apertura' : 'de Cierre'} · Producciones
                            {filledCount > 0 && (
                                <span className="ml-2 text-violet-400 font-semibold">{filledCount}/{items.length} contados</span>
                            )}
                        </p>
                    </div>
                    <button
                        onClick={fetchItems}
                        disabled={loading}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Progress bar */}
                {items.length > 0 && filledCount > 0 && (
                    <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-violet-500 rounded-full transition-all duration-500"
                            style={{ width: `${(filledCount / items.length) * 100}%` }}
                        />
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 portrait:px-3 landscape:grid landscape:grid-cols-2 landscape:gap-x-3 landscape:content-start landscape:items-start portrait:space-y-2">
                {loading && (
                    <div className="flex items-center justify-center h-40 gap-3 text-zinc-500">
                        <Loader2 size={20} className="animate-spin text-violet-400" />
                        <span className="text-sm">Cargando batches...</span>
                    </div>
                )}

                {!loading && items.length === 0 && (
                    <div className="text-center py-16 text-zinc-600">
                        <Package size={36} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No hay batches configurados.</p>
                    </div>
                )}

                {!loading && items.map(item => (
                    <div key={item.id} className="landscape:mb-2">
                        <CountRow
                            item={item}
                            value={counts[item.id] ?? ''}
                            onChange={(v) => setCounts(prev => ({ ...prev, [item.id]: v }))}
                        />
                    </div>
                ))}

                {error && (
                    <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm mt-2">
                        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}
            </div>

            {/* Footer */}
            {!loading && items.length > 0 && (
                <div className="px-4 py-4 border-t border-white/5 bg-zinc-950 shrink-0">
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || filledCount === 0}
                        className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed font-extrabold text-base text-white transition-all flex items-center justify-center gap-2"
                    >
                        {submitting
                            ? <><Loader2 size={18} className="animate-spin" /> Guardando...</>
                            : <><CheckCircle size={18} /> Confirmar Conteo {filledCount > 0 ? `(${filledCount}/${items.length})` : ''}</>
                        }
                    </button>
                </div>
            )}
        </div>
    );
}

/* ─── Count Row ─────────────────────────────────────────────────────────── */
function CountRow({ item, value, onChange }: {
    item: BatchItem;
    value: string;
    onChange: (v: string) => void;
}) {
    const system = item.stockQuantity;
    // Use defaultUnit for stock/par display (consistent with how stockQuantity is stored)
    const unit = item.defaultUnit;
    const counted = parseFloat(value);
    const hasCounted = value !== '' && !isNaN(counted);
    const variance = hasCounted ? counted - system : null;
    const status = getStockStatus(system, item.parLevel, item.minStock);

    // Border/bg based on whether we've entered a value and what the variance is
    let rowCls = 'border-white/8 bg-white/[0.02]';
    if (hasCounted) {
        if (variance !== null && Math.abs(variance) < 0.01) {
            rowCls = 'border-emerald-500/30 bg-emerald-500/5';
        } else if (variance !== null && variance < 0) {
            rowCls = 'border-red-500/30 bg-red-500/5';
        } else {
            rowCls = 'border-blue-500/30 bg-blue-500/5';
        }
    }

    const statusDot: Record<string, string> = {
        critical: 'bg-red-500',
        low: 'bg-amber-500',
        ok: 'bg-emerald-500',
        none: 'bg-zinc-600',
    };

    return (
        <div className={`rounded-2xl border transition-colors ${rowCls}`}>
            <div className="flex items-center gap-3 px-4 py-3.5 tablet:py-4">
                {/* Status dot */}
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot[status]}`} />

                {/* Name + system qty */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <ChefHat size={12} className="text-zinc-600 shrink-0" />
                        <p className="text-sm font-bold text-white truncate">{item.name}</p>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                        Sistema: <span className="text-zinc-400 font-mono">{system.toLocaleString('es', { maximumFractionDigits: 2 })}</span> {unit}
                        {item.parLevel !== null && (
                            <span className="ml-2 text-zinc-600">· par {item.parLevel}</span>
                        )}
                    </p>
                </div>

                {/* Input — large touch-friendly */}
                <div className="flex items-center gap-2 shrink-0">
                    <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        placeholder={String(system)}
                        className="w-24 h-11 bg-black/40 border border-white/10 rounded-xl px-3 text-white text-base font-mono text-right focus:border-violet-500 focus:outline-none placeholder:text-zinc-700"
                    />
                    <span className="text-xs text-zinc-500 w-8 shrink-0 font-medium">{unit}</span>
                </div>

                {/* Variance badge */}
                {hasCounted && variance !== null && (
                    <div className={`text-xs font-mono font-bold px-2.5 py-1.5 rounded-lg shrink-0 min-w-[48px] text-center ${
                        Math.abs(variance) < 0.01
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : variance > 0
                                ? 'text-blue-400 bg-blue-500/10'
                                : 'text-red-400 bg-red-500/10'
                    }`}>
                        {variance > 0 ? '+' : ''}{variance.toLocaleString('es', { maximumFractionDigits: 2 })}
                    </div>
                )}
            </div>
        </div>
    );
}
