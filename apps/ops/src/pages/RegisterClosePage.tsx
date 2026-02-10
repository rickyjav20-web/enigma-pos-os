
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2, DollarSign, CreditCard, ArrowRight, CheckCircle, Calculator } from 'lucide-react';

export default function RegisterClosePage() {
    const { session, closeRegister } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    // Steps: 'count' (Blind) -> 'review' (Audit)
    const [step, setStep] = useState<'count' | 'review'>('count');

    // Audit Data (Fetched internally, hidden from user in step 1)
    const [auditData, setAuditData] = useState<any>(null);

    // Form State (User Declaration)
    const [cash, setCash] = useState('');
    const [card, setCard] = useState('');
    const [transfer, setTransfer] = useState('');
    const [notes, setNotes] = useState('');

    // Load Audit Data
    useEffect(() => {
        if (session?.id) {
            fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1'}/register/audit/${session.id}`)
                .then(res => res.json())
                .then(data => setAuditData(data))
                .catch(err => console.error("Failed to load audit", err));
        }
    }, [session]);

    const handleNext = () => {
        if (!cash) return; // Force at least cash input
        setStep('review');
    };

    const handleCloseRegister = async () => {
        setIsLoading(true);
        try {
            await closeRegister({
                declaredCash: parseFloat(cash) || 0,
                declaredCard: parseFloat(card) || 0,
                declaredTransfer: parseFloat(transfer) || 0,
                notes
            });
            navigate('/');
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!session) return null;

    return (
        <div className="min-h-screen bg-enigma-black flex flex-col items-center justify-center p-6 text-white animate-fade-in relative overflow-hidden">

            {/* Background Ambience */}
            <div className={`absolute inset-0 transition-opacity duration-1000 ${step === 'review' ? 'opacity-30' : 'opacity-10'}`}>
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-enigma-purple/20 blur-[120px] rounded-full mix-blend-screen" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full mix-blend-screen" />
            </div>

            <div className="w-full max-w-md z-10 space-y-6">

                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                        {step === 'count' ? 'Cierre de Caja' : 'Auditoría de Cierre'}
                    </h1>
                    <p className="text-white/50">
                        {step === 'count'
                            ? 'Cuenta el dinero físico antes de ver lo esperado.'
                            : 'Compara tu conteo con el sistema.'}
                    </p>
                </div>

                {/* STEP 1: BLIND COUNT */}
                {step === 'count' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-enigma-gray/50 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl space-y-5">
                            <InputGroup
                                label="Efectivo en Caja (Billetes + Monedas)"
                                icon={DollarSign}
                                value={cash}
                                onChange={setCash}
                                autoFocus
                            />
                            <InputGroup
                                label="Voucher Tarjetas (Sumatoria)"
                                icon={CreditCard}
                                value={card}
                                onChange={setCard}
                            />
                            <InputGroup
                                label="Transferencias (Capturas/Confirmaciones)"
                                icon={ArrowRight}
                                value={transfer}
                                onChange={setTransfer}
                            />
                        </div>

                        <button
                            onClick={handleNext}
                            disabled={!cash}
                            className="w-full py-4 rounded-2xl bg-enigma-purple font-bold text-lg shadow-lg shadow-enigma-purple/20
                                hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                        >
                            <Calculator className="w-5 h-5" />
                            Comparar con Sistema
                        </button>
                    </div>
                )}

                {/* STEP 2: REVIEW & AUDIT */}
                {step === 'review' && auditData && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Audit Card */}
                        <div className="bg-enigma-gray/50 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
                            {/* Summary Header */}
                            <div className="p-6 border-b border-white/5 bg-white/5">
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-white/50 text-sm">Efectivo Esperado (Sistema)</span>
                                    <span className="text-2xl font-mono font-bold">${auditData.expectedCash.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <span className="text-white/50 text-sm">Tu Conteo (Declarado)</span>
                                    <span className={`text-2xl font-mono font-bold ${Math.abs(parseFloat(cash) - auditData.expectedCash) < 0.5 ? 'text-emerald-400' : 'text-amber-400'
                                        }`}>
                                        ${parseFloat(cash).toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* Detailed Breakdown */}
                            <div className="p-6 space-y-3 text-sm">
                                <div className="flex justify-between text-white/60">
                                    <span>Fondo Inicial</span>
                                    <span>${auditData.startingCash.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-white/60">
                                    <span>Movimientos (Ventas/Gastos)</span>
                                    <span className={auditData.transactionsTotal < 0 ? 'text-red-300' : 'text-emerald-300'}>
                                        {auditData.transactionsTotal > 0 ? '+' : ''}{auditData.transactionsTotal.toFixed(2)}
                                    </span>
                                </div>
                                <div className="h-px bg-white/10 my-2" />
                                <div className="flex justify-between items-center font-medium">
                                    <span>Diferencia</span>
                                    <span className={`px-2 py-1 rounded-lg ${Math.abs(parseFloat(cash) - auditData.expectedCash) < 0.5
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-red-500/20 text-red-400'
                                        }`}>
                                        {(parseFloat(cash) - auditData.expectedCash).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="bg-enigma-gray/30 p-4 rounded-2xl border border-white/5">
                            <label className="text-xs text-white/50 mb-2 block">Notas de Cierre / Justificación</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm h-20 focus:border-enigma-purple outline-none resize-none"
                                placeholder="Si hay diferencia, explica aquí..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setStep('count')}
                                className="py-4 rounded-2xl bg-white/5 font-medium hover:bg-white/10 transition-colors"
                            >
                                Recontar
                            </button>
                            <button
                                onClick={handleCloseRegister}
                                disabled={isLoading}
                                className="py-4 rounded-2xl bg-enigma-purple font-bold shadow-lg shadow-enigma-purple/20
                                    hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                                Confirmar Cierre
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function InputGroup({ label, icon: Icon, value, onChange, autoFocus }: any) {
    return (
        <div>
            <label className="text-xs text-white/50 mb-1.5 block ml-1">{label}</label>
            <div className="relative group">
                <Icon className="absolute left-4 top-4 w-5 h-5 text-white/30 group-focus-within:text-enigma-purple transition-colors" />
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 pl-12 text-xl font-mono text-white 
                        focus:border-enigma-purple focus:ring-1 focus:ring-enigma-purple/50 outline-none transition-all"
                    placeholder="0.00"
                    autoFocus={autoFocus}
                />
            </div>
        </div>
    );
}
