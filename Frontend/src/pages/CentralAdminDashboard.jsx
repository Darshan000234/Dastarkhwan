import { Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "../components/admin/layout/AdminLayout";
import OverviewPage from "../components/admin/overview/OverviewPage";
import OrdersPage from "../components/admin/orders/OrdersPage";
import OutletsPage from "../components/admin/outlets/OutletsPage";
import OutletDetailsPage from "../components/admin/outlets/OutletDetailsPage";
import MenuManagementPage from "../components/admin/menu/MenuManagementPage";
import SettingsPage from "../components/admin/settings/SettingsPage";

// This component is mounted at /admin/* in the application's main route tree.
// A pathless layout route keeps these child paths relative to that /admin base.
export default function CentralAdminDashboard() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="outlets" element={<OutletsPage />} />
        <Route path="outlets/:outletId" element={<OutletDetailsPage />} />
        <Route path="menu" element={<MenuManagementPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
