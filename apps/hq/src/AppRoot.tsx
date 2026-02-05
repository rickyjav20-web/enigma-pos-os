import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "./components/layout/DashboardLayout";
import DashboardPage from "./pages/Dashboard";
import { AppQueryProvider } from "./components/providers/QueryProvider";
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
import KioskAuth from "./features/staff/pages/KioskAuth";
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

function AppRoot() {
  return (
    <div className="h-full w-full bg-black text-white">
      {/* Debug Overlay */}
      <div className="fixed top-0 right-0 p-2 bg-red-500 text-white z-[9999] text-xs font-mono pointer-events-none opacity-50">
        System V2.0 (Live)
      </div>
      <AppQueryProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="products/:id" element={<ProductDetails />} />
              <Route path="staff" element={<AdminDashboard />} />
              <Route path="staff/employees" element={<EmployeeManager />} />
              <Route path="staff/schedule" element={<Scheduler />} />
              <Route path="staff/history" element={<ShiftHistory />} />
              {/* REMOVED: KioskAuth moved to standalone route */}
              <Route path="account" element={<AccountPage />} />
              <Route path="settings" element={<Navigate to="/account" replace />} />
              {/* Purchase Module */}
              <Route path="purchases/suppliers" element={<SupplierDirectory />} />
              <Route path="purchases/suppliers/:id" element={<SupplierDetails />} />
              <Route path="purchases/inventory" element={<InventoryPage />} />
              <Route path="purchases/inventory/:id" element={<ItemDetails />} />
              <Route path="purchases/smart-order" element={<SmartOrderPage />} />
              <Route path="purchases/new" element={<PurchaseOrderForm />} />
            </Route>

            {/* Standalone Apps (No Layout) */}
            <Route path="/staff/kiosk" element={<KioskAuth />} />
          </Routes>
        </BrowserRouter>
      </AppQueryProvider>
    </div>
  );
}

export default AppRoot;
