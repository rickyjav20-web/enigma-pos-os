import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, ClipboardList, ChefHat, Clock, LogOut, ChevronRight, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export default function HomePage() {
    const { employee, logout } = useAuth();
    const navigate = useNavigate();

    // Fetch open orders count (placeholder – will use real API when built)
    const { data: ordersData } = useQuery({
        queryKey: ['open-orders-count'],
        queryFn: async () => {
            try {
                const { data } = await api.get('/sales?status=open');
                return { count: data?.length || 0 };
            } catch {
                return { count: 0 };
            }
        },
        refetchInterval: 15000,
    });

    const openOrders = ordersData?.count || 0;

    return (
        <div className="min-h-dvh bg-wave-dark flex flex-col safe-top safe-bottom">

            {/* Header */}
            <header className="px-5 pt-4 pb-2 flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-wave-purple" />
                        <h1 className="text-lg font-bold tracking-tight">WAVE POS</h1>
                    </div>
                    <p className="text-wave-text-muted text-xs mt-0.5">
                        Hola, <span className="text-wave-text-secondary">{employee?.fullName?.split(' ')[0] || 'Staff'}</span>
                    </p>
                </div>
                <button
                    onClick={logout}
                    className="w-10 h-10 rounded-xl bg-wave-gray border border-wave-border flex items-center justify-center press"
                >
                    <LogOut className="w-4 h-4 text-wave-text-muted" />
                </button>
            </header>

            {/* Main Content */}
            <main className="flex-1 px-5 pb-4 space-y-4 overflow-y-auto">

                {/* Primary Action — New Order */}
                <button
                    onClick={() => navigate('/order/new')}
                    className="w-full p-5 rounded-3xl bg-gradient-to-br from-wave-purple/25 via-wave-purple/10 to-transparent border border-wave-purple/20 
            flex items-center gap-4 press group animate-slide-up"
                >
                    <div className="w-14 h-14 rounded-2xl bg-wave-purple/20 flex items-center justify-center group-active:scale-95 transition-transform">
                        <Plus className="w-7 h-7 text-wave-purple" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="text-lg font-bold">Nueva Orden</p>
                        <p className="text-xs text-wave-text-muted">Crear ticket nuevo</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-wave-purple/50 group-hover:text-wave-purple transition-colors" />
                </button>

                {/* Quick Actions Grid */}
                <div className="grid grid-cols-2 gap-3">

                    {/* Open Tickets */}
                    <Link
                        to="/tickets"
                        className="relative p-4 rounded-2xl glass flex flex-col gap-3 press animate-slide-up"
                        style={{ animationDelay: '0.05s' }}
                    >
                        <div className="w-11 h-11 rounded-xl bg-wave-amber/15 flex items-center justify-center">
                            <ClipboardList className="w-5 h-5 text-wave-amber" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold">Órdenes Abiertas</p>
                            <p className="text-xs text-wave-text-muted">Tickets activos</p>
                        </div>
                        {openOrders > 0 && (
                            <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-wave-amber flex items-center justify-center animate-badge-pop">
                                <span className="text-[11px] font-bold text-wave-black">{openOrders}</span>
                            </div>
                        )}
                    </Link>

                    {/* Ready from Kitchen */}
                    <Link
                        to="/tickets?filter=ready"
                        className="relative p-4 rounded-2xl glass flex flex-col gap-3 press animate-slide-up"
                        style={{ animationDelay: '0.1s' }}
                    >
                        <div className="w-11 h-11 rounded-xl bg-wave-green/15 flex items-center justify-center">
                            <ChefHat className="w-5 h-5 text-wave-green" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold">Listos KDS</p>
                            <p className="text-xs text-wave-text-muted">Desde cocina</p>
                        </div>
                    </Link>

                </div>

                {/* Shift Status Card */}
                <div className="p-4 rounded-2xl glass animate-slide-up" style={{ animationDelay: '0.15s' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-wave-green/15 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-wave-green" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold">Turno Activo</p>
                            <p className="text-xs text-wave-text-muted">
                                {employee?.role || 'Staff'} · Desde {new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                        <div className="w-2.5 h-2.5 rounded-full bg-wave-green animate-pulse" />
                    </div>
                </div>

            </main>
        </div>
    );
}
