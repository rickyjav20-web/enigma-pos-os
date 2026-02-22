import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, RefreshCw, CheckCircle, AlertTriangle, Package, Loader2, ChevronDown, ChevronUp, ChefHat } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface ShiftTask {
    id: string;
    supplyItemId: string;
    type: string;
    status: string;
    priority: number;
    reason: string;
    targetQty: number | null;
    supplyItem: {
        id: string;
        name: string;
        defaultUnit: string;
        yieldUnit: string | null;
        stockQuantity: number;
        parLevel: number | null;
        isProduction: boolean;
        category: string | null;
        countZone: number | null;
    };
}

interface CountEntry {
    taskId: string;
    supplyItemId: string;
    countedQty: string;  // string for controlled input
    systemQty: number;
    name: string;
    unit: string;
    isProduction: boolean;
}

function getShift(): 'MORNING' | 'EVENING' {
    const hour = new Date().getHours();
    return hour < 15 ? 'MORNING' : 'EVENING';  // before 3pm = morning
}

function getToday(): string {
    return new Date().toISOString().slice(0, 10);
}

export default function InventoryPage() {
    const { user } = useAuth();
    const shift = getShift();
    const today = getToday();
    const [tasks, setTasks] = useState<ShiftTask[]>([]);
    const [counts, setCounts] = useState<Record<string, CountEntry>>({});
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [batchesOpen, setBatchesOpen] = useState(true);
    const [ingredientsOpen, setIngredientsOpen] = useState(true);

    const loadTasks = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/inventory/tasks', { params: { date: today, shift, type: 'INVENTORY' } });
            const taskList: ShiftTask[] = res.data || [];
            setTasks(taskList);

            // Initialize count entries from tasks
            const initial: Record<string, CountEntry> = {};
            for (const t of taskList) {
                initial[t.id] = {
                    taskId: t.id,
                    supplyItemId: t.supplyItemId,
                    countedQty: String(t.supplyItem.stockQuantity ?? 0),
                    systemQty: t.supplyItem.stockQuantity ?? 0,
                    name: t.supplyItem.name,
                    unit: t.supplyItem.yieldUnit || t.supplyItem.defaultUnit,
                    isProduction: t.supplyItem.isProduction
                };
            }
            setCounts(initial);
        } catch (e) {
            console.error('Failed to load inventory tasks', e);
            setError('No se pudieron cargar las tareas.');
        } finally {
            setLoading(false);
        }
    }, [today, shift]);

    useEffect(() => { loadTasks(); }, [loadTasks]);

    const handleGenerate = async () => {
        setGenerating(true);
        setError(null);
        try {
            await api.post('/inventory/tasks/generate', { date: today, shift });
            await loadTasks();
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Error al generar tareas.');
        } finally {
            setGenerating(false);
        }
    };

    const handleCountChange = (taskId: string, val: string) => {
        setCounts(prev => ({ ...prev, [taskId]: { ...prev[taskId], countedQty: val } }));
    };

    const completedCount = Object.values(counts).filter(c => c.countedQty !== '').length;
    const totalCount = tasks.length;

    const handleSubmit = async () => {
        if (!user) return;
        setSubmitting(true);
        setError(null);

        const entries = Object.values(counts);
        let successCount = 0;
        const errors: string[] = [];

        for (const entry of entries) {
            const counted = parseFloat(entry.countedQty);
            if (isNaN(counted)) continue;

            try {
                await api.post('/inventory/count', {
                    supplyItemId: entry.supplyItemId,
                    countedQty: counted,
                    shift,
                    taskId: entry.taskId,
                    userId: user.id,
                    userName: user.name
                });
                successCount++;
            } catch (e: any) {
                errors.push(`${entry.name}: ${e?.response?.data?.error || 'error'}`);
            }
        }

        setSubmitting(false);

        if (errors.length > 0) {
            setError(`${successCount} conteos guardados. Errores: ${errors.join(', ')}`);
        } else {
            setDone(true);
        }
    };

    // ── Success Screen ─────────────────────────────────────────────────────
    if (done) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-6 p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                    <CheckCircle size={40} className="text-emerald-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Inventario Confirmado</h2>
                    <p className="text-zinc-400 text-sm">
                        {totalCount} items contados — turno {shift === 'MORNING' ? 'Mañana' : 'Cierre'}
                    </p>
                </div>
                <button
                    onClick={() => { setDone(false); setTasks([]); setCounts({}); loadTasks(); }}
                    className="px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-white font-semibold transition-colors"
                >
                    Nuevo Conteo
                </button>
            </div>
        );
    }

    // ── Morning message if no inventory tasks ──────────────────────────────
    if (!loading && shift === 'MORNING' && tasks.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
                <ClipboardList size={48} className="text-zinc-600" />
                <h2 className="text-xl font-semibold text-zinc-300">Turno de Mañana</h2>
                <p className="text-zinc-500 text-sm max-w-xs">El inventario de conteo se realiza al cierre del turno Tarde-Noche.<br />Por las mañanas ve a <strong>Producción</strong> para tus tareas.</p>
            </div>
        );
    }

    const batches = tasks.filter(t => t.supplyItem.isProduction);
    const ingredients = tasks.filter(t => !t.supplyItem.isProduction);

    const dateStr = new Date(today + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-white/5">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-white capitalize">{dateStr}</h1>
                        <p className="text-sm text-zinc-500 mt-0.5">
                            Inventario de {shift === 'MORNING' ? 'Apertura' : 'Cierre'}
                            {tasks.length > 0 && <span className="ml-2 text-zinc-400">{completedCount}/{totalCount} contados</span>}
                        </p>
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                    >
                        {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        {tasks.length === 0 ? 'Generar Tareas' : 'Regenerar'}
                    </button>
                </div>

                {/* Progress bar */}
                {totalCount > 0 && (
                    <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-violet-500 rounded-full transition-all duration-500"
                            style={{ width: `${(completedCount / totalCount) * 100}%` }}
                        />
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {loading && (
                    <div className="flex items-center justify-center h-40 gap-3 text-zinc-500">
                        <Loader2 size={20} className="animate-spin" />
                        <span className="text-sm">Cargando tareas...</span>
                    </div>
                )}

                {!loading && tasks.length === 0 && (
                    <div className="text-center py-12 text-zinc-500">
                        <Package size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No hay tareas para este turno.</p>
                        <p className="text-xs mt-1">Pulsa "Generar Tareas" para crear el conteo de hoy.</p>
                    </div>
                )}

                {/* Batches Section */}
                {batches.length > 0 && (
                    <div>
                        <button
                            onClick={() => setBatchesOpen(v => !v)}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-widest text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-xl mb-2"
                        >
                            <span className="flex items-center gap-2">
                                <ChefHat size={14} />
                                Batches / Preparados — Zona 2
                            </span>
                            {batchesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {batchesOpen && batches.map(task => (
                            <CountRow
                                key={task.id}
                                task={task}
                                entry={counts[task.id]}
                                onChange={(val) => handleCountChange(task.id, val)}
                            />
                        ))}
                    </div>
                )}

                {/* Ingredients Section */}
                {ingredients.length > 0 && (
                    <div>
                        <button
                            onClick={() => setIngredientsOpen(v => !v)}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-widest text-blue-400/80 bg-blue-500/5 border border-blue-500/20 rounded-xl mb-2"
                        >
                            <span className="flex items-center gap-2">
                                <Package size={14} />
                                Ingredientes del Día — Zona 3
                            </span>
                            {ingredientsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {ingredientsOpen && ingredients.map(task => (
                            <CountRow
                                key={task.id}
                                task={task}
                                entry={counts[task.id]}
                                onChange={(val) => handleCountChange(task.id, val)}
                            />
                        ))}
                    </div>
                )}

                {error && (
                    <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm">
                        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}
            </div>

            {/* Footer */}
            {tasks.length > 0 && (
                <div className="px-4 py-4 border-t border-white/5 bg-zinc-950">
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || completedCount === 0}
                        className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-white text-lg transition-all flex items-center justify-center gap-2"
                    >
                        {submitting
                            ? <><Loader2 size={20} className="animate-spin" /> Guardando...</>
                            : <><CheckCircle size={20} /> Confirmar Conteo ({completedCount}/{totalCount})</>
                        }
                    </button>
                </div>
            )}
        </div>
    );
}

function CountRow({ task, entry, onChange }: {
    task: ShiftTask;
    entry?: CountEntry;
    onChange: (val: string) => void;
}) {
    const system = task.supplyItem.stockQuantity ?? 0;
    const counted = parseFloat(entry?.countedQty ?? '');
    const unit = task.supplyItem.yieldUnit || task.supplyItem.defaultUnit;
    const variance = isNaN(counted) ? null : counted - system;
    const colorClass = entry && entry.countedQty !== '' ? getVarianceColor(system, counted) : 'border-white/10';

    return (
        <div className={`flex items-center gap-3 p-3 mb-2 rounded-xl border transition-colors ${colorClass}`}>
            {/* Priority indicator */}
            <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${task.priority >= 3 ? 'bg-red-500' : task.priority === 2 ? 'bg-amber-500' : 'bg-zinc-600'}`} />

            {/* Name + system qty */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{task.supplyItem.name}</p>
                <p className="text-xs text-zinc-500">Sistema: {system.toLocaleString('es', { maximumFractionDigits: 2 })} {unit}</p>
            </div>

            {/* Count input */}
            <div className="flex items-center gap-2 flex-shrink-0">
                <input
                    type="number"
                    inputMode="decimal"
                    value={entry?.countedQty ?? ''}
                    onChange={e => onChange(e.target.value)}
                    placeholder={String(system)}
                    className="w-24 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono text-right focus:border-violet-500 focus:outline-none"
                />
                <span className="text-xs text-zinc-500 w-8">{unit}</span>
            </div>

            {/* Variance badge */}
            {variance !== null && (
                <div className={`text-xs font-mono font-bold px-2 py-1 rounded-lg ${Math.abs(variance) < 0.01 ? 'text-emerald-400 bg-emerald-500/10' : variance > 0 ? 'text-blue-400 bg-blue-500/10' : 'text-red-400 bg-red-500/10'}`}>
                    {variance > 0 ? '+' : ''}{variance.toLocaleString('es', { maximumFractionDigits: 2 })}
                </div>
            )}
        </div>
    );
}

function getVarianceColor(system: number, counted: number): string {
    if (isNaN(counted)) return 'border-white/10';
    const pct = system > 0 ? Math.abs(counted - system) / system : (counted > 0 ? 1 : 0);
    if (pct <= 0.05) return 'border-emerald-500/40 bg-emerald-500/5';
    if (pct <= 0.15) return 'border-amber-500/40 bg-amber-500/5';
    return 'border-red-500/40 bg-red-500/5';
}
