import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Target, Trophy, Clock, Package, Tag, Wallet } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface DailyGoal {
    id: string;
    type: string;
    targetName: string;
    targetQty: number;
    currentQty: number;
    isCompleted: boolean;
    completedAt?: string;
    rewardNote?: string;
    rewardValue?: number;
    rewardType?: string;
    session?: string;
    status: string;
    date: string;
}

interface LeaderboardEntry {
    employeeId: string;
    employeeName: string;
    goals: DailyGoal[];
    completed: number;
    total: number;
    completionRate: number;
}

type Tab = 'goals' | 'ranking' | 'history';

export default function GoalsPage() {
    const navigate = useNavigate();
    const { employee } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('goals');
    const [celebratingGoal, setCelebratingGoal] = useState<DailyGoal | null>(null);
    const prevCompletedIds = useRef<Set<string>>(new Set());

    // ── Tab 1: My Goals ────────────────────────────────────────────
    // Uses autoSession=true so the API: 1) auto-detects date in tenant timezone,
    // 2) filters to current session, 3) includes shared goals (employeeId='')
    const { data: myGoals = [] } = useQuery<DailyGoal[]>({
        queryKey: ['pos-my-goals', employee?.id],
        queryFn: async () => {
            if (!employee?.id) return [];
            const { data } = await api.get(`/goals?autoSession=true`);
            return data?.data || [];
        },
        refetchInterval: 5000,
        enabled: !!employee?.id,
    });

    // ── Tab 2: Leaderboard ─────────────────────────────────────────
    const { data: leaderboard = [] } = useQuery<LeaderboardEntry[]>({
        queryKey: ['pos-leaderboard'],
        queryFn: async () => {
            const { data } = await api.get(`/goals/leaderboard`);
            return data?.data || [];
        },
        refetchInterval: 15000,
        enabled: activeTab === 'ranking',
    });

    // ── Tab 3: History ─────────────────────────────────────────────
    const { data: historyData } = useQuery<{ goals: DailyGoal[]; totalRewards: number; totalCompleted: number }>({
        queryKey: ['pos-goals-history', employee?.id],
        queryFn: async () => {
            if (!employee?.id) return { goals: [], totalRewards: 0, totalCompleted: 0 };
            const { data } = await api.get(`/goals/history?employeeId=${employee.id}&limit=30`);
            return data?.data || { goals: [], totalRewards: 0, totalCompleted: 0 };
        },
        enabled: activeTab === 'history' && !!employee?.id,
    });

    // ── Celebration detection ──────────────────────────────────────
    useEffect(() => {
        const currentCompleted = new Set(myGoals.filter(g => g.isCompleted).map(g => g.id));
        const newlyCompleted = myGoals.find(g => g.isCompleted && !prevCompletedIds.current.has(g.id));
        if (newlyCompleted && prevCompletedIds.current.size > 0) {
            setCelebratingGoal(newlyCompleted);
            setTimeout(() => setCelebratingGoal(null), 3500);
        }
        prevCompletedIds.current = currentCompleted;
    }, [myGoals]);

    const completedGoals = myGoals.filter(g => g.isCompleted);

    const GoalIcon = ({ type }: { type: string }) => {
        if (type === 'PRODUCT') return <Package className="w-4 h-4" style={{ color: '#93B59D' }} />;
        if (type === 'CATEGORY') return <Tag className="w-4 h-4" style={{ color: '#D4A574' }} />;
        return <Wallet className="w-4 h-4" style={{ color: '#7EB8D4' }} />;
    };

    return (
        <div className="min-h-dvh flex flex-col safe-top safe-bottom" style={{ background: '#121413' }}>
            {/* ═══ Header ═══ */}
            <header className="px-4 pt-3 pb-3 flex items-center justify-between shrink-0"
                style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                <div className="flex items-center gap-3">
                    <Target className="w-5 h-5" style={{ color: '#93B59D' }} />
                    <h1 className="text-lg font-bold" style={{ color: '#F4F0EA' }}>Mis Metas</h1>
                </div>
                <button onClick={() => navigate('/')} className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(244,240,234,0.06)' }}>
                    <X className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.5)' }} />
                </button>
            </header>

            {/* ═══ Tabs ═══ */}
            <div className="flex px-4 pt-3 gap-1">
                {([
                    { key: 'goals' as Tab, label: 'Metas', count: myGoals.length },
                    { key: 'ranking' as Tab, label: 'Ranking', count: leaderboard.length },
                    { key: 'history' as Tab, label: 'Historial', count: null },
                ]).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className="flex-1 py-2.5 text-xs font-semibold tracking-wide uppercase rounded-lg transition-all"
                        style={{
                            background: activeTab === tab.key ? 'rgba(147,181,157,0.12)' : 'transparent',
                            color: activeTab === tab.key ? '#93B59D' : 'rgba(244,240,234,0.35)',
                            border: `1px solid ${activeTab === tab.key ? 'rgba(147,181,157,0.2)' : 'rgba(244,240,234,0.06)'}`,
                        }}
                    >
                        {tab.label}
                        {tab.count !== null && tab.count > 0 && (
                            <span className="ml-1.5 text-[10px] opacity-60">({tab.count})</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ═══ Content ═══ */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

                {/* ── TAB: Metas ── */}
                {activeTab === 'goals' && (
                    <>
                        {/* Summary card */}
                        <div className="rounded-xl p-4" style={{ background: 'rgba(28,64,46,0.2)', border: '1px solid rgba(147,181,157,0.1)' }}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(244,240,234,0.4)' }}>Progreso del Día</p>
                                    <p className="text-2xl font-bold font-mono mt-1" style={{ color: '#F4F0EA' }}>
                                        {completedGoals.length}<span style={{ color: 'rgba(244,240,234,0.3)' }}>/{myGoals.length}</span>
                                    </p>
                                </div>
                                <div className="w-14 h-14 rounded-full flex items-center justify-center"
                                    style={{ background: `conic-gradient(#93B59D ${myGoals.length > 0 ? (completedGoals.length / myGoals.length) * 360 : 0}deg, rgba(244,240,234,0.06) 0deg)` }}>
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#121413' }}>
                                        <span className="text-xs font-bold" style={{ color: '#93B59D' }}>
                                            {myGoals.length > 0 ? Math.round((completedGoals.length / myGoals.length) * 100) : 0}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {myGoals.length === 0 && (
                            <div className="text-center py-12">
                                <Target className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgba(244,240,234,0.1)' }} />
                                <p className="text-sm" style={{ color: 'rgba(244,240,234,0.3)' }}>No tienes metas asignadas hoy</p>
                            </div>
                        )}

                        {/* Active goals */}
                        {activeGoals.length > 0 && (
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2 flex items-center gap-1.5"
                                    style={{ color: 'rgba(147,181,157,0.6)' }}>
                                    <Clock className="w-3 h-3" /> Este Turno
                                </p>
                                <div className="space-y-2">
                                    {activeGoals.map(goal => <GoalCard key={goal.id} goal={goal} />)}
                                </div>
                            </div>
                        )}

                        {/* Completed goals */}
                        {completedGoals.length > 0 && (
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                                    style={{ color: 'rgba(244,240,234,0.25)' }}>
                                    Completadas
                                </p>
                                <div className="space-y-2">
                                    {completedGoals.map(goal => <GoalCard key={goal.id} goal={goal} />)}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ── TAB: Ranking ── */}
                {activeTab === 'ranking' && (
                    <>
                        {leaderboard.length === 0 && (
                            <div className="text-center py-12">
                                <Trophy className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgba(244,240,234,0.1)' }} />
                                <p className="text-sm" style={{ color: 'rgba(244,240,234,0.3)' }}>Sin datos de ranking hoy</p>
                            </div>
                        )}
                        <div className="space-y-3">
                            {leaderboard.map((entry, idx) => {
                                const isMe = entry.employeeId === employee?.id;
                                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                                return (
                                    <div key={entry.employeeId} className="rounded-xl p-4 transition-all"
                                        style={{
                                            background: isMe ? 'rgba(28,64,46,0.25)' : 'rgba(244,240,234,0.02)',
                                            border: `1px solid ${isMe ? 'rgba(147,181,157,0.25)' : 'rgba(244,240,234,0.04)'}`,
                                        }}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                                                    style={{
                                                        background: isMe ? 'rgba(147,181,157,0.2)' : 'rgba(244,240,234,0.06)',
                                                        color: isMe ? '#93B59D' : 'rgba(244,240,234,0.5)',
                                                    }}>
                                                    {medal || entry.employeeName.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold" style={{ color: isMe ? '#93B59D' : '#F4F0EA' }}>
                                                        {entry.employeeName} {isMe && <span className="text-[10px] opacity-50">(tú)</span>}
                                                    </p>
                                                    <p className="text-[11px]" style={{ color: 'rgba(244,240,234,0.3)' }}>
                                                        {entry.completed}/{entry.total} metas
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xl font-bold font-mono" style={{ color: '#F4F0EA' }}>
                                                    {entry.completionRate}%
                                                </span>
                                            </div>
                                        </div>
                                        {/* Mini progress bar */}
                                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(244,240,234,0.06)' }}>
                                            <div className="h-full rounded-full transition-all duration-1000"
                                                style={{
                                                    width: `${entry.completionRate}%`,
                                                    background: entry.completionRate === 100
                                                        ? 'linear-gradient(90deg, #93B59D, #7EB8D4)'
                                                        : '#93B59D',
                                                }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* ── TAB: Historial ── */}
                {activeTab === 'history' && (
                    <>
                        {/* Summary card */}
                        {historyData && (
                            <div className="rounded-xl p-4 flex items-center justify-between"
                                style={{ background: 'rgba(28,64,46,0.2)', border: '1px solid rgba(147,181,157,0.1)' }}>
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(244,240,234,0.4)' }}>
                                        Recompensas Acumuladas
                                    </p>
                                    <p className="text-2xl font-bold font-mono mt-1" style={{ color: '#93B59D' }}>
                                        ${historyData.totalRewards.toFixed(2)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs" style={{ color: 'rgba(244,240,234,0.35)' }}>Metas completadas</p>
                                    <p className="text-lg font-bold font-mono" style={{ color: '#F4F0EA' }}>
                                        {historyData.totalCompleted}
                                    </p>
                                </div>
                            </div>
                        )}

                        {historyData?.goals.length === 0 && (
                            <div className="text-center py-12">
                                <Clock className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgba(244,240,234,0.1)' }} />
                                <p className="text-sm" style={{ color: 'rgba(244,240,234,0.3)' }}>Sin historial de metas</p>
                            </div>
                        )}

                        <div className="space-y-2">
                            {historyData?.goals.map(goal => (
                                <div key={goal.id} className="rounded-lg p-3 flex items-center justify-between"
                                    style={{ background: 'rgba(244,240,234,0.02)', border: '1px solid rgba(244,240,234,0.04)' }}>
                                    <div className="flex items-center gap-3">
                                        <GoalIcon type={goal.type} />
                                        <div>
                                            <p className="text-sm font-medium" style={{ color: '#F4F0EA' }}>{goal.targetName}</p>
                                            <p className="text-[11px]" style={{ color: 'rgba(244,240,234,0.3)' }}>
                                                {goal.date} · {goal.currentQty}/{goal.targetQty}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {goal.rewardValue ? (
                                            <span className="text-sm font-bold font-mono" style={{ color: '#93B59D' }}>
                                                +${goal.rewardValue}
                                            </span>
                                        ) : (
                                            <Trophy className="w-4 h-4" style={{ color: '#93B59D' }} />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* ═══ Celebration Overlay ═══ */}
            {celebratingGoal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in"
                    style={{ background: 'rgba(0,0,0,0.85)' }}
                    onClick={() => setCelebratingGoal(null)}>
                    <div className="text-center animate-scale-in px-8">
                        <div className="text-6xl mb-4">🏆</div>
                        <h2 className="text-2xl font-bold mb-2" style={{ color: '#F4F0EA' }}>¡Meta Cumplida!</h2>
                        <p className="text-lg font-semibold mb-1" style={{ color: '#93B59D' }}>{celebratingGoal.targetName}</p>
                        <p className="text-sm mb-4" style={{ color: 'rgba(244,240,234,0.5)' }}>
                            {celebratingGoal.currentQty}/{celebratingGoal.targetQty} completados
                        </p>
                        {celebratingGoal.rewardValue && (
                            <div className="inline-block rounded-full px-5 py-2" style={{ background: 'rgba(147,181,157,0.15)' }}>
                                <span className="text-lg font-bold font-mono" style={{ color: '#93B59D' }}>
                                    +${celebratingGoal.rewardValue} {celebratingGoal.rewardNote || ''}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ═══ Goal Card Component ═══ */
function GoalCard({ goal }: { goal: DailyGoal }) {
    const pct = Math.min((goal.currentQty / goal.targetQty) * 100, 100);

    const GoalIcon = () => {
        if (goal.type === 'PRODUCT') return <Package className="w-4 h-4" style={{ color: '#93B59D' }} />;
        if (goal.type === 'CATEGORY') return <Tag className="w-4 h-4" style={{ color: '#D4A574' }} />;
        return <Wallet className="w-4 h-4" style={{ color: '#7EB8D4' }} />;
    };

    return (
        <div className="rounded-xl p-4 relative overflow-hidden transition-all"
            style={{
                background: goal.isCompleted ? 'rgba(28,64,46,0.15)' : 'rgba(244,240,234,0.02)',
                border: `1px solid ${goal.isCompleted ? 'rgba(147,181,157,0.15)' : 'rgba(244,240,234,0.04)'}`,
            }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <GoalIcon />
                    <span className="text-sm font-medium" style={{ color: goal.isCompleted ? '#93B59D' : '#F4F0EA' }}>
                        {goal.targetName}
                    </span>
                    {goal.isCompleted && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(147,181,157,0.15)', color: '#93B59D' }}>
                            ✓
                        </span>
                    )}
                </div>
                <span className="text-sm font-mono font-semibold" style={{ color: goal.isCompleted ? '#93B59D' : 'rgba(244,240,234,0.6)' }}>
                    {goal.type === 'REVENUE' ? '$' : ''}{goal.currentQty.toFixed(0)}
                    <span style={{ color: 'rgba(244,240,234,0.2)' }}> / {goal.targetQty}</span>
                </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(244,240,234,0.06)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                    style={{
                        width: `${pct}%`,
                        background: pct === 100
                            ? 'linear-gradient(90deg, #93B59D, #7EB8D4)'
                            : pct > 50
                                ? '#93B59D'
                                : 'rgba(147,181,157,0.5)',
                    }} />
            </div>

            {/* Reward info */}
            {goal.rewardValue && (
                <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: 'rgba(147,181,157,0.6)' }}>
                        <Trophy className="w-3 h-3" />
                        {goal.rewardNote || 'Bono'} (+${goal.rewardValue})
                    </span>
                    <span className="text-[10px]" style={{ color: 'rgba(244,240,234,0.2)' }}>
                        {goal.isCompleted ? 'Completada' : `${Math.round(pct)}%`}
                    </span>
                </div>
            )}
        </div>
    );
}
