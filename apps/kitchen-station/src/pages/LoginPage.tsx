import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Delete, Lock, ShieldAlert } from 'lucide-react';
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
                const permissions = res.data.permissions;
                if (permissions && permissions.canAccessKitchen === false) {
                    setError('⛔ No tienes acceso a Kitchen Station');
                    setLoading(false);
                    setPin('');
                    return;
                }

                login({
                    ...res.data.employee,
                    permissions
                });

                try {
                    await api.post('/kitchen/activity', {
                        employeeId: res.data.employee.id,
                        employeeName: res.data.employee.name,
                        action: 'LOGIN'
                    });
                } catch (logErr) {
                    console.warn('Failed to log login activity:', logErr);
                }

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
        <div className="h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-sm glass-card rounded-2xl p-8 shadow-2xl">
                <div className="flex flex-col items-center mb-8">
                    <div className="relative w-14 h-14 flex items-center justify-center mb-4">
                        <div className="absolute inset-0 bg-violet-500/20 rounded-2xl blur-xl" />
                        <div className="relative bg-gradient-to-br from-white/10 to-transparent border border-white/10 rounded-2xl w-full h-full flex items-center justify-center backdrop-blur-md">
                            <Lock className="text-violet-400" size={24} />
                        </div>
                    </div>
                    <h1 className="text-xl font-bold text-white tracking-tight">Kitchen Station</h1>
                    <p className="text-zinc-500 text-sm">Ingrese su PIN personal</p>
                </div>

                {/* PIN DISPLAY */}
                <div className="flex justify-center gap-4 mb-8 h-8">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${i < pin.length
                                ? 'bg-violet-500 scale-125 shadow-[0_0_10px_rgba(139,92,246,0.5)]'
                                : 'bg-white/10 border border-white/10'
                            }`} />
                    ))}
                </div>

                {error && (
                    <div className={`text-center mb-4 text-sm font-bold animate-pulse flex items-center justify-center gap-2 ${error.includes('⛔') ? 'text-amber-400' : 'text-red-400'
                        }`}>
                        {error.includes('⛔') && <ShieldAlert size={16} />}
                        {error}
                    </div>
                )}

                {/* NUMPAD */}
                <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button
                            key={num}
                            onClick={() => handleIdx(num)}
                            className="h-14 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/5 rounded-xl text-xl font-bold text-white transition-all duration-150"
                        >
                            {num}
                        </button>
                    ))}
                    <div />
                    <button
                        onClick={() => handleIdx(0)}
                        className="h-14 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/5 rounded-xl text-xl font-bold text-white transition-all duration-150"
                    >
                        0
                    </button>
                    <button
                        onClick={handleClear}
                        className="h-14 bg-white/5 hover:bg-red-500/10 active:bg-red-500/20 border border-white/5 rounded-xl flex items-center justify-center text-zinc-500 hover:text-red-400 transition-all duration-150"
                    >
                        <Delete size={22} />
                    </button>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={loading || pin.length < 4}
                    className="w-full mt-6 py-3.5 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white font-bold text-sm shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all duration-200"
                >
                    {loading ? 'Verificando...' : 'Entrar'}
                </button>
            </div>
        </div>
    );
}
