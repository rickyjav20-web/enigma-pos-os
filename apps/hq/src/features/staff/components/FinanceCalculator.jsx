import React, { useState, useEffect } from 'react';
import { Calculator, X, ArrowRight, Wallet } from 'lucide-react';

export default function FinanceCalculator({ baseAmount, onClose, onApply }) {
    const [amountUSD, setAmountUSD] = useState(baseAmount || '');
    const [exchangeRate, setExchangeRate] = useState(65.00); // Default or fetch from somewhere
    const [amountVES, setAmountVES] = useState('');

    useEffect(() => {
        if (amountUSD && exchangeRate) {
            const calculated = (parseFloat(amountUSD) * parseFloat(exchangeRate)).toFixed(2);
            setAmountVES(calculated);
        } else {
            setAmountVES('');
        }
    }, [amountUSD, exchangeRate]);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] animate-fade-in">
            <div className="glass-card w-full max-w-sm rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/20 blur-[60px] rounded-full pointer-events-none -z-10" />

                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-green-400" />
                        Quick Converter
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors group">
                        <X className="w-5 h-5 text-white/50 group-hover:text-white transition-colors" />
                    </button>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-xs uppercase text-enigma-text-muted font-bold tracking-widest mb-2">Base Amount (USD)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-3.5 text-white/50 font-bold">$</span>
                            <input
                                type="number"
                                value={amountUSD}
                                onChange={(e) => setAmountUSD(e.target.value)}
                                className="glass-input w-full rounded-xl p-3 pl-10 text-white font-mono text-lg focus:outline-none focus:border-green-500 transition-colors font-bold"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs uppercase text-enigma-text-muted font-bold tracking-widest mb-2">Exchange Rate (Bs/$)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-3.5 text-white/50 font-bold">Bs</span>
                            <input
                                type="number"
                                value={exchangeRate}
                                onChange={(e) => setExchangeRate(e.target.value)}
                                className="glass-input w-full rounded-xl p-3 pl-12 text-white font-mono text-lg focus:outline-none focus:border-green-500 transition-colors font-bold"
                            />
                        </div>
                    </div>

                    <div className="bg-green-500/10 rounded-2xl p-6 border border-green-500/20 flex flex-col items-end justify-center shadow-[inset_0_0_20px_rgba(0,0,0,0.2)]">
                        <span className="block text-xs text-green-400/70 uppercase font-bold tracking-widest mb-1">Total Payable</span>
                        <span className="text-3xl font-bold text-green-400 font-mono tracking-tight text-glow-green">Bs {amountVES || '0.00'}</span>
                    </div>
                </div>

                <div className="mt-8">
                    <button
                        onClick={() => onApply && onApply(amountVES)}
                        className="w-full bg-enigma-green hover:bg-enigma-green-glow text-black font-bold py-4 rounded-xl transition-all shadow-lg shadow-enigma-green/20 flex items-center justify-center gap-2 transform active:scale-[0.98]"
                    >
                        <Wallet className="w-5 h-5" />
                        Copy Amount
                    </button>
                    <p className="text-[10px] text-white/30 text-center mt-4">
                        Useful for bank transfers in Bolívares.
                    </p>
                </div>
            </div>
        </div>
    );
}
