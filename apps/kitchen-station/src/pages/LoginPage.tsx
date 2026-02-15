import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Delete, Lock, Asterisk } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleIdx = (num: number) => {
        if (pin.length < 6) {
            setPin(prev => prev + num);
            setError('');
        }
    };

    const handleClear = () => {
        setPin(prev => prev.slice(0, -1));
    };

    const handleSubmit = async () => {
        if (pin.length < 4) return;
        setLoading(true);
        setError('');

        try {
            const res = await api.post('/auth/employee-login', { pin });
            if (res.data.employee) {
                login(res.data.employee);
                navigate('/production');
            } else {
                setError('Credenciales inválidas');
            }
        } catch (e: any) {
            console.error(e);
            setError('PIN Incorrecto');
        } finally {
            setLoading(false);
            setPin('');
        }
    };

    return (
        <div className="h-screen bg-black flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4 border border-zinc-700">
                        <Lock className="text-emerald-500" size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Kitchen Station</h1>
                    <p className="text-zinc-500">Ingrese su PIN personal</p>
                </div>

                {/* PIN DISPLAY */}
                <div className="flex justify-center gap-4 mb-8 h-12">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className={`w-4 h-4 rounded-full transition-all duration-300 ${i < pin.length ? 'bg-emerald-500 scale-125 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-zinc-800'}`} />
                    ))}
                </div>

                {error && <p className="text-red-500 text-center mb-4 text-sm font-bold animate-pulse">{error}</p>}

                {/* NUMPAD */}
                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button
                            key={num}
                            onClick={() => handleIdx(num)}
                            className="h-16 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-xl text-2xl font-bold text-white transition-colors"
                        >
                            {num}
                        </button>
                    ))}
                    <div />
                    <button
                        onClick={() => handleIdx(0)}
                        className="h-16 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-xl text-2xl font-bold text-white transition-colors"
                    >
                        0
                    </button>
                    <button
                        onClick={handleClear}
                        className="h-16 bg-zinc-800/50 hover:bg-red-900/20 active:bg-red-900/40 rounded-xl flex items-center justify-center text-zinc-400 hover:text-red-400 transition-colors"
                    >
                        <Delete size={24} />
                    </button>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={loading || pin.length < 4}
                    className="w-full mt-8 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold text-lg shadow-lg hover:shadow-emerald-500/20 transition-all"
                >
                    {loading ? 'Verificando...' : 'Entrar'}
                </button>
            </div>
        </div>
    );
}
