
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { ChefHat, Trash2, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth';

export default function MainLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex h-screen text-white font-sans overflow-hidden">
            {/* SIDEBAR — glass panel matching HQ */}
            <aside className="w-20 bg-white/[0.02] backdrop-blur-xl border-r border-white/5 flex flex-col items-center py-6 gap-4">
                {/* Brand */}
                <div className="relative w-11 h-11 flex items-center justify-center mb-4">
                    <div className="absolute inset-0 bg-violet-500/20 rounded-xl blur-lg" />
                    <div className="relative bg-gradient-to-br from-white/10 to-transparent border border-white/10 rounded-xl w-full h-full flex items-center justify-center backdrop-blur-md">
                        <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-tr from-violet-400 to-white">K</span>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 flex flex-col w-full gap-2 px-2">
                    <NavLink
                        to="/production"
                        className={({ isActive }) =>
                            `relative flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-300 group ${isActive
                                ? 'bg-white/5 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]'
                                : 'text-zinc-600 hover:bg-white/5 hover:text-zinc-300'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                {isActive && (
                                    <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
                                )}
                                <ChefHat size={24} className={isActive ? 'text-violet-400' : 'group-hover:text-zinc-400'} />
                                <span className="text-[9px] font-bold mt-1 uppercase tracking-wider">Prod</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink
                        to="/waste"
                        className={({ isActive }) =>
                            `relative flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-300 group ${isActive
                                ? 'bg-white/5 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]'
                                : 'text-zinc-600 hover:bg-white/5 hover:text-zinc-300'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                {isActive && (
                                    <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                                )}
                                <Trash2 size={24} className={isActive ? 'text-red-400' : 'group-hover:text-zinc-400'} />
                                <span className="text-[9px] font-bold mt-1 uppercase tracking-wider">Merma</span>
                            </>
                        )}
                    </NavLink>
                </nav>

                {/* User + Logout */}
                <div className="flex flex-col items-center gap-3 pt-4 border-t border-white/5 w-full px-2">
                    <div
                        className="w-9 h-9 rounded-full bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center backdrop-blur-md"
                        title={user?.name}
                    >
                        <span className="text-xs font-bold text-zinc-300">{user?.name?.substring(0, 2).toUpperCase()}</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-2.5 rounded-xl text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300 group"
                    >
                        <LogOut size={20} className="group-hover:rotate-12 transition-transform" />
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 overflow-hidden relative">
                <Outlet />
            </main>
        </div>
    );
}
