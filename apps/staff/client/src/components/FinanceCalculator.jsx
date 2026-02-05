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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] animate-fade-in">
            <div className="bg-enigma-black w-full max-w-sm rounded-xl border border-white/10 shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-green-400" />
                        Calculadora de Pagos
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-white/50" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs uppercase text-white/40 mb-1">Monto Base (USD)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-3 text-white/50 font-bold">$</span>
                            <input
                                type="number"
                                value={amountUSD}
                                onChange={(e) => setAmountUSD(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 pl-8 text-white font-mono text-lg focus:border-green-400 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs uppercase text-white/40 mb-1">Tasa de Cambio (Bs/$)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-3 text-white/50 font-bold">Bs</span>
                            <input
                                type="number"
                                value={exchangeRate}
                                onChange={(e) => setExchangeRate(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 pl-10 text-white font-mono text-lg focus:border-green-400 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex items-center justify-between">
                        <div className="text-right w-full">
                            <span className="block text-xs text-white/40 uppercase mb-1">Total a Pagar</span>
                            <span className="text-2xl font-bold text-green-400 font-mono">Vs {amountVES}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-6">
                    <button
                        onClick={() => onApply && onApply(amountVES)}
                        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <Wallet className="w-4 h-4" />
                        Copiar Monto
                    </button>
                    <p className="text-[10px] text-white/30 text-center mt-3">
                        Útil para transferencias en Bolívares.
                    </p>
                </div>
            </div>
        </div>
    );
}
