import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Pages
import LoginPage from './pages/LoginPage';
import SaleScreen from './pages/SaleScreen';
import PaymentPage from './pages/PaymentPage';
import OpenTicketsPage from './pages/OpenTicketsPage';
import GoalsPage from './pages/GoalsPage';

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

      {/* Sale Screen — main home */}
      <Route path="/" element={
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

      {/* Goals */}
      <Route path="/goals" element={
        <ProtectedRoute><GoalsPage /></ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to={employee ? "/" : "/login"} replace />} />
    </Routes>
  );
}
