
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Loader2, DollarSign, ArrowRight } from 'lucide-react';

export default function RegisterOpenPage() {
    const { employee, openRegister } = useAuth();
    const [amount, setAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount)) return;

        setIsLoading(true);
        try {
            await openRegister(numAmount);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-enigma-black flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm space-y-6">

                <div className="text-center">
                    <h1 className="text-2xl font-bold">Apertura de Caja</h1>
                    <p className="text-white/40">Hola, {employee?.name}</p>
                </div>

                <div className="bg-enigma-gray/30 p-6 rounded-2xl border border-white/5 space-y-4">
                    <p className="text-sm text-white/70 text-center">
                        Ingrese el monto de efectivo inicial (Caja base)
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="relative">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-enigma-green w-5 h-5" />
                            <input
                                type="number"
                                step="0.01"
                                autoFocus
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full h-14 bg-black/50 border border-white/10 rounded-xl px-12 text-xl font-mono text-white placeholder-white/20 focus:outline-none focus:border-enigma-green transition-colors"
                                placeholder="0.00"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={!amount || isLoading}
                            className="w-full h-12 bg-enigma-green text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-enigma-green/90 transition-colors disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <>Abrir Caja <ArrowRight className="w-5 h-5" /></>}
                        </button>
                    </form>
                </div>

                <p className="text-xs text-center text-white/20">
                    Asegúrese de contar el efectivo físicamente.
                </p>

            </div>
        </div>
    );
}
