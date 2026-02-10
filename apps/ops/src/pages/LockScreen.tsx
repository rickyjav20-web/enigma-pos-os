
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Loader2, Delete, Lock, LogIn } from 'lucide-react';

export default function LockScreen() {
    const { login } = useAuth();
    const [pin, setPin] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleNumberParams = (num: string) => {
        if (pin.length < 4) {
            setPin(prev => prev + num);
            setError('');
        }
    };

    const handleDelete = () => {
        setPin(prev => prev.slice(0, -1));
    };

    const handleLogin = async () => {
        if (pin.length < 4) return;

        setIsLoading(true);
        const result = await login(pin);
        setIsLoading(false);

        if (typeof result === 'string') {
            // Role-based access denial message
            setError(result);
            setPin('');
        } else if (!result) {
            setError('PIN Incorrecto');
            setPin('');
        }
    };

    return (
        <div className="min-h-screen bg-enigma-black flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm space-y-8">

                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-enigma-purple/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse-slow">
                        <Lock className="w-8 h-8 text-enigma-purple" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">Enigma Ops</h1>
                    <p className="text-white/40">Ingrese su PIN de empleado</p>
                </div>

                {/* PIN Display */}
                <div className="bg-enigma-gray/50 rounded-2xl p-6 border border-white/5 text-center relative">
                    <div className="h-10 text-3xl font-mono tracking-[0.5em] text-white flex justify-center items-center">
                        {pin.split('').map((_, i) => (
                            <span key={i} className="animate-fade-in mx-1">•</span>
                        ))}
                    </div>
                    {error && (
                        <p className="text-red-400 text-xs absolute bottom-2 left-0 right-0 animate-shake">
                            {error}
                        </p>
                    )}
                </div>

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button
                            key={num}
                            onClick={() => handleNumberParams(num.toString())}
                            className="h-20 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all
                                text-2xl font-medium flex items-center justify-center border border-white/5 shadow-lg"
                        >
                            {num}
                        </button>
                    ))}

                    <button className="h-20 flex items-center justify-center text-white/20" disabled>
                        {/* Spacer */}
                    </button>

                    <button
                        onClick={() => handleNumberParams('0')}
                        className="h-20 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all
                            text-2xl font-medium flex items-center justify-center border border-white/5 shadow-lg"
                    >
                        0
                    </button>

                    <button
                        onClick={handleDelete}
                        className="h-20 rounded-2xl bg-red-500/10 hover:bg-red-500/20 active:scale-95 transition-all
                            flex items-center justify-center border border-red-500/10"
                    >
                        <Delete className="w-6 h-6 text-red-400" />
                    </button>
                </div>

                <button
                    onClick={handleLogin}
                    disabled={pin.length < 4 || isLoading}
                    className="w-full h-14 bg-enigma-purple hover:bg-enigma-purple/80 disabled:opacity-50 disabled:cursor-not-allowed
                        rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all"
                >
                    {isLoading ? <Loader2 className="animate-spin" /> : <>Ingresar <LogIn className="w-5 h-5" /></>}
                </button>

            </div>
        </div>
    );
}
