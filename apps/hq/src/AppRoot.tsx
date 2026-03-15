import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "./components/layout/DashboardLayout";
import DashboardPage from "./pages/Dashboard";
import { AppQueryProvider } from "./components/providers/QueryProvider";
import { UserAuthProvider, useUserAuth } from "./context/UserAuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProductsPage from "./pages/Products";
import ProductDetails from "./features/products/pages/ProductDetails";
// @ts-ignore
import AdminDashboard from "./features/staff/pages/AdminDashboard";
// @ts-ignore
import EmployeeManager from "./features/staff/pages/EmployeeManager";
// @ts-ignore
import Scheduler from "./features/staff/pages/Scheduler";
// @ts-ignore
import ShiftHistory from "./features/staff/pages/ShiftHistory";
// @ts-ignore
import RolesManager from "./features/staff/pages/RolesManager";
// @ts-ignore
import KioskAuth from "./features/staff/pages/KioskAuth";
import DailyGoals from "./features/staff/pages/DailyGoals";
import TableManager from "./features/dining/pages/TableManager";
import TableFlowSettings from "./features/dining/pages/TableFlowSettings";
import KdsStations from "./features/dining/pages/KdsStations";
import ReceiptSettings from "./features/dining/pages/ReceiptSettings";
import DiningAnalyticsPage from "./features/dining/pages/DiningAnalyticsPage";
// @ts-ignore
import AccountPage from "./features/account/pages/AccountPage";
// @ts-ignore
import SupplierDirectory from './features/purchases/pages/SupplierDirectory';
// @ts-ignore
import SupplierDetails from './features/purchases/pages/SupplierDetails';
// @ts-ignore
import InventoryPage from './features/purchases/pages/InventoryPage';
// @ts-ignore
import ItemDetails from './features/purchases/pages/ItemDetails';
// @ts-ignore
import SmartOrderPage from './features/purchases/pages/SmartOrderPage';
// @ts-ignore
import PurchaseOrderForm from './features/purchases/pages/PurchaseOrderForm';
// @ts-ignore
import RegisterAdminPage from './features/purchases/pages/RegisterAdminPage';
// @ts-ignore
import SalesImportPage from './pages/SalesImportPage';
import WasteDashboardPage from './features/purchases/pages/WasteDashboardPage';
// @ts-ignore
import MenuIntelligencePage from './pages/MenuIntelligencePage';
import SalesAnalyticsPage from './pages/SalesAnalyticsPage';
import DeviceManager from './features/devices/pages/DeviceManager';

/**
 * Auth Guard — redirects to /login if not authenticated.
 * Shows a loading spinner while validating stored token.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useUserAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/**
 * Guest Guard — redirects to /dashboard if already authenticated.
 */
function RequireGuest({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useUserAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoot() {
  return (
    <div className="h-full w-full bg-black text-white">
      <AppQueryProvider>
        <BrowserRouter>
          <UserAuthProvider>
            <Routes>
              {/* ─── Public Routes (no layout, no auth) ──────────────────── */}
              <Route path="/login" element={<RequireGuest><LoginPage /></RequireGuest>} />
              <Route path="/register" element={<RequireGuest><RegisterPage /></RequireGuest>} />

              {/* ─── Standalone Apps (no layout, no HQ auth) ─────────────── */}
              <Route path="/staff/kiosk" element={<KioskAuth />} />

              {/* ─── Protected Routes (dashboard layout + auth guard) ───── */}
              <Route path="/" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="products" element={<ProductsPage />} />
                <Route path="products/:id" element={<ProductDetails />} />
                <Route path="staff" element={<AdminDashboard />} />
                <Route path="staff/employees" element={<EmployeeManager />} />
                <Route path="staff/schedule" element={<Scheduler />} />
                <Route path="staff/history" element={<ShiftHistory />} />
                <Route path="staff/roles" element={<RolesManager />} />
                <Route path="staff/goals" element={<DailyGoals />} />
                <Route path="account" element={<AccountPage />} />
                <Route path="settings" element={<Navigate to="/account" replace />} />
                <Route path="devices" element={<DeviceManager />} />
                {/* Purchase Module */}
                <Route path="purchases/suppliers" element={<SupplierDirectory />} />
                <Route path="purchases/suppliers/:id" element={<SupplierDetails />} />
                <Route path="purchases/menu-intelligence" element={<MenuIntelligencePage />} />
                <Route path="analytics/sales" element={<SalesAnalyticsPage />} />
                <Route path="purchases/inventory" element={<InventoryPage />} />
                <Route path="purchases/inventory/:id" element={<ItemDetails />} />
                <Route path="purchases/smart-order" element={<SmartOrderPage />} />
                <Route path="purchases/new" element={<PurchaseOrderForm />} />
                <Route path="purchases/import-sales" element={<SalesImportPage />} />
                <Route path="purchases/waste" element={<WasteDashboardPage />} />
                <Route path="register" element={<RegisterAdminPage />} />
                <Route path="dining/tables" element={<TableManager />} />
                <Route path="dining/flow" element={<TableFlowSettings />} />
                <Route path="dining/analytics" element={<DiningAnalyticsPage />} />
                <Route path="dining/kds-stations" element={<KdsStations />} />
                <Route path="dining/receipts" element={<ReceiptSettings />} />
              </Route>
            </Routes>
          </UserAuthProvider>
        </BrowserRouter>
      </AppQueryProvider>
    </div>
  );
}

export default AppRoot;
