import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Home, ShoppingCart, Package, Building2, LogOut } from 'lucide-react';

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
                    <h1 style={{ color: '#ef4444' }}>⚠️ Enigma OPS — Error de Inicialización</h1>
                    <p style={{ color: '#fbbf24', marginTop: '1rem' }}>{this.state.error?.message}</p>
                    <pre style={{ color: '#888', marginTop: '1rem', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>{this.state.error?.stack}</pre>
                    <button onClick={() => { localStorage.clear(); window.location.reload(); }}
                        style={{ marginTop: '2rem', padding: '0.75rem 1.5rem', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}>
                        🔄 Limpiar Cache y Reiniciar
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
import ManualSalePage from './pages/ManualSalePage';

const navItems = [
    { icon: Home, label: 'Inicio', path: '/' },
    { icon: Package, label: 'Inventario', path: '/inventory' },
    { icon: Building2, label: 'Proveedores', path: '/suppliers' },
    { icon: ShoppingCart, label: 'Compras', path: '/purchases' },
];

function ProtectedApp() {
    const { employee, session, isLoading } = useAuth();

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

    // 3. Authenticated & Open Session -> Main App
    return (
        <div className="min-h-screen bg-enigma-black text-enigma-text-primary flex flex-col">
            {/* Content */}
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
                    <Route path="/manual-sale" element={<ManualSalePage />} />
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </main>

            {/* Bottom Navigation */}
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
                    {/* Add Close Register shortcut to nav (optional) or keep in Settings */}
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
