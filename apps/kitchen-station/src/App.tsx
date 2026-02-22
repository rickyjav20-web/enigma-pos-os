import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import MainLayout from './components/MainLayout';
import LoginPage from './pages/LoginPage';
import ProductionPage from './pages/ProductionPage';
import WastePage from './pages/WastePage';
import InventoryPage from './pages/InventoryPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />

                    <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                        <Route index element={<Navigate to="/production" replace />} />
                        <Route path="production" element={<ProductionPage />} />
                        <Route path="inventory" element={<InventoryPage />} />
                        <Route path="waste" element={<WastePage />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
