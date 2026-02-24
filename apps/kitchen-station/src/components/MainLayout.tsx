import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { ChefHat, Trash2, LogOut, ClipboardList } from 'lucide-react';
import { useAuth } from '../lib/auth';

const NAV_ITEMS = [
    { to: '/production', icon: ChefHat,     label: 'Producción', color: 'violet' },
    { to: '/inventory',  icon: ClipboardList, label: 'Inventario', color: 'blue' },
    { to: '/waste',      icon: Trash2,       label: 'Merma',      color: 'red' },
];

const activeGlow: Record<string, string> = {
    violet: 'bg-violet-500/20 text-violet-300 shadow-[0_0_20px_rgba(139,92,246,0.25)]',
    blue:   'bg-blue-500/20   text-blue-300   shadow-[0_0_20px_rgba(59,130,246,0.25)]',
    red:    'bg-red-500/20    text-red-300    shadow-[0_0_20px_rgba(239,68,68,0.25)]',
};
const activeDot: Record<string, string> = {
    violet: 'bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.6)]',
    blue:   'bg-blue-500   shadow-[0_0_8px_rgba(59,130,246,0.6)]',
    red:    'bg-red-500    shadow-[0_0_8px_rgba(239,68,68,0.6)]',
};
const activeIcon: Record<string, string> = {
    violet: 'text-violet-400',
    blue:   'text-blue-400',
    red:    'text-red-400',
};
const activeText: Record<string, string> = {
    violet: 'text-violet-400',
    blue:   'text-blue-400',
    red:    'text-red-400',
};

export default function MainLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        /*
         * Landscape: row layout — sidebar on the left, content fills right
         * Portrait:  col-reverse layout — content on top, bottom nav bar at bottom
         */
        <div className="flex h-screen w-screen overflow-hidden text-white font-sans landscape:flex-row portrait:flex-col-reverse">

            {/* ── SIDE NAV (landscape) ───────────────────────────────── */}
            <aside className="
                portrait:hidden landscape:flex
                flex-col items-center
                w-20 shrink-0
                bg-black/40 backdrop-blur-xl
                border-r border-white/5
                py-5 gap-3
            ">
                {/* Brand mark */}
                <div className="relative w-10 h-10 flex items-center justify-center mb-3 shrink-0">
                    <div className="absolute inset-0 bg-violet-500/25 rounded-xl blur-md" />
                    <div className="relative bg-gradient-to-br from-white/10 to-transparent border border-white/10 rounded-xl w-full h-full flex items-center justify-center">
                        <span className="text-sm font-extrabold bg-clip-text text-transparent bg-gradient-to-br from-violet-300 to-white">K</span>
                    </div>
                </div>

                {/* Nav links */}
                <nav className="flex-1 flex flex-col w-full gap-1.5 px-2">
                    {NAV_ITEMS.map(({ to, icon: Icon, label, color }) => (
                        <NavLink key={to} to={to} className={({ isActive }) =>
                            `relative flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-2xl transition-all duration-200 min-h-[60px]
                            ${isActive
                                ? activeGlow[color]
                                : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/5'
                            }`
                        }>
                            {({ isActive }) => (
                                <>
                                    {isActive && (
                                        <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${activeDot[color]}`} />
                                    )}
                                    <Icon size={22} className={isActive ? activeIcon[color] : 'opacity-60'} />
                                    <span className={`text-[9px] font-bold uppercase tracking-wider leading-none ${isActive ? activeText[color] : 'text-zinc-600'}`}>
                                        {label.split(' ')[0]}
                                    </span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* User + Logout */}
                <div className="flex flex-col items-center gap-2 pt-3 border-t border-white/5 w-full px-2 shrink-0">
                    <div
                        className="w-9 h-9 rounded-full bg-gradient-to-br from-white/15 to-transparent border border-white/10 flex items-center justify-center"
                        title={user?.name}
                    >
                        <span className="text-[11px] font-extrabold text-zinc-300">
                            {user?.name?.substring(0, 2).toUpperCase()}
                        </span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-2.5 rounded-xl text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 active:scale-95"
                        title="Salir"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </aside>

            {/* ── BOTTOM NAV (portrait) ──────────────────────────────── */}
            <nav className="
                portrait:flex landscape:hidden
                flex-row items-stretch
                w-full shrink-0
                bg-black/60 backdrop-blur-2xl
                border-t border-white/8
                safe-area-inset-bottom
            " style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                {NAV_ITEMS.map(({ to, icon: Icon, label, color }) => (
                    <NavLink key={to} to={to} className={({ isActive }) =>
                        `flex-1 flex flex-col items-center justify-center gap-1.5 py-3 transition-all duration-200 active:scale-95
                        ${isActive ? activeGlow[color] : 'text-zinc-600'}`
                    }>
                        {({ isActive }) => (
                            <>
                                <Icon size={24} className={isActive ? activeIcon[color] : 'opacity-50'} />
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? activeText[color] : 'text-zinc-600'}`}>
                                    {label.split(' ')[0]}
                                </span>
                                {isActive && (
                                    <div className={`absolute top-0 h-0.5 w-10 rounded-full ${activeDot[color]}`} />
                                )}
                            </>
                        )}
                    </NavLink>
                ))}
                {/* Logout at end in portrait */}
                <button
                    onClick={handleLogout}
                    className="flex flex-col items-center justify-center gap-1.5 py-3 px-4 text-zinc-700 hover:text-red-400 active:text-red-400 transition-colors"
                >
                    <LogOut size={22} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Salir</span>
                </button>
            </nav>

            {/* ── MAIN CONTENT ──────────────────────────────────────── */}
            <main className="flex-1 overflow-hidden min-w-0">
                <Outlet />
            </main>
        </div>
    );
}
