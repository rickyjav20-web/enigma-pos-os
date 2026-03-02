// 🔒 PROTECTED FILE: DO NOT EDIT WITHOUT EXPLICIT USER APPROVAL
// Module: Core Navigation
// Status: STABLE — Rebranded Feb 2026 (60-30-10 + Color Intelligence)
import { useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Settings, LogOut, Package, Brain, LayoutDashboard,
    Users, Calendar, ShoppingCart, Building2, Wallet,
    TrendingUp, Trash2, FileUp, Target, LayoutGrid
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type NavItem = {
    icon: React.ElementType;
    label: string;
    href: string;
    // Icon color when active — communicates the domain (color intelligence)
    activeColor: string;
    // Exact match only (prevents /staff matching /staff/schedule)
    exact?: boolean;
};

type NavSection = {
    header?: string;
    // Full Tailwind classes as literals so JIT picks them up
    headerText?: string;
    headerLine?: string;
    items: NavItem[];
};

// ─── Navigation Structure ─────────────────────────────────────────────────────
// Color Intelligence:
//   Dashboard/Caja → violet/emerald (system overview + money)
//   EQUIPO        → blue   (people, HR)
//   INVENTARIO    → amber  (physical stock) — also the 10% action color
//   COMPRAS       → green  (procurement, money out)
//   INTELIGENCIA  → pink   (AI, analytics)
// Active indicator → amber always (10% rule: guides the eye to "where you are")

const SECTIONS: NavSection[] = [
    {
        items: [
            { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', activeColor: 'text-violet-400', exact: true },
            { icon: Wallet, label: 'Caja', href: '/register', activeColor: 'text-emerald-400', exact: true },
        ],
    },
    {
        header: 'EQUIPO',
        headerText: 'text-blue-400/60',
        headerLine: 'bg-blue-500/10',
        items: [
            { icon: Users, label: 'Staff', href: '/staff', activeColor: 'text-blue-400', exact: true },
            { icon: Calendar, label: 'Turnos', href: '/staff/schedule', activeColor: 'text-blue-300' },
            { icon: Target, label: 'Metas', href: '/staff/goals', activeColor: 'text-pink-400', exact: true },
        ],
    },
    {
        header: 'SALÓN',
        headerText: 'text-[#93B59D]/60',
        headerLine: 'bg-[#93B59D]/10',
        items: [
            { icon: LayoutGrid, label: 'Mesas', href: '/dining/tables', activeColor: 'text-[#93B59D]', exact: true },
        ],
    },
    {
        header: 'INVENTARIO',
        headerText: 'text-amber-400/60',
        headerLine: 'bg-amber-500/10',
        items: [
            { icon: Package, label: 'Inventario', href: '/purchases/inventory', activeColor: 'text-amber-400' },
            { icon: Trash2, label: 'Mermas', href: '/purchases/waste', activeColor: 'text-orange-400', exact: true },
        ],
    },
    {
        header: 'COMPRAS',
        headerText: 'text-green-400/60',
        headerLine: 'bg-green-500/10',
        items: [
            { icon: Building2, label: 'Proveedores', href: '/purchases/suppliers', activeColor: 'text-green-400' },
            { icon: ShoppingCart, label: 'Nueva Compra', href: '/purchases/new', activeColor: 'text-teal-400', exact: true },
            { icon: FileUp, label: 'Importar Ventas', href: '/purchases/import-sales', activeColor: 'text-cyan-400', exact: true },
        ],
    },
    {
        header: 'INTELIGENCIA',
        headerText: 'text-pink-400/60',
        headerLine: 'bg-pink-500/10',
        items: [
            { icon: Brain, label: 'Smart Order', href: '/purchases/smart-order', activeColor: 'text-pink-400', exact: true },
            { icon: TrendingUp, label: 'Menu Intel', href: '/purchases/menu-intelligence', activeColor: 'text-rose-400', exact: true },
        ],
    },
];

// ─── Component ────────────────────────────────────────────────────────────────
interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Sidebar({ className }: SidebarProps) {
    const location = useLocation();
    const pathname = location.pathname;

    const isActive = (item: NavItem) =>
        item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/');

    return (
        <div className={cn(
            "h-screen w-72 flex flex-col",
            // 60% — Ónice/Carbón: structure, premium feel
            "bg-[#0a0a0c] border-r border-white/[0.05]",
            className
        )}>

            {/* ── Brand ────────────────────────────────────────────────────── */}
            <Link
                to="/dashboard"
                className="flex items-center px-5 py-5 group border-b border-white/[0.05] flex-shrink-0"
            >
                <div className="relative w-8 h-8 mr-3 flex items-center justify-center flex-shrink-0">
                    {/* Amber glow — 10% accent on brand mark */}
                    <div className="absolute inset-0 bg-amber-500/15 rounded-xl blur-md group-hover:bg-amber-500/25 transition-all duration-500" />
                    <div className="relative bg-gradient-to-br from-white/10 to-transparent border border-white/10 rounded-xl w-full h-full flex items-center justify-center">
                        <span className="text-sm font-bold text-white">E</span>
                    </div>
                </div>
                <div className="min-w-0">
                    <h1 className="text-[15px] font-bold tracking-tight text-white leading-none">Enigma</h1>
                    {/* 30% — Crema/Avena: legible subtitle */}
                    <p className="text-[9px] text-zinc-600 uppercase tracking-[0.22em] mt-[3px]">Operating System</p>
                </div>
            </Link>

            {/* ── Navigation ───────────────────────────────────────────────── */}
            <nav className="flex-1 overflow-y-auto py-4 px-3">
                <div className="space-y-4">
                    {SECTIONS.map((section, si) => (
                        <div key={si}>
                            {/* Section header */}
                            {section.header && (
                                <div className="flex items-center gap-2 px-2 mb-1">
                                    <span className={cn(
                                        "text-[9px] font-bold tracking-[0.2em] uppercase flex-shrink-0",
                                        section.headerText
                                    )}>
                                        {section.header}
                                    </span>
                                    <div className={cn("flex-1 h-px", section.headerLine)} />
                                </div>
                            )}

                            {/* Nav items */}
                            <div className="space-y-[2px]">
                                {section.items.map((route) => {
                                    const active = isActive(route);
                                    return (
                                        <Button
                                            key={route.href}
                                            asChild
                                            variant="ghost"
                                            className={cn(
                                                "w-full justify-start text-[13px] font-medium h-9 relative overflow-hidden group rounded-lg px-3 transition-all duration-150",
                                                // 30% — White/Crema for legibility
                                                active
                                                    ? "text-white bg-white/[0.07]"
                                                    : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
                                            )}
                                        >
                                            <Link to={route.href}>
                                                {/* 10% Amber — active indicator, always amber regardless of section */}
                                                {active && (
                                                    <div className="absolute left-0 top-[6px] bottom-[6px] w-[3px] rounded-r-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                                                )}
                                                {/* Section-colored icon — color intelligence */}
                                                <route.icon
                                                    className={cn(
                                                        "h-4 w-4 mr-3 flex-shrink-0 transition-colors duration-150",
                                                        active
                                                            ? route.activeColor
                                                            : "text-zinc-600 group-hover:text-zinc-400"
                                                    )}
                                                />
                                                <span className="truncate">{route.label}</span>
                                            </Link>
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </nav>

            {/* ── Footer ───────────────────────────────────────────────────── */}
            <div className="px-3 py-3 border-t border-white/[0.05] bg-black/30 flex-shrink-0 space-y-[2px]">
                {/* Organisation */}
                <Button
                    asChild
                    variant="ghost"
                    className={cn(
                        "w-full justify-start text-[13px] font-medium h-9 rounded-lg px-3 relative overflow-hidden group transition-all duration-150",
                        pathname === '/account' || pathname.startsWith('/account/')
                            ? "text-white bg-white/[0.07]"
                            : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
                    )}
                >
                    <Link to="/account">
                        {(pathname === '/account' || pathname.startsWith('/account/')) && (
                            <div className="absolute left-0 top-[6px] bottom-[6px] w-[3px] rounded-r-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                        )}
                        <Settings className={cn(
                            "h-4 w-4 mr-3 flex-shrink-0 transition-colors duration-150",
                            pathname === '/account' ? "text-zinc-300" : "text-zinc-600 group-hover:text-zinc-400"
                        )} />
                        Organización
                    </Link>
                </Button>

                {/* Disconnect */}
                <Button
                    variant="ghost"
                    className="w-full justify-start text-[13px] font-medium h-9 rounded-lg px-3 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 group transition-all duration-150"
                >
                    <LogOut className="h-4 w-4 mr-3 flex-shrink-0 group-hover:translate-x-0.5 transition-transform duration-150" />
                    Desconectar
                </Button>
            </div>
        </div>
    );
}
