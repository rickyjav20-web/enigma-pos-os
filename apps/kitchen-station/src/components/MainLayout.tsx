import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { ChefHat, Trash2, LogOut, User } from 'lucide-react';
import { useAuth } from '../lib/auth';

export default function MainLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-zinc-950 text-white font-sans overflow-hidden">
            {/* SIDEBAR */}
            <aside className="w-24 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-6 gap-6">
                <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mb-4">
                    <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full" />
                </div>

                <nav className="flex-1 flex flex-col w-full gap-4 px-2">
                    <NavLink
                        to="/production"
                        className={({ isActive }) => `flex flex-col items-center justify-center p-3 rounded-xl transition-all ${isActive ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`}
                    >
                        <ChefHat size={28} />
                        <span className="text-[10px] font-bold mt-1">PROD</span>
                    </NavLink>

                    <NavLink
                        to="/waste"
                        className={({ isActive }) => `flex flex-col items-center justify-center p-3 rounded-xl transition-all ${isActive ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`}
                    >
                        <Trash2 size={28} />
                        <span className="text-[10px] font-bold mt-1">MERMA</span>
                    </NavLink>
                </nav>

                <div className="flex flex-col items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 border border-zinc-700" title={user?.name}>
                        <span className="text-sm font-bold">{user?.name?.substring(0, 2).toUpperCase()}</span>
                    </div>
                    <button onClick={handleLogout} className="p-3 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-zinc-500 hover:text-white transition-colors">
                        <LogOut size={24} />
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
