// 🔒 PROTECTED FILE: DO NOT EDIT WITHOUT EXPLICIT USER APPROVAL
// Module: Core Navigation
// Status: STABLE
import { useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Settings, LogOut, Package, Brain, LayoutDashboard, Users, Calendar, ShoppingCart, Building2 } from "lucide-react";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Sidebar({ className }: SidebarProps) {
    const location = useLocation();
    const pathname = location.pathname;

    const routes = [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', color: 'text-enigma-purple' },
        { icon: Users, label: 'Staff', href: '/staff', color: 'text-blue-400' },
        { icon: Calendar, label: 'Scheduler', href: '/staff/schedule', color: 'text-indigo-400' },
        { icon: Building2, label: 'Suppliers', href: '/purchases/suppliers', color: 'text-emerald-400' },
        { icon: Package, label: 'Inventory', href: '/purchases/inventory', color: 'text-enigma-green' },
        { icon: Brain, label: 'Smart Order', href: '/purchases/smart-order', color: 'text-pink-400' },
        { icon: ShoppingCart, label: 'New Purchase', href: '/purchases/new', color: 'text-amber-400' },
        { icon: Settings, label: 'Organization', href: '/account', color: 'text-gray-400' },
    ];

    return (
        <div className={cn("pb-12 h-screen w-72 border-r border-white/5 bg-enigma-void/50 backdrop-blur-xl flex flex-col transition-all duration-300", className)}>
            <div className="px-6 py-8 flex-1">
                {/* Brand / Logo */}
                <Link to="/dashboard" className="flex items-center pl-2 mb-10 group">
                    <div className="relative w-10 h-10 mr-4 flex items-center justify-center">
                        <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg group-hover:bg-primary/40 transition-all duration-500" />
                        <div className="relative bg-gradient-to-br from-white/10 to-transparent border border-white/10 rounded-xl w-full h-full flex items-center justify-center backdrop-blur-md shadow-inner">
                            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-tr from-primary to-white">E</span>
                        </div>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tighter text-white group-hover:text-glow transition-all">
                            Enigma
                        </h1>
                        <p className="text-xs text-enigma-text-secondary uppercase tracking-[0.2em]">Operating System</p>
                    </div>
                </Link>

                {/* Navigation */}
                <div className="space-y-2">
                    {routes.map((route) => {
                        const isActive = pathname.startsWith(route.href);
                        return (
                            <Button
                                key={route.href}
                                asChild
                                variant="ghost"
                                className={cn(
                                    "w-full justify-start text-base font-medium transition-all duration-300 h-12 relative overflow-hidden group",
                                    isActive
                                        ? "text-white bg-white/5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                                        : "text-enigma-text-muted hover:text-white hover:bg-white/5"
                                )}
                            >
                                <Link to={route.href}>
                                    {/* Active Indicator Line */}
                                    {isActive && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
                                    )}

                                    <route.icon
                                        className={cn(
                                            "h-5 w-5 mr-4 transition-all duration-300",
                                            isActive ? route.color : "text-zinc-600 group-hover:text-zinc-400"
                                        )}
                                    />
                                    <span className={cn(isActive && "text-glow-purple")}>
                                        {route.label}
                                    </span>
                                </Link>
                            </Button>
                        )
                    })}
                </div>
            </div>

            {/* Logout / Footer */}
            <div className="px-6 py-6 border-t border-white/5 bg-black/20">
                <Button variant="ghost" className="w-full justify-start text-red-400/70 hover:text-red-400 hover:bg-red-500/10 group">
                    <LogOut className="h-5 w-5 mr-3 group-hover:rotate-12 transition-transform" />
                    <span className="group-hover:text-glow">Disconnect</span>
                </Button>
            </div>
        </div>
    );
}
