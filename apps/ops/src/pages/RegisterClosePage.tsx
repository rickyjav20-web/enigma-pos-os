
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrencies } from '../hooks/useCurrencies';
import { Loader2, CheckCircle, Calculator, Wallet, Smartphone, ArrowRight } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

type Step = 'physical' | 'electronic' | 'review';

export default function RegisterClosePage() {
    const { session, electronicSession, closeRegister } = useAuth();
    const { getRate } = useCurrencies();
    const [step, setStep] = useState<Step>('physical');
    const [isLoading, setIsLoading] = useState(false);

    const [physAudit, setPhysAudit] = useState<any>(null);
    const [elecAudit, setElecAudit] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    // Physical fields
    const [physUSD, setPhysUSD] = useState('');
    const [physCOP, setPhysCOP] = useState('');

    // Electronic fields
    const [elecVES, setElecVES] = useState('');

    // Notes
    const [notes, setNotes] = useState('');

    const copRate = getRate('COP');
    const vesRate = getRate('VES');

    const physTotalUSD = (parseFloat(physUSD) || 0) + ((parseFloat(physCOP) || 0) / copRate);
    const elecTotalUSD = vesRate > 0 ? (parseFloat(elecVES) || 0) / vesRate : 0;

    useEffect(() => {
        if (session?.id) {
            fetch(`${API_URL}/register/audit/${session.id}`, { headers: { 'x-tenant-id': 'enigma_hq' } })
                .then(r => r.json()).then(setPhysAudit).catch(console.error);
        }
        if (electronicSession?.id) {
            fetch(`${API_URL}/register/audit/${electronicSession.id}`, { headers: { 'x-tenant-id': 'enigma_hq' } })
                .then(r => r.json()).then(setElecAudit).catch(console.error);
        }
    }, [session, electronicSession]);

    const handleConfirmClose = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await closeRegister({
                physical: {
                    declaredCash: Math.round(physTotalUSD * 100) / 100,
                    declaredCard: 0,
                    declaredTransfer: 0,
                    declaredBreakdown: {
                        USD: { amount: parseFloat(physUSD) || 0, rate: 1, usdEquiv: parseFloat(physUSD) || 0 },
                        COP: { amount: parseFloat(physCOP) || 0, rate: copRate, usdEquiv: (parseFloat(physCOP) || 0) / copRate }
                    },
                    notes
                },
                electronic: {
                    declaredCash: Math.round(elecTotalUSD * 100) / 100,
                    declaredCard: 0,
                    declaredTransfer: 0,
                    declaredBreakdown: {
                        VES: { amount: parseFloat(elecVES) || 0, rate: vesRate, usdEquiv: elecTotalUSD }
                    },
                    notes
                }
            });
            // closeRegister calls logout() which triggers LockScreen — show brief success first
            setDone(true);
        } catch (err: any) {
            const msg = err?.message || 'Error al cerrar la caja. Intenta de nuevo.';
            setError(msg);
            console.error('[RegisterClose] Error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fmt = (n: number) => `$${n.toFixed(2)}`;

    // Success screen (shown briefly before logout() triggers LockScreen)
    if (done) {
        return (
            <div className="min-h-screen bg-enigma-black flex flex-col items-center justify-center p-6 text-white">
                <CheckCircle className="w-20 h-20 text-emerald-400 mb-6" />
                <h2 className="text-2xl font-bold text-emerald-400 mb-2">Turno Cerrado</h2>
                <p className="text-white/50 text-sm text-center">Las cajas han sido cerradas correctamente.<br />Hasta luego.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-enigma-black flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-enigma-purple/20 blur-[120px] rounded-full" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full" />
            </div>

            <div className="w-full max-w-md z-10 space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-white">Cierre de Turno</h1>
                    <p className="text-white/50 text-sm">
                        {step === 'physical' && 'Paso 1 de 3 — Caja Fisica'}
                        {step === 'electronic' && 'Paso 2 de 3 — Caja Electronica'}
                        {step === 'review' && 'Paso 3 de 3 — Auditoria Final'}
                    </p>

                    {/* Step indicator */}
                    <div className="flex items-center justify-center gap-2 pt-1">
                        {(['physical', 'electronic', 'review'] as Step[]).map((s, i) => (
                            <div key={s} className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full transition-all ${step === s ? 'bg-enigma-purple w-6' : (
                                    ['physical', 'electronic', 'review'].indexOf(step) > i
                                        ? 'bg-enigma-purple/60' : 'bg-white/20'
                                )}`} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* ═══ PASO 1: CAJA FISICA ═══ */}
                {step === 'physical' && (
                    <div className="space-y-5 animate-fade-in">
                        <div className="flex items-center gap-2 px-1">
                            <Wallet className="w-4 h-4 text-amber-400" />
                            <span className="text-sm font-medium text-amber-300">Caja Fisica — USD y COP</span>
                        </div>

                        <div className="bg-enigma-gray/50 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl space-y-5">
                            {/* USD */}
                            <div>
                                <label className="text-xs text-white/50 mb-1.5 block ml-1">Dolares en caja (USD)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-4 text-white/30 font-mono text-sm">$</span>
                                    <input type="number" value={physUSD} onChange={e => setPhysUSD(e.target.value)} autoFocus
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 pl-10 text-xl font-mono text-white focus:border-amber-500/50 outline-none"
                                        placeholder="0.00" />
                                </div>
                            </div>

                            {/* COP */}
                            <div>
                                <label className="text-xs text-white/50 mb-1.5 block ml-1">Pesos colombianos en caja (COP)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-4 text-white/30 font-mono text-sm">$</span>
                                    <input type="number" value={physCOP} onChange={e => setPhysCOP(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 pl-10 text-xl font-mono text-white focus:border-amber-500/50 outline-none"
                                        placeholder="0" />
                                </div>
                                {parseFloat(physCOP) > 0 && (
                                    <p className="text-xs text-white/30 mt-1 pl-1 font-mono">
                                        = ${((parseFloat(physCOP) || 0) / copRate).toFixed(2)} USD (tasa {copRate.toLocaleString()} COP/$1)
                                    </p>
                                )}
                            </div>

                            {/* Total */}
                            <div className="border-t border-white/10 pt-4 flex justify-between items-center">
                                <span className="text-sm text-white/50">Total Caja Fisica</span>
                                <span className="font-mono font-bold text-amber-300 text-lg">{fmt(physTotalUSD)}</span>
                            </div>
                        </div>

                        <button onClick={() => setStep('electronic')}
                            className="w-full py-4 rounded-2xl bg-enigma-purple font-bold text-lg shadow-lg shadow-enigma-purple/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                            <ArrowRight className="w-5 h-5" />
                            Siguiente — Caja Electronica
                        </button>
                    </div>
                )}

                {/* ═══ PASO 2: CAJA ELECTRONICA ═══ */}
                {step === 'electronic' && (
                    <div className="space-y-5 animate-fade-in">
                        <div className="flex items-center gap-2 px-1">
                            <Smartphone className="w-4 h-4 text-blue-400" />
                            <span className="text-sm font-medium text-blue-300">Caja Electronica — Bolivares VES</span>
                        </div>

                        <div className="bg-enigma-gray/50 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl space-y-5">
                            <div>
                                <label className="text-xs text-white/50 mb-1.5 block ml-1">Saldo en cuenta digital (VES)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-4 text-white/30 font-mono text-xs">Bs.</span>
                                    <input type="number" value={elecVES} onChange={e => setElecVES(e.target.value)} autoFocus
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 pl-14 text-xl font-mono text-white focus:border-blue-500/50 outline-none"
                                        placeholder="0.00" />
                                </div>
                                {parseFloat(elecVES) > 0 && (
                                    <p className="text-xs text-white/30 mt-1 pl-1 font-mono">
                                        = {fmt(elecTotalUSD)} USD (tasa {vesRate} Bs./$1)
                                    </p>
                                )}
                            </div>

                            <div className="border-t border-white/10 pt-4 flex justify-between items-center">
                                <span className="text-sm text-white/50">Total Caja Electronica</span>
                                <span className="font-mono font-bold text-blue-300 text-lg">{fmt(elecTotalUSD)}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setStep('physical')}
                                className="py-4 rounded-2xl bg-white/5 font-medium hover:bg-white/10 transition-colors">
                                Atras
                            </button>
                            <button onClick={() => setStep('review')}
                                className="py-4 rounded-2xl bg-enigma-purple font-bold shadow-lg shadow-enigma-purple/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                <Calculator className="w-5 h-5" />
                                Ver Auditoria
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ PASO 3: AUDITORIA ═══ */}
                {step === 'review' && (
                    <div className="space-y-4 animate-fade-in">
                        {/* Caja Fisica Audit */}
                        {physAudit && (
                            <AuditCard
                                title="Caja Fisica"
                                icon={<Wallet className="w-4 h-4 text-amber-400" />}
                                expected={physAudit.expectedCash}
                                declared={physTotalUSD}
                                color="amber"
                                detail={[
                                    { label: 'Dolares', value: `$${physUSD || '0.00'}` },
                                    { label: 'Pesos COP', value: `$${physCOP || '0'} ≈ $${((parseFloat(physCOP) || 0) / copRate).toFixed(2)}` }
                                ]}
                            />
                        )}

                        {/* Caja Electronica Audit */}
                        {elecAudit && (
                            <AuditCard
                                title="Caja Electronica"
                                icon={<Smartphone className="w-4 h-4 text-blue-400" />}
                                expected={elecAudit.expectedCash}
                                declared={elecTotalUSD}
                                color="blue"
                                detail={[
                                    { label: 'Bolivares VES', value: `Bs. ${elecVES || '0'} = ${fmt(elecTotalUSD)}` }
                                ]}
                            />
                        )}

                        {/* Combined total */}
                        <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-white/60 font-medium">Total Turno (USD)</span>
                                <span className="font-mono font-bold text-white text-xl">
                                    {fmt(physTotalUSD + elecTotalUSD)}
                                </span>
                            </div>
                            {(physAudit || elecAudit) && (
                                <div className="flex justify-between items-center mt-1">
                                    <span className="text-xs text-white/40">Diferencia Global</span>
                                    <DiffBadge
                                        diff={(physTotalUSD + elecTotalUSD) - ((physAudit?.expectedCash || 0) + (elecAudit?.expectedCash || 0))}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        <div className="bg-enigma-gray/30 p-4 rounded-2xl border border-white/5">
                            <label className="text-xs text-white/50 mb-2 block">Notas de Cierre (Opcional)</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm h-16 focus:border-enigma-purple outline-none resize-none"
                                placeholder="Si hay diferencias, explica aqui..." />
                        </div>

                        {/* Error display */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-sm text-red-400">
                                <p className="font-semibold mb-1">Error al cerrar la caja</p>
                                <p className="text-red-300/80 font-mono text-xs">{error}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => { setStep('electronic'); setError(null); }}
                                className="py-4 rounded-2xl bg-white/5 font-medium hover:bg-white/10 transition-colors">
                                Recontar
                            </button>
                            <button onClick={handleConfirmClose} disabled={isLoading}
                                className="py-4 rounded-2xl bg-enigma-purple font-bold shadow-lg shadow-enigma-purple/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:scale-100">
                                {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                                {isLoading ? 'Cerrando...' : 'Confirmar Cierre'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function AuditCard({ title, icon, expected, declared, color, detail }: {
    title: string; icon: React.ReactNode; expected: number; declared: number;
    color: 'amber' | 'blue'; detail: { label: string; value: string }[];
}) {
    const diff = declared - expected;
    const isOk = Math.abs(diff) < 0.5;
    const colorMap = {
        amber: { border: 'border-amber-500/20', bg: 'bg-amber-500/5' },
        blue: { border: 'border-blue-500/20', bg: 'bg-blue-500/5' }
    };

    return (
        <div className={`rounded-2xl border ${colorMap[color].border} ${colorMap[color].bg} p-4 space-y-3`}>
            <div className="flex items-center gap-2">
                {icon}
                <span className="text-sm font-semibold text-white">{title}</span>
            </div>
            <div className="space-y-1.5 text-sm">
                {detail.map(d => (
                    <div key={d.label} className="flex justify-between text-white/50">
                        <span>{d.label}</span>
                        <span className="font-mono text-white/70">{d.value}</span>
                    </div>
                ))}
                <div className="border-t border-white/10 pt-2 grid grid-cols-2 gap-2">
                    <div>
                        <p className="text-xs text-white/40">Esperado</p>
                        <p className="font-mono font-bold text-white/70">${expected.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-white/40">Declarado</p>
                        <p className={`font-mono font-bold ${isOk ? 'text-emerald-400' : 'text-amber-400'}`}>${declared.toFixed(2)}</p>
                    </div>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-xs text-white/40">Diferencia</span>
                    <DiffBadge diff={diff} />
                </div>
            </div>
        </div>
    );
}

function DiffBadge({ diff }: { diff: number }) {
    const isOk = Math.abs(diff) < 0.5;
    return (
        <span className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold ${isOk ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {diff > 0 ? '+' : ''}{diff.toFixed(2)}
        </span>
    );
}
