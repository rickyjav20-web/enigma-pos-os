import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Target, Plus, Trophy, Clock, CheckCircle2, Package, Tag, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function DailyGoals() {
    const queryClient = useQueryClient();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [employeeId, setEmployeeId] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [type, setType] = useState('PRODUCT');
    const [targetName, setTargetName] = useState('');
    const [targetId, setTargetId] = useState('');
    const [targetQty, setTargetQty] = useState('');
    const [rewardValue, setRewardValue] = useState('10');
    const [rewardNote, setRewardNote] = useState('🌟 Bono Especial');

    const { data: employees = [] } = useQuery({
        queryKey: ['staff'],
        queryFn: async () => {
            const res = await api.get('/staff');
            return res.data?.data || [];
        }
    });

    // Fetch open sessions for shift assignment
    const { data: openSessions = [] } = useQuery({
        queryKey: ['open-sessions'],
        queryFn: async () => {
            const res = await api.get('/register/sessions?status=open');
            const sessions = Array.isArray(res.data) ? res.data : res.data?.data || [];
            return sessions.map((s: any) => ({
                id: s.id,
                label: `${s.employee?.fullName || 'Sin nombre'} — ${s.registerType || 'PHYSICAL'}`,
                employeeId: s.employee?.id || s.employeeId,
            }));
        },
    });

    const { data: leaderboard = [], isLoading } = useQuery({
        queryKey: ['goals-leaderboard', date],
        queryFn: async () => {
            const res = await api.get(`/goals/leaderboard?date=${date}`);
            return res.data?.data || [];
        },
        refetchInterval: 15000 // auto-refresh for live tracking
    });

    const createMutation = useMutation({
        mutationFn: async (goalData: any) => {
            return await api.post('/goals', goalData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['goals-leaderboard'] });
            setShowForm(false);
            // Reset form
            setTargetName('');
            setTargetId('');
            setTargetQty('');
        }
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate({
            employeeId,
            date,
            type,
            targetName,
            targetId: targetId || targetName,
            targetQty: Number(targetQty),
            rewardType: 'BONUS',
            rewardValue: Number(rewardValue),
            rewardNote,
            ...(sessionId && { sessionId }),
        });
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <Target className="w-6 h-6 text-pink-400" />
                        Metas y Recompensas
                    </h1>
                    <p className="text-zinc-400 mt-1">Asigna metas diarias (upselling, productos, ventas) y monitorea el progreso en vivo.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="bg-black/50 border-white/10 text-white w-40"
                    />
                    <Button onClick={() => setShowForm(!showForm)} className="bg-pink-500 hover:bg-pink-600 text-white">
                        <Plus className="w-4 h-4 mr-2" /> Nueva Meta
                    </Button>
                </div>
            </div>

            {/* FORM */}
            {showForm && (
                <Card className="p-5 bg-black/40 border-pink-500/20 backdrop-blur-xl animate-in slide-in-from-top-4">
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">Empleado</label>
                                <select
                                    value={employeeId}
                                    onChange={(e) => setEmployeeId(e.target.value)}
                                    required
                                    className="w-full h-10 px-3 bg-black/40 border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                                >
                                    <option value="" disabled>Seleccione...</option>
                                    {employees.map((e: any) => (
                                        <option key={e.id} value={e.id}>{e.fullName}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">Turno (Opcional)</label>
                                <select
                                    value={sessionId}
                                    onChange={(e) => setSessionId(e.target.value)}
                                    className="w-full h-10 px-3 bg-black/40 border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                                >
                                    <option value="">Meta del Día (sin turno)</option>
                                    {openSessions.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">Tipo de Meta</label>
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                    className="w-full h-10 px-3 bg-black/40 border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                                >
                                    <option value="PRODUCT">Producto Específico</option>
                                    <option value="CATEGORY">Categoría (Upsell)</option>
                                    <option value="REVENUE">Meta de Ventas ($)</option>
                                </select>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">
                                    {type === 'PRODUCT' ? 'Producto a vender (ID o Nombre)' : type === 'CATEGORY' ? 'Categoría a empujar' : 'Concepto'}
                                </label>
                                <Input
                                    value={targetName}
                                    onChange={e => setTargetName(e.target.value)}
                                    placeholder={type === 'PRODUCT' ? 'Ej. Croissant de Almendras' : type === 'CATEGORY' ? 'Ej. Postres' : 'Ventas Totales'}
                                    className="bg-black/40 border-white/10"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">
                                    {type === 'REVENUE' ? 'Meta en $' : 'Cantidad a Vender'}
                                </label>
                                <Input
                                    type="number"
                                    min="1"
                                    step="any"
                                    value={targetQty}
                                    onChange={e => setTargetQty(e.target.value)}
                                    className="bg-black/40 border-white/10"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">Bono / Premio ($)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={rewardValue}
                                    onChange={e => setRewardValue(e.target.value)}
                                    className="bg-black/40 border-white/10"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-semibold text-zinc-400 uppercase">Mensaje Motivacional</label>
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

            {/* LEADERBOARD / PROGRESS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {isLoading ? (
                    <div className="col-span-full py-20 text-center text-zinc-500">Cargando progreso...</div>
                ) : leaderboard.length === 0 ? (
                    <div className="col-span-full py-20 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                        <Trophy className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-white mb-1">No hay metas para este día</h3>
                        <p className="text-sm text-zinc-400">Asigna metas para incentivar a tu equipo y aumentar el ticket promedio.</p>
                    </div>
                ) : (
                    leaderboard.map((emp: any) => (
                        <Card key={emp.employeeId} className="p-5 bg-[#0a0a0c] border-white/5 shadow-2xl overflow-hidden relative">
                            {emp.completionRate === 100 && (
                                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 blur-3xl rounded-full" />
                            )}
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center border border-pink-500/30">
                                        <span className="text-pink-400 font-bold">{emp.employeeName.charAt(0)}</span>
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

                            <div className="space-y-4 mt-6 relative z-10">
                                {emp.goals.map((goal: any) => {
                                    const pct = Math.min((goal.currentQty / goal.targetQty) * 100, 100);
                                    const Icon = goal.type === 'PRODUCT' ? Package : goal.type === 'CATEGORY' ? Tag : Wallet;

                                    return (
                                        <div key={goal.id} className="relative group p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                                            {goal.isCompleted && (
                                                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-pink-500/50 to-purple-500/50" />
                                            )}
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Icon className="w-4 h-4 text-zinc-400" />
                                                    <span className="text-sm font-medium text-zinc-200">{goal.targetName}</span>
                                                    {goal.sessionId && (
                                                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">Turno</span>
                                                    )}
                                                    {goal.isCompleted && <CheckCircle2 className="w-4 h-4 text-pink-400 ml-1" />}
                                                </div>
                                                <div className="text-sm font-mono text-zinc-300">
                                                    {goal.type === 'REVENUE' ? '$' : ''}{goal.currentQty.toFixed(0)}
                                                    <span className="text-zinc-600"> / {goal.targetQty}</span>
                                                </div>
                                            </div>

                                            <div className="h-2 rounded-full overflow-hidden bg-black border border-white/10 mt-1">
                                                <div
                                                    className={`h-full transition-all duration-1000 ${pct === 100 ? 'bg-gradient-to-r from-pink-500 to-purple-500' : 'bg-zinc-600'
                                                        }`}
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
