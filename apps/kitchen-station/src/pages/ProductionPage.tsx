import { useState, useEffect } from 'react';
import { ChefHat, Plus, Minus, CheckCircle, Package, Loader2, Zap, AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface BatchItem {
    id: string;
    name: string;
    category: string | null;
    yieldQuantity: number | null;
    yieldUnit: string | null;
    defaultUnit: string;
    stockQuantity: number;
    parLevel: number | null;
    minStock: number | null;
}

function getShift(): 'MORNING' | 'EVENING' {
    return new Date().getHours() < 15 ? 'MORNING' : 'EVENING';
}

function calcBatchesNeeded(item: BatchItem): number {
    const stock = Math.max(0, item.stockQuantity || 0);
    const par = item.parLevel || 0;
    const yieldQty = item.yieldQuantity || 1;
    const unitsNeeded = Math.max(0, par - stock);
    if (unitsNeeded === 0) return 0;
    return Math.ceil(unitsNeeded / yieldQty);
}

export default function ProductionPage() {
    const { user } = useAuth();
    const [items, setItems] = useState<BatchItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [producing, setProducing] = useState<string | null>(null);
    const [done, setDone] = useState<Set<string>>(new Set());
    const [batchCounts, setBatchCounts] = useState<Record<string, number>>({});
    const [successMsg, setSuccessMsg] = useState('');

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await api.get('/supply-items?limit=500');
            const all = res.data.data || [];
            const batches: BatchItem[] = all
                .filter((i: any) => i.isProduction)
                .map((i: any) => ({
                    id: i.id,
                    name: i.name,
                    category: i.category || null,
                    yieldQuantity: i.yieldQuantity || null,
                    yieldUnit: i.yieldUnit || null,
                    defaultUnit: i.defaultUnit || 'und',
                    stockQuantity: Math.max(0, i.stockQuantity || 0),
                    parLevel: i.parLevel || null,
                    minStock: i.minStock || null,
                }));
            setItems(batches);
            const initial: Record<string, number> = {};
            for (const b of batches) {
                initial[b.id] = Math.max(1, calcBatchesNeeded(b));
            }
            setBatchCounts(initial);
        } catch (e) {
            console.error('Failed to fetch items', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchItems(); }, []);

    const handleProduce = async (item: BatchItem) => {
        if (!user) return;
        setProducing(item.id);
        const batches = batchCounts[item.id] || 1;
        const totalUnits = batches * (item.yieldQuantity || 1);
        try {
            await api.post('/production', {
                supplyItemId: item.id,
                quantity: totalUnits,
                unit: item.yieldUnit || item.defaultUnit,
                reason: `Produccion turno ${getShift()} - ${batches} batch${batches > 1 ? 'es' : ''}`,
                userId: user.id,
                userName: user.name,
            });
            setDone(prev => new Set([...prev, item.id]));
            setSuccessMsg(`Listo: ${item.name} — ${batches} batch${batches > 1 ? 'es' : ''}`);
            setTimeout(() => setSuccessMsg(''), 4000);
            setItems(prev => prev.map(i =>
                i.id === item.id
                    ? { ...i, stockQuantity: Math.max(0, i.stockQuantity) + totalUnits }
                    : i
            ));
        } catch (e) {
            console.error('Production error', e);
            alert('Error al registrar. Intenta de nuevo.');
        } finally {
            setProducing(null);
        }
    };

    const adjustBatch = (itemId: string, delta: number) => {
        setBatchCounts(prev => ({
            ...prev,
            [itemId]: Math.max(1, (prev[itemId] || 1) + delta),
        }));
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center gap-3 text-zinc-500">
                <Loader2 size={28} className="animate-spin text-violet-400" />
                <span>Cargando...</span>
            </div>
        );
    }

    const urgent = items.filter(i => i.parLevel !== null && Math.max(0, i.stockQuantity) < i.parLevel!);
    const okItems = items.filter(i => i.parLevel !== null && Math.max(0, i.stockQuantity) >= i.parLevel!);
    const free = items.filter(i => i.parLevel === null);

    const urgentPending = urgent.filter(i => !done.has(i.id));
    const urgentDone = urgent.filter(i => done.has(i.id));

    return (
        <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-white/5 flex items-center justify-between shrink-0 portrait:px-4 portrait:pt-4">
                <div className="flex items-center gap-3">
                    <ChefHat size={22} className="text-violet-400" />
                    <div>
                        <h1 className="text-lg font-bold text-white leading-none">Producción</h1>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                            Turno {getShift() === 'MORNING' ? 'Mañana' : 'Tarde-Noche'}
                            {urgent.length > 0 && !urgentPending.length
                                ? <span className="ml-2 text-emerald-400 font-semibold">Todo listo</span>
                                : urgentPending.length > 0
                                    ? <span className="ml-2 text-amber-400 font-semibold">{urgentPending.length} pendiente{urgentPending.length > 1 ? 's' : ''}</span>
                                    : null
                            }
                        </p>
                    </div>
                </div>
                <button onClick={fetchItems} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                    <RefreshCw size={15} />
                </button>
            </div>

            {/* Toast */}
            {successMsg && (
                <div className="mx-4 mt-3 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 shrink-0">
                    <CheckCircle size={15} className="text-emerald-400 shrink-0" />
                    <span className="text-sm text-emerald-300 font-medium">{successMsg}</span>
                </div>
            )}

            {/* landscape: 2-col grid, portrait: 1-col */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 portrait:px-3">

                {/* ── URGENTE ──────────────────────────────────── */}
                {urgent.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <Zap size={14} className="text-amber-400" />
                            <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
                                Producir ahora
                            </span>
                            {urgentPending.length === 0 && (
                                <span className="text-[11px] text-emerald-500 font-semibold ml-1">— todo listo</span>
                            )}
                        </div>
                        <div className="landscape:grid landscape:grid-cols-2 landscape:gap-2 portrait:space-y-2">
                            {urgentPending.map(item => (
                                <BatchCard
                                    key={item.id}
                                    item={item}
                                    batches={batchCounts[item.id] || 1}
                                    isDone={false}
                                    isProducing={producing === item.id}
                                    onAdjust={(d) => adjustBatch(item.id, d)}
                                    onProduce={() => handleProduce(item)}
                                    variant="urgent"
                                />
                            ))}
                            {urgentDone.map(item => (
                                <BatchCard
                                    key={item.id}
                                    item={item}
                                    batches={batchCounts[item.id] || 1}
                                    isDone={true}
                                    isProducing={false}
                                    onAdjust={(d) => adjustBatch(item.id, d)}
                                    onProduce={() => handleProduce(item)}
                                    variant="urgent"
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* ── OK / EXTRA ────────────────────────────────── */}
                {okItems.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <CheckCircle size={14} className="text-emerald-500" />
                            <span className="text-xs font-bold uppercase tracking-widest text-emerald-500/70">
                                Stock cubierto
                            </span>
                            <span className="text-[11px] text-zinc-600 ml-1">— extra opcional</span>
                        </div>
                        <div className="landscape:grid landscape:grid-cols-2 landscape:gap-2 portrait:space-y-2">
                            {okItems.map(item => (
                                <BatchCard
                                    key={item.id}
                                    item={item}
                                    batches={batchCounts[item.id] || 1}
                                    isDone={done.has(item.id)}
                                    isProducing={producing === item.id}
                                    onAdjust={(d) => adjustBatch(item.id, d)}
                                    onProduce={() => handleProduce(item)}
                                    variant="ok"
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* ── LIBRE ─────────────────────────────────────── */}
                {free.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <Package size={14} className="text-zinc-600" />
                            <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">
                                Sin par configurado
                            </span>
                        </div>
                        <div className="landscape:grid landscape:grid-cols-2 landscape:gap-2 portrait:space-y-2">
                            {free.map(item => (
                                <BatchCard
                                    key={item.id}
                                    item={item}
                                    batches={batchCounts[item.id] || 1}
                                    isDone={done.has(item.id)}
                                    isProducing={producing === item.id}
                                    onAdjust={(d) => adjustBatch(item.id, d)}
                                    onProduce={() => handleProduce(item)}
                                    variant="free"
                                />
                            ))}
                        </div>
                    </section>
                )}

                {items.length === 0 && (
                    <div className="text-center py-16 text-zinc-600">
                        <Package size={36} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Sin items de produccion.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Batch Card ────────────────────────────────────────────────────────── */
function BatchCard({
    item, batches, isDone, isProducing, onAdjust, onProduce, variant,
}: {
    item: BatchItem;
    batches: number;
    isDone: boolean;
    isProducing: boolean;
    onAdjust: (d: number) => void;
    onProduce: () => void;
    variant: 'urgent' | 'ok' | 'free';
}) {
    const stock = Math.max(0, item.stockQuantity);
    const yieldQty = item.yieldQuantity || 1;
    const unit = item.yieldUnit || item.defaultUnit;
    const batchesNeeded = calcBatchesNeeded(item);
    const willHave = stock + batches * yieldQty;

    const containerCls = isDone
        ? 'border-emerald-500/25 bg-emerald-500/5'
        : variant === 'urgent'
            ? 'border-amber-500/25 bg-amber-500/5'
            : 'border-white/8 bg-white/[0.02]';

    const accentCls = isDone
        ? 'bg-emerald-500'
        : variant === 'urgent'
            ? 'bg-amber-500'
            : variant === 'ok'
                ? 'bg-emerald-600'
                : 'bg-zinc-700';

    const btnCls = variant === 'urgent' && !isDone
        ? 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/20'
        : 'bg-violet-600 hover:bg-violet-500 shadow-violet-500/20';

    return (
        <div className={`rounded-2xl border transition-all ${containerCls}`}>
            <div className="flex items-center gap-3 px-4 py-4 tablet:py-5">
                <div className={`w-1 h-12 rounded-full shrink-0 ${accentCls}`} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <p className="text-base font-bold text-white leading-tight truncate">{item.name}</p>
                        {variant === 'urgent' && !isDone && <AlertTriangle size={13} className="text-amber-400 shrink-0" />}
                        {isDone && <CheckCircle size={13} className="text-emerald-400 shrink-0" />}
                    </div>

                    {isDone ? (
                        <p className="text-xs text-emerald-400/80">
                            +{batches * yieldQty} {unit} agregado · stock ~{willHave} {unit}
                        </p>
                    ) : (
                        <>
                            <p className="text-xs text-zinc-400">
                                {item.parLevel !== null
                                    ? `Stock: ${stock} ${unit} · meta: ${item.parLevel} ${unit}`
                                    : `Stock actual: ${stock} ${unit}`
                                }
                            </p>
                            <p className="text-[11px] text-zinc-600 mt-0.5">
                                1 batch = {yieldQty} {unit}
                                {batchesNeeded > 0 && ` · recomendado: ${batchesNeeded} batch${batchesNeeded > 1 ? 'es' : ''}`}
                            </p>
                        </>
                    )}
                </div>

                {/* Controls */}
                {!isDone ? (
                    <div className="flex items-center gap-2 shrink-0">
                        {/* +/- counter — min 44px touch targets */}
                        <div className="flex items-center bg-black/40 border border-white/10 rounded-xl overflow-hidden">
                            <button
                                onClick={() => onAdjust(-1)}
                                className="w-11 h-11 flex items-center justify-center text-zinc-400 hover:text-white active:bg-white/10 transition-colors"
                            >
                                <Minus size={16} />
                            </button>
                            <div className="w-10 text-center select-none">
                                <span className="text-lg font-extrabold text-white tabular-nums">{batches}</span>
                            </div>
                            <button
                                onClick={() => onAdjust(1)}
                                className="w-11 h-11 flex items-center justify-center text-zinc-400 hover:text-white active:bg-white/10 transition-colors"
                            >
                                <Plus size={16} />
                            </button>
                        </div>

                        {/* Hecho — big, clear CTA */}
                        <button
                            onClick={onProduce}
                            disabled={isProducing}
                            className={`h-11 px-5 rounded-xl font-extrabold text-sm text-white transition-all active:scale-95 flex items-center gap-2 shadow-lg ${btnCls} disabled:opacity-50`}
                        >
                            {isProducing
                                ? <Loader2 size={15} className="animate-spin" />
                                : <ChefHat size={15} />
                            }
                            {!isProducing && 'Hecho'}
                        </button>
                    </div>
                ) : (
                    <div className="shrink-0 w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <CheckCircle size={18} className="text-emerald-400" />
                    </div>
                )}
            </div>
        </div>
    );
}
