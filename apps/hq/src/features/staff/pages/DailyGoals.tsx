import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Target, Plus, Trophy, Clock, CheckCircle2, Package, Tag, Wallet,
    Sun, Moon, CalendarDays, Copy, Trash2, Users, Layers, Search, X,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const SESSION_LABELS: Record<string, { label: string; icon: any; color: string }> = {
    MORNING: { label: 'Mañana', icon: Sun, color: 'text-amber-400' },
    AFTERNOON: { label: 'Tarde', icon: Moon, color: 'text-indigo-400' },
    ALL_DAY: { label: 'Todo el día', icon: CalendarDays, color: 'text-zinc-400' },
};

const TYPE_ICONS: Record<string, any> = {
    PRODUCT: Package,
    CATEGORY: Tag,
    REVENUE: Wallet,
    MIXED: Layers,
};

export default function DailyGoals() {
    const queryClient = useQueryClient();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [employeeId, setEmployeeId] = useState('');
    const [session, setSession] = useState<'MORNING' | 'AFTERNOON' | 'ALL_DAY'>('ALL_DAY');
    const [type, setType] = useState('PRODUCT');
    const [targetName, setTargetName] = useState('');
    const [targetId, setTargetId] = useState('');
    const [, setTargetIds] = useState<string[]>([]);
    const [targetQty, setTargetQty] = useState('');
    const [rewardValue, setRewardValue] = useState('1.5');
    const [rewardNote, setRewardNote] = useState('Bono por meta');

    // Product search for MIXED/PRODUCT
    const [productSearch, setProductSearch] = useState('');
    const [selectedProducts, setSelectedProducts] = useState<{ id: string; name: string }[]>([]);

    const { data: employees = [] } = useQuery({
        queryKey: ['staff'],
        queryFn: async () => {
            const res = await api.get('/staff');
            return res.data?.data || [];
        },
    });

    const { data: products = [] } = useQuery({
        queryKey: ['products-all'],
        queryFn: async () => {
            const res = await api.get('/products?limit=500');
            return res.data?.data || res.data || [];
        },
    });

    // Filter products for search
    const filteredProducts = productSearch.length >= 2
        ? products.filter((p: any) =>
            p.name?.toLowerCase().includes(productSearch.toLowerCase()) && p.isActive !== false
        ).slice(0, 8)
        : [];

    const { data: leaderboard = [], isLoading } = useQuery({
        queryKey: ['goals-leaderboard', date],
        queryFn: async () => {
            const res = await api.get(`/goals/leaderboard?date=${date}`);
            return res.data?.data || [];
        },
        refetchInterval: 15000,
    });

    // Current session from server
    const { data: sessionInfo } = useQuery({
        queryKey: ['goals-session'],
        queryFn: async () => {
            const res = await api.get('/goals/session');
            return res.data?.data;
        },
    });

    const createMutation = useMutation({
        mutationFn: async (goalData: any) => api.post('/goals', goalData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['goals-leaderboard'] });
            setShowForm(false);
            resetForm();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => api.delete(`/goals/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals-leaderboard'] }),
    });

    const duplicateMutation = useMutation({
        mutationFn: async ({ fromDate, toDate }: { fromDate: string; toDate: string }) =>
            api.post('/goals/duplicate', { fromDate, toDate }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals-leaderboard'] }),
    });

    const resetForm = () => {
        setTargetName('');
        setTargetId('');
        setTargetIds([]);
        setTargetQty('');
        setSelectedProducts([]);
        setProductSearch('');
    };

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();

        const goalData: any = {
            employeeId: employeeId || '', // empty = ALL employees
            date,
            session,
            type,
            targetName: type === 'MIXED' ? targetName || selectedProducts.map(p => p.name).join(', ') : targetName,
            targetId: type === 'PRODUCT' && selectedProducts.length === 1 ? selectedProducts[0].id : (targetId || targetName),
            targetQty: Number(targetQty),
            rewardType: 'BONUS',
            rewardValue: Number(rewardValue),
            rewardNote,
        };

        if (type === 'MIXED') {
            goalData.targetIds = selectedProducts.map(p => p.id);
        }

        createMutation.mutate(goalData);
    };

    const addProduct = (product: any) => {
        if (!selectedProducts.find(p => p.id === product.id)) {
            setSelectedProducts([...selectedProducts, { id: product.id, name: product.name }]);
        }
        setProductSearch('');
    };

    const removeProduct = (id: string) => {
        setSelectedProducts(selectedProducts.filter(p => p.id !== id));
    };

    // Auto-set targetId when single product selected
    useEffect(() => {
        if (type === 'PRODUCT' && selectedProducts.length === 1) {
            setTargetId(selectedProducts[0].id);
            if (!targetName) setTargetName(selectedProducts[0].name);
        }
    }, [selectedProducts, type]);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <Target className="w-6 h-6 text-pink-400" />
                        Metas y Recompensas
                    </h1>
                    <p className="text-zinc-400 mt-1">
                        Asigna metas diarias (upselling, productos, ventas) y monitorea el progreso en vivo.
                        {sessionInfo && (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                                Sesión actual: <span className={SESSION_LABELS[sessionInfo.currentSession]?.color}>
                                    {SESSION_LABELS[sessionInfo.currentSession]?.label}
                                </span>
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="bg-black/50 border-white/10 text-white w-40"
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => duplicateMutation.mutate({ fromDate: yesterdayStr, toDate: date })}
                        disabled={duplicateMutation.isPending}
                        className="text-zinc-400 border-white/10 hover:bg-white/5"
                        title="Copiar metas de ayer"
                    >
                        <Copy className="w-4 h-4 mr-1" />
                        {duplicateMutation.isPending ? '...' : 'Copiar ayer'}
                    </Button>
                    <Button onClick={() => setShowForm(!showForm)} className="bg-pink-500 hover:bg-pink-600 text-white">
                        <Plus className="w-4 h-4 mr-2" /> Nueva Meta
                    </Button>
                </div>
            </div>

            {/* CREATE FORM */}
            {showForm && (
                <Card className="p-5 bg-black/40 border-pink-500/20 backdrop-blur-xl animate-in slide-in-from-top-4">
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Employee */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">Empleado</label>
                                <select
                                    value={employeeId}
                                    onChange={(e) => setEmployeeId(e.target.value)}
                                    className="w-full h-10 px-3 bg-black/40 border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                                >
                                    <option value="">Todo el equipo</option>
                                    {employees.map((e: any) => (
                                        <option key={e.id} value={e.id}>{e.fullName}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Session */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">Sesión</label>
                                <div className="flex gap-1">
                                    {(['MORNING', 'AFTERNOON', 'ALL_DAY'] as const).map(s => {
                                        const cfg = SESSION_LABELS[s];
                                        const Icon = cfg.icon;
                                        const active = session === s;
                                        return (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => setSession(s)}
                                                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-xs font-semibold transition-all ${active ? 'bg-pink-500/15 border-pink-500/30 text-pink-400' : 'bg-black/30 border-white/10 text-zinc-500 hover:text-zinc-300'
                                                    } border`}
                                            >
                                                <Icon className="w-3.5 h-3.5" />
                                                {cfg.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Type */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">Tipo de Meta</label>
                                <select
                                    value={type}
                                    onChange={(e) => { setType(e.target.value); setSelectedProducts([]); setProductSearch(''); }}
                                    className="w-full h-10 px-3 bg-black/40 border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                                >
                                    <option value="PRODUCT">Producto Específico</option>
                                    <option value="MIXED">Mixta (varios productos)</option>
                                    <option value="CATEGORY">Categoría (Upsell)</option>
                                    <option value="REVENUE">Meta de Ventas ($)</option>
                                </select>
                            </div>

                            {/* Qty */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">
                                    {type === 'REVENUE' ? 'Meta en $' : 'Cantidad a Vender'}
                                </label>
                                <Input
                                    type="number" min="1" step="any"
                                    value={targetQty}
                                    onChange={e => setTargetQty(e.target.value)}
                                    className="bg-black/40 border-white/10"
                                    required
                                />
                            </div>
                        </div>

                        {/* Product search (PRODUCT or MIXED) */}
                        {(type === 'PRODUCT' || type === 'MIXED') && (
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">
                                    {type === 'MIXED' ? 'Productos incluidos (buscar y agregar)' : 'Producto (buscar)'}
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                                    <Input
                                        value={productSearch}
                                        onChange={e => setProductSearch(e.target.value)}
                                        placeholder="Buscar producto..."
                                        className="bg-black/40 border-white/10 pl-9"
                                    />
                                    {filteredProducts.length > 0 && (
                                        <div className="absolute z-20 top-full mt-1 w-full bg-[#0a0a0c] border border-white/10 rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                                            {filteredProducts.map((p: any) => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => addProduct(p)}
                                                    className="w-full text-left px-4 py-2 text-sm text-zinc-200 hover:bg-white/5 flex items-center justify-between"
                                                >
                                                    <span>{p.name}</span>
                                                    <span className="text-xs text-zinc-500">${p.price?.toFixed(2)}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {selectedProducts.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {selectedProducts.map(p => (
                                            <span key={p.id} className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-pink-500/10 text-pink-400 border border-pink-500/20">
                                                {p.name}
                                                <button type="button" onClick={() => removeProduct(p.id)} className="hover:text-pink-200">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Target name (for CATEGORY, REVENUE, or custom label for MIXED) */}
                        {(type === 'CATEGORY' || type === 'REVENUE') && (
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">
                                    {type === 'CATEGORY' ? 'Categoría' : 'Concepto'}
                                </label>
                                <Input
                                    value={targetName}
                                    onChange={e => setTargetName(e.target.value)}
                                    placeholder={type === 'CATEGORY' ? 'Ej. Postres' : 'Ventas Totales'}
                                    className="bg-black/40 border-white/10"
                                    required
                                />
                            </div>
                        )}

                        {type === 'MIXED' && (
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">Nombre de la meta</label>
                                <Input
                                    value={targetName}
                                    onChange={e => setTargetName(e.target.value)}
                                    placeholder="Ej. Cualquier Torta, Combos del día..."
                                    className="bg-black/40 border-white/10"
                                />
                            </div>
                        )}

                        {/* Reward row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">Bono ($)</label>
                                <Input
                                    type="number" min="0" step="0.5"
                                    value={rewardValue}
                                    onChange={e => setRewardValue(e.target.value)}
                                    className="bg-black/40 border-white/10"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">Mensaje</label>
                                <Input
                                    value={rewardNote}
                                    onChange={e => setRewardNote(e.target.value)}
                                    className="bg-black/40 border-white/10 text-pink-300"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
                            <Button type="submit" className="bg-pink-500 hover:bg-pink-600 text-white" disabled={createMutation.isPending}>
                                Asignar Meta
                            </Button>
                        </div>
                    </form>
                </Card>
            )}

            {/* LEADERBOARD */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {isLoading ? (
                    <div className="col-span-full py-20 text-center text-zinc-500">Cargando progreso...</div>
                ) : leaderboard.length === 0 ? (
                    <div className="col-span-full py-20 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                        <Trophy className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-white mb-1">No hay metas para este día</h3>
                        <p className="text-sm text-zinc-400">Asigna metas o copia las de ayer para comenzar.</p>
                    </div>
                ) : (
                    leaderboard.map((emp: any) => (
                        <Card key={emp.employeeId || '__all'} className="p-5 bg-[#0a0a0c] border-white/5 shadow-2xl overflow-hidden relative">
                            {emp.completionRate === 100 && (
                                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 blur-3xl rounded-full" />
                            )}
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${!emp.employeeId ? 'bg-violet-500/20 border-violet-500/30' : 'bg-pink-500/20 border-pink-500/30'}`}>
                                        {!emp.employeeId ? (
                                            <Users className="w-5 h-5 text-violet-400" />
                                        ) : (
                                            <span className="text-pink-400 font-bold">{emp.employeeName.charAt(0)}</span>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white">{emp.employeeName}</h3>
                                        <p className="text-xs text-zinc-400">{emp.completed} de {emp.total} metas completadas</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold font-mono text-white">{emp.completionRate}%</div>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Tasa de Éxito</p>
                                </div>
                            </div>

                            <div className="space-y-3 mt-4 relative z-10">
                                {emp.goals.map((goal: any) => {
                                    const pct = Math.min((goal.currentQty / goal.targetQty) * 100, 100);
                                    const Icon = TYPE_ICONS[goal.type] || Package;
                                    const sessionCfg = SESSION_LABELS[goal.session];

                                    return (
                                        <div key={goal.id} className="relative group p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                                            {goal.isCompleted && (
                                                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-pink-500/50 to-purple-500/50" />
                                            )}
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Icon className="w-4 h-4 text-zinc-400" />
                                                    <span className="text-sm font-medium text-zinc-200">{goal.targetName}</span>
                                                    {sessionCfg && goal.session !== 'ALL_DAY' && (
                                                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${goal.session === 'MORNING' ? 'bg-amber-500/15 text-amber-400' : 'bg-indigo-500/15 text-indigo-400'}`}>
                                                            {sessionCfg.label}
                                                        </span>
                                                    )}
                                                    {goal.type === 'MIXED' && (
                                                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400">Mixta</span>
                                                    )}
                                                    {goal.isCompleted && <CheckCircle2 className="w-4 h-4 text-pink-400 ml-1" />}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-mono text-zinc-300">
                                                        {goal.type === 'REVENUE' ? '$' : ''}{goal.currentQty.toFixed(0)}
                                                        <span className="text-zinc-600"> / {goal.targetQty}</span>
                                                    </span>
                                                    <button
                                                        onClick={() => deleteMutation.mutate(goal.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 transition-all"
                                                        title="Eliminar meta"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5 text-red-400/50 hover:text-red-400" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="h-2 rounded-full overflow-hidden bg-black border border-white/10 mt-1">
                                                <div
                                                    className={`h-full transition-all duration-1000 ${pct === 100 ? 'bg-gradient-to-r from-pink-500 to-purple-500' : 'bg-zinc-600'}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>

                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-[10px] uppercase font-semibold text-pink-400 flex items-center gap-1">
                                                    <Trophy className="w-3 h-3" />
                                                    {goal.rewardNote} (+${goal.rewardValue})
                                                </span>
                                                <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {goal.isCompleted ? 'Logrado' : 'En progreso'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
