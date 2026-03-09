import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingCart, Package, Building2, LogOut, LayoutGrid, Monitor, AlertTriangle } from 'lucide-react';

// Error Boundary to catch silent crashes
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }
    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('ErrorBoundary caught:', error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '2rem', color: 'white', background: '#0a0a0a', minHeight: '100vh', fontFamily: 'monospace' }}>
                    <h1 style={{ color: '#ef4444' }}>Enigma OPS -- Error de Inicializacion</h1>
                    <p style={{ color: '#fbbf24', marginTop: '1rem' }}>{this.state.error?.message}</p>
                    <pre style={{ color: '#888', marginTop: '1rem', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>{this.state.error?.stack}</pre>
                    <button onClick={() => { localStorage.clear(); window.location.reload(); }}
                        style={{ marginTop: '2rem', padding: '0.75rem 1.5rem', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}>
                        Limpiar Cache y Reiniciar
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// Context
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import HomePage from './pages/HomePage';
import PurchasesPage from './pages/PurchasesPage';
import InventoryPage from './pages/InventoryPage';
import SuppliersPage from './pages/SuppliersPage';
import SmartShopperPage from './pages/SmartShopperPage';
import SettingsPage from './pages/SettingsPage';
import LockScreen from './pages/LockScreen';
import RegisterOpenPage from './pages/RegisterOpenPage';
import RegisterClosePage from './pages/RegisterClosePage';
import CashMovementsPage from './pages/CashMovementsPage';
import TablesPage from './pages/TablesPage';
import TabletPOSPage from './pages/TabletPOSPage';
import { useCartStore } from './stores/cartStore';

// Top-level mode tabs
const MODE_TABS = [
    { label: 'OPS', path: '/', icon: Home, matchPaths: ['/', '/inventory', '/suppliers', '/purchases', '/smart-shopper', '/settings', '/close-register', '/cash-movements'] },
    { label: 'POS', path: '/pos', icon: Monitor, matchPaths: ['/pos'] },
    { label: 'Mesas', path: '/tables', icon: LayoutGrid, matchPaths: ['/tables'] },
];

// Bottom nav items (only shown in OPS mode)
const navItems = [
    { icon: Home, label: 'Inicio', path: '/' },
    { icon: Package, label: 'Inventario', path: '/inventory' },
    { icon: Building2, label: 'Proveedores', path: '/suppliers' },
    { icon: ShoppingCart, label: 'Compras', path: '/purchases' },
];

function TopModeTabs() {
    const location = useLocation();
    const navigate = useNavigate();
    const cartItemCount = useCartStore(s => s.itemCount());
    const cartTicketId = useCartStore(s => s.ticketId);
    const [pendingNav, setPendingNav] = useState<string | null>(null);

    const activeMode = MODE_TABS.find(t =>
        t.matchPaths.some(p => p === '/' ? location.pathname === '/' : location.pathname.startsWith(p))
    ) || MODE_TABS[0];

    const handleTabClick = (e: React.MouseEvent, tab: typeof MODE_TABS[0]) => {
        if (location.pathname === '/pos' && tab.path !== '/pos' && cartItemCount > 0 && !cartTicketId) {
            e.preventDefault();
            setPendingNav(tab.path);
        }
    };

    return (
        <>
            <div className="flex items-center gap-1 px-3 py-2 border-b border-white/[0.05] shrink-0" style={{ background: '#0a0a0c' }}>
                {MODE_TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = tab === activeMode;
                    return (
                        <NavLink key={tab.path} to={tab.path}
                            onClick={(e) => handleTabClick(e, tab)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                isActive
                                    ? 'text-[#93B59D]'
                                    : 'text-[#F4F0EA]/30 hover:text-[#F4F0EA]/60'
                            }`}
                            style={{
                                background: isActive ? 'rgba(147,181,157,0.1)' : 'transparent',
                                border: isActive ? '1px solid rgba(147,181,157,0.15)' : '1px solid transparent',
                            }}>
                            <Icon className="w-4 h-4" />
                            {tab.label}
                            {tab.path === '/pos' && cartItemCount > 0 && !isActive && (
                                <span className="w-2 h-2 rounded-full bg-[#93B59D] animate-pulse" />
                            )}
                        </NavLink>
                    );
                })}

                <div className="ml-auto flex items-center gap-3">
                    <span className="text-xs" style={{ color: 'rgba(244,240,234,0.25)' }}>Enigma Ops</span>
                </div>
            </div>

            {/* Navigation confirm modal */}
            {pendingNav && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/70" onClick={() => setPendingNav(null)} />
                    <div className="relative z-10 w-[360px] rounded-2xl p-6" style={{ background: '#1a1d1b', border: '1px solid rgba(244,240,234,0.08)' }}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                                <AlertTriangle className="w-5 h-5" style={{ color: '#ef4444' }} />
                            </div>
                            <h3 className="text-base font-bold" style={{ color: '#F4F0EA' }}>Salir del POS</h3>
                        </div>
                        <p className="text-sm mb-6 ml-[52px]" style={{ color: 'rgba(244,240,234,0.5)' }}>
                            Tienes items sin guardar en el carrito. Salir de todos modos?
                        </p>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setPendingNav(null)}
                                className="px-5 py-2.5 rounded-xl text-sm font-medium"
                                style={{ background: 'rgba(244,240,234,0.06)', color: 'rgba(244,240,234,0.6)' }}>
                                Cancelar
                            </button>
                            <button onClick={() => { const path = pendingNav; setPendingNav(null); navigate(path); }}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold"
                                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                                Salir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function ProtectedApp() {
    const { employee, session, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return <div className="min-h-screen bg-enigma-black flex items-center justify-center text-white">Cargando...</div>;
    }

    // 1. Not Logged In -> Lock Screen
    if (!employee) {
        return <LockScreen />;
    }

    // 2. Logged In but No Open Session -> Open Register Page
    if (!session) {
        return <RegisterOpenPage />;
    }

    // Determine if we're in a full-screen mode (POS or Mesas)
    const isFullscreen = location.pathname === '/pos' || location.pathname === '/tables';

    // 3. Authenticated & Open Session -> Main App
    return (
        <div className={`bg-enigma-black text-enigma-text-primary flex flex-col ${isFullscreen ? 'h-screen' : 'min-h-screen'}`}>
            {/* Fixed top tabs - always visible */}
            <TopModeTabs />

            {/* Content */}
            {isFullscreen ? (
                <main className="flex-1 overflow-y-auto">
                    <Routes>
                        <Route path="/pos" element={<TabletPOSPage />} />
                        <Route path="/tables" element={<TablesPage />} />
                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </main>
            ) : (
                <>
                    <main className="flex-1 overflow-y-auto pb-20">
                        <Routes>
                            <Route path="/" element={<HomePage />} />
                            <Route path="/inventory" element={<InventoryPage />} />
                            <Route path="/suppliers" element={<SuppliersPage />} />
                            <Route path="/purchases" element={<PurchasesPage />} />
                            <Route path="/smart-shopper" element={<SmartShopperPage />} />
                            <Route path="/settings" element={<SettingsPage />} />
                            <Route path="/close-register" element={<RegisterClosePage />} />
                            <Route path="/cash-movements" element={<CashMovementsPage />} />
                            <Route path="/pos" element={<TabletPOSPage />} />
                            <Route path="/tables" element={<TablesPage />} />
                            <Route path="*" element={<Navigate to="/" />} />
                        </Routes>
                    </main>

                    {/* Bottom Navigation - only in OPS mode */}
                    <nav className="fixed bottom-0 left-0 right-0 bg-enigma-gray/95 backdrop-blur-xl border-t border-white/5 safe-area-bottom z-50">
                        <div className="flex justify-around py-2">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={({ isActive }) =>
                                        `flex flex-col items-center p-2 rounded-xl transition-all ${isActive
                                            ? 'text-enigma-purple'
                                            : 'text-white/40 hover:text-white/70'
                                        }`
                                    }
                                >
                                    <item.icon className="w-6 h-6" />
                                    <span className="text-[10px] mt-1">{item.label}</span>
                                </NavLink>
                            ))}
                            <NavLink
                                to="/close-register"
                                className={({ isActive }) =>
                                    `flex flex-col items-center p-2 rounded-xl transition-all ${isActive
                                        ? 'text-red-500'
                                        : 'text-white/40 hover:text-red-400'
                                    }`
                                }
                            >
                                <LogOut className="w-6 h-6" />
                                <span className="text-[10px] mt-1">Cerrar</span>
                            </NavLink>
                        </div>
                    </nav>
                </>
            )}
        </div>
    );
}

function App() {
    return (
        <ErrorBoundary>
            <BrowserRouter>
                <AuthProvider>
                    <ProtectedApp />
                </AuthProvider>
            </BrowserRouter>
        </ErrorBoundary>
    );
}

export default App;
