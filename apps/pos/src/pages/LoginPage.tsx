import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Loader2, Delete, Zap } from 'lucide-react';

export default function LoginPage() {
    const { login, isLoading } = useAuth();
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');

    const handleNum = (n: string) => {
        if (pin.length < 4) {
            const next = pin + n;
            setPin(next);
            setError('');
            // Auto-submit on 4 digits
            if (next.length === 4) {
                setTimeout(() => handleLogin(next), 150);
            }
        }
    };

    const handleDelete = () => setPin(p => p.slice(0, -1));

    const handleLogin = async (code?: string) => {
        const p = code || pin;
        if (p.length < 4) return;
        const result = await login(p);
        if (typeof result === 'string') {
            setError(result);
            setPin('');
        } else if (!result) {
            setError('PIN incorrecto');
            setPin('');
        }
    };

    return (
        <div className="min-h-dvh bg-wave-dark flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-[320px] space-y-8">

                {/* Logo & Title */}
                <div className="text-center space-y-3 animate-fade-in">
                    <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-wave-purple/30 to-wave-purple/5 border border-wave-purple/20 flex items-center justify-center animate-glow">
                        <Zap className="w-10 h-10 text-wave-purple" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                            WAVE
                        </h1>
                        <p className="text-wave-text-muted text-sm font-medium tracking-widest uppercase mt-1">
                            Point of Sale
                        </p>
                    </div>
                </div>

                {/* PIN Display */}
                <div className="glass rounded-2xl p-6 text-center relative animate-slide-up">
                    <p className="text-wave-text-muted text-xs tracking-widest uppercase mb-3">Ingrese su PIN</p>
                    <div className="h-10 flex justify-center items-center gap-3">
                        {[0, 1, 2, 3].map(i => (
                            <div
                                key={i}
                                className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${i < pin.length
                                    ? 'bg-wave-purple scale-110 shadow-[0_0_8px_rgba(124,58,237,0.5)]'
                                    : 'bg-white/10'
                                    }`}
                            />
                        ))}
                    </div>
                    {error && (
                        <p className="text-wave-red text-xs mt-2 animate-shake font-medium">{error}</p>
                    )}
                </div>

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                        <button
                            key={n}
                            onClick={() => handleNum(n.toString())}
                            className="h-[72px] rounded-2xl bg-wave-gray hover:bg-wave-gray-light active:scale-95 transition-all text-2xl font-semibold flex items-center justify-center border border-wave-border"
                        >
                            {n}
                        </button>
                    ))}

                    <div /> {/* spacer */}

                    <button
                        onClick={() => handleNum('0')}
                        className="h-[72px] rounded-2xl bg-wave-gray hover:bg-wave-gray-light active:scale-95 transition-all text-2xl font-semibold flex items-center justify-center border border-wave-border"
                    >
                        0
                    </button>

                    <button
                        onClick={handleDelete}
                        className="h-[72px] rounded-2xl bg-wave-red/10 hover:bg-wave-red/20 active:scale-95 transition-all flex items-center justify-center border border-wave-red/10"
                    >
                        <Delete className="w-6 h-6 text-wave-red" />
                    </button>
                </div>

                {/* Loading Indicator */}
                {isLoading && (
                    <div className="flex justify-center animate-fade-in">
                        <Loader2 className="w-6 h-6 text-wave-purple animate-spin" />
                    </div>
                )}

            </div>
        </div>
    );
}
