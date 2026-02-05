import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Home, ShoppingCart, Package, Building2 } from 'lucide-react';

// Pages
import HomePage from './pages/HomePage';
import PurchasesPage from './pages/PurchasesPage';
import InventoryPage from './pages/InventoryPage';
import SuppliersPage from './pages/SuppliersPage';
import SmartShopperPage from './pages/SmartShopperPage';
import SettingsPage from './pages/SettingsPage';

const navItems = [
    { icon: Home, label: 'Inicio', path: '/' },
    { icon: Package, label: 'Inventario', path: '/inventory' },
    { icon: Building2, label: 'Proveedores', path: '/suppliers' },
    { icon: ShoppingCart, label: 'Compras', path: '/purchases' },
];

function App() {
    return (
        <BrowserRouter>
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
                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </main>

                {/* Bottom Navigation */}
                <nav className="fixed bottom-0 left-0 right-0 bg-enigma-gray/95 backdrop-blur-xl border-t border-white/5 safe-area-bottom">
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
                    </div>
                </nav>
            </div>
        </BrowserRouter>
    );
}

export default App;
