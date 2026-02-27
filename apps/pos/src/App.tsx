import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Pages
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import NewOrderPage from './pages/NewOrderPage';
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

      {/* Protected */}
      <Route path="/" element={
        <ProtectedRoute><HomePage /></ProtectedRoute>
      } />
      <Route path="/order/new" element={
        <ProtectedRoute><NewOrderPage /></ProtectedRoute>
      } />
      <Route path="/payment" element={
        <ProtectedRoute><PaymentPage /></ProtectedRoute>
      } />
      <Route path="/tickets" element={
        <ProtectedRoute><OpenTicketsPage /></ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to={employee ? "/" : "/login"} replace />} />
    </Routes>
  );
}
