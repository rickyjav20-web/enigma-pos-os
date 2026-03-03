import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Pages
import LoginPage from './pages/LoginPage';
import FloorPage from './pages/FloorPage';
import SaleScreen from './pages/SaleScreen';
import PaymentPage from './pages/PaymentPage';
import OpenTicketsPage from './pages/OpenTicketsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { employee } = useAuth();
  if (!employee) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { employee } = useAuth();

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={
        employee ? <Navigate to="/" replace /> : <LoginPage />
      } />

      {/* Floor Plan — main home */}
      <Route path="/" element={
        <ProtectedRoute><FloorPage /></ProtectedRoute>
      } />

      {/* Sale Screen — item picker + cart */}
      <Route path="/sale" element={
        <ProtectedRoute><SaleScreen /></ProtectedRoute>
      } />

      {/* Payment */}
      <Route path="/payment" element={
        <ProtectedRoute><PaymentPage /></ProtectedRoute>
      } />

      {/* Open Tickets */}
      <Route path="/tickets" element={
        <ProtectedRoute><OpenTicketsPage /></ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to={employee ? "/" : "/login"} replace />} />
    </Routes>
  );
}
