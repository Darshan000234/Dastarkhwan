import { Navigate, Route, Routes } from "react-router-dom";
import { ManagerProvider } from "../context/ManagerContext";
import ManagerLayout from "../components/manager/layout/ManagerLayout";
import ManagerOverviewPage from "../components/manager/overview/ManagerOverviewPage";
import KitchenDisplayPage from "../components/manager/kitchen/KitchenDisplayPage";
import ManagerOrdersPage from "../components/manager/orders/ManagerOrdersPage";
import MenuAvailabilityPage from "../components/manager/menu/MenuAvailabilityPage";
import OutletPerformancePage from "../components/manager/performance/OutletPerformancePage";
import ManagerAccountPage from "../components/manager/account/ManagerAccountPage";
export default function OutletManagerDashboard() {
  return (
    <ManagerProvider>
      <Routes>
        <Route element={<ManagerLayout />}>
          <Route index element={<ManagerOverviewPage />} />
          <Route path="kitchen" element={<KitchenDisplayPage />} />
          <Route path="kitchen/fullscreen" element={<KitchenDisplayPage />} />
          <Route path="orders" element={<ManagerOrdersPage />} />
          <Route path="orders/:orderId" element={<ManagerOrdersPage />} />
          <Route path="menu-availability" element={<MenuAvailabilityPage />} />
          <Route path="performance" element={<OutletPerformancePage />} />
          <Route path="account" element={<ManagerAccountPage />} />
          <Route path="*" element={<Navigate to="/manager" replace />} />
        </Route>
      </Routes>
    </ManagerProvider>
  );
}
