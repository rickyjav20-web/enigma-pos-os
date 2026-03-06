import { Component, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Pages
import LoginPage from './pages/LoginPage';
import SaleScreen from './pages/SaleScreen';
import PaymentPage from './pages/PaymentPage';
import OpenTicketsPage from './pages/OpenTicketsPage';
import GoalsPage from './pages/GoalsPage';
import ReceiptsPage from './pages/ReceiptsPage';
import ShiftPage from './pages/ShiftPage';
import SettingsPage from './pages/SettingsPage';

/* ─── Global Error Boundary ──────────────────────────────────────────── */

interface EBState { hasError: boolean; error: Error | null }

class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error('[POS ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center px-8 gap-4"
          style={{ background: '#121413' }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-base font-semibold text-center" style={{ color: '#F4F0EA' }}>
            Algo salió mal
          </p>
          <p className="text-xs text-center" style={{ color: 'rgba(244,240,234,0.35)' }}>
            {this.state.error?.message || 'Error inesperado'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = '/';
            }}
            className="mt-2 px-6 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(147,181,157,0.15)', color: '#93B59D', border: '1px solid rgba(147,181,157,0.3)' }}>
            Reiniciar App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─── Protected Route ────────────────────────────────────────────────── */

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { employee } = useAuth();
  if (!employee) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/* ─── App ────────────────────────────────────────────────────────────── */

export default function App() {
  const { employee } = useAuth();

  return (
    <ErrorBoundary>
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

        {/* Receipts */}
        <Route path="/receipts" element={
          <ProtectedRoute><ReceiptsPage /></ProtectedRoute>
        } />

        {/* Shift / Cash Management */}
        <Route path="/shift" element={
          <ProtectedRoute><ShiftPage /></ProtectedRoute>
        } />

        {/* Settings */}
        <Route path="/settings" element={
          <ProtectedRoute><SettingsPage /></ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to={employee ? "/" : "/login"} replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
