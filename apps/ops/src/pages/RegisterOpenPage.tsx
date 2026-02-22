
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrencies } from '../hooks/useCurrencies';
import { Loader2, ArrowRight, Smartphone, Wallet } from 'lucide-react';

export default function RegisterOpenPage() {
    const { employee, openRegister } = useAuth();
    const { currencies, getRate, formatLocal } = useCurrencies();
    const [isLoading, setIsLoading] = useState(false);

    // --- Caja Fisica: USD + COP ---
    const [usd, setUsd] = useState('');
    const [cop, setCop] = useState('');

    // --- Caja Electronica: VES ---
    const [ves, setVes] = useState('');

    const copRate = getRate('COP');
    const vesRate = getRate('VES');

    const physicalUSD = parseFloat(usd) || 0;
    const physicalCOP = parseFloat(cop) || 0;
    const physicalTotal = physicalUSD + (physicalCOP / copRate);

    const electronicVES = parseFloat(ves) || 0;
    const electronicTotal = vesRate > 0 ? electronicVES / vesRate : 0;

    const isValid = physicalTotal > 0 || electronicTotal > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;

        setIsLoading(true);
        try {
            await openRegister({
                physical: {
                    startingCash: Math.round(physicalTotal * 100) / 100,
                    startingBreakdown: {
                        USD: physicalUSD,
                        COP: physicalCOP,
                        rates: { COP: copRate }
                    }
                },
                electronic: {
                    startingCash: Math.round(electronicTotal * 100) / 100,
                    startingBreakdown: {
                        VES: electronicVES,
                        rates: { VES: vesRate }
                    }
                }
            });
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    if (currencies.length === 0) {
        return (
            <div className="min-h-screen bg-enigma-black flex items-center justify-center">
                <Loader2 className="animate-spin w-6 h-6 text-white/30" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-enigma-black flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-2xl space-y-6">

                <div className="text-center">
                    <h1 className="text-2xl font-bold text-white">Apertura de Turno</h1>
                    <p className="text-white/40 text-sm mt-1">Hola, {employee?.name} — Declara el fondo inicial de ambas cajas</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                        {/* ═══ CAJA FISICA ═══ */}
                        <div className="bg-white/5 rounded-2xl border border-white/10 p-5 space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                    <Wallet className="w-4 h-4 text-amber-400" />
                                </div>
                                <div>
                                    <p className="font-semibold text-white text-sm">Caja Fisica</p>
                                    <p className="text-xs text-white/30">Billetes USD y Pesos COP</p>
                                </div>
                            </div>

                            {/* USD */}
                            <div className="space-y-1">
                                <label className="text-xs text-white/50">Dolares USD</label>
                                <div className="flex items-center border border-white/10 rounded-xl overflow-hidden focus-within:border-amber-500/40">
                                    <span className="px-3 text-white/40 text-sm font-mono bg-white/5 py-3 border-r border-white/10">$</span>
                                    <input
                                        type="number" inputMode="decimal" step="0.01" min="0"
                                        placeholder="0.00"
                                        value={usd}
                                        onChange={e => setUsd(e.target.value)}
                                        className="flex-1 bg-transparent text-white text-sm font-mono px-3 py-3 focus:outline-none placeholder:text-white/20"
                                    />
                                </div>
                            </div>

                            {/* COP */}
                            <div className="space-y-1">
                                <label className="text-xs text-white/50">Pesos Colombianos (COP)</label>
                                <div className="flex items-center border border-white/10 rounded-xl overflow-hidden focus-within:border-amber-500/40">
                                    <span className="px-3 text-white/40 text-sm font-mono bg-white/5 py-3 border-r border-white/10">$</span>
                                    <input
                                        type="number" inputMode="decimal" min="0"
                                        placeholder="0"
                                        value={cop}
                                        onChange={e => setCop(e.target.value)}
                                        className="flex-1 bg-transparent text-white text-sm font-mono px-3 py-3 focus:outline-none placeholder:text-white/20"
                                    />
                                </div>
                                {physicalCOP > 0 && (
                                    <p className="text-xs text-white/30 pl-1 font-mono">
                                        = ${(physicalCOP / copRate).toFixed(2)} USD (tasa: {copRate.toLocaleString()} COP/$1)
                                    </p>
                                )}
                            </div>

                            {/* Total fisica */}
                            <div className="border-t border-white/10 pt-3 flex justify-between items-center">
                                <span className="text-xs text-white/40">Total Fisica</span>
                                <span className="font-mono font-bold text-amber-400">${physicalTotal.toFixed(2)} USD</span>
                            </div>
                        </div>

                        {/* ═══ CAJA ELECTRONICA ═══ */}
                        <div className="bg-white/5 rounded-2xl border border-white/10 p-5 space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                    <Smartphone className="w-4 h-4 text-blue-400" />
                                </div>
                                <div>
                                    <p className="font-semibold text-white text-sm">Caja Electronica</p>
                                    <p className="text-xs text-white/30">Cuenta digital — Bolivares VES</p>
                                </div>
                            </div>

                            {/* VES */}
                            <div className="space-y-1">
                                <label className="text-xs text-white/50">Bolivares (VES)</label>
                                <div className="flex items-center border border-white/10 rounded-xl overflow-hidden focus-within:border-blue-500/40">
                                    <span className="px-3 text-white/40 text-sm font-mono bg-white/5 py-3 border-r border-white/10">Bs.</span>
                                    <input
                                        type="number" inputMode="decimal" min="0"
                                        placeholder="0.00"
                                        value={ves}
                                        onChange={e => setVes(e.target.value)}
                                        className="flex-1 bg-transparent text-white text-sm font-mono px-3 py-3 focus:outline-none placeholder:text-white/20"
                                    />
                                </div>
                                {electronicVES > 0 && (
                                    <p className="text-xs text-white/30 pl-1 font-mono">
                                        = ${electronicTotal.toFixed(2)} USD (tasa: {vesRate} Bs./$1)
                                    </p>
                                )}
                            </div>

                            <div className="border-t border-white/10 pt-3 flex justify-between items-center">
                                <span className="text-xs text-white/40">Total Electronica</span>
                                <span className="font-mono font-bold text-blue-400">${electronicTotal.toFixed(2)} USD</span>
                            </div>
                        </div>
                    </div>

                    {/* Total global */}
                    <div className="bg-white/5 rounded-xl border border-white/10 px-5 py-3 flex justify-between items-center">
                        <span className="text-sm text-white/60">Fondo Total del Turno</span>
                        <span className="font-mono font-bold text-white text-lg">${(physicalTotal + electronicTotal).toFixed(2)} USD</span>
                    </div>

                    <button
                        type="submit"
                        disabled={!isValid || isLoading}
                        className="w-full h-12 bg-enigma-green text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-enigma-green/90 transition-colors disabled:opacity-50"
                    >
                        {isLoading
                            ? <Loader2 className="animate-spin w-5 h-5" />
                            : <>Abrir Turno <ArrowRight className="w-5 h-5" /></>
                        }
                    </button>
                </form>

                <p className="text-xs text-center text-white/20">
                    Asegurese de contar el efectivo fisicamente antes de continuar.
                </p>
            </div>
        </div>
    );
}
