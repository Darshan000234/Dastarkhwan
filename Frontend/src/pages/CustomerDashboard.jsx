import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { CustomerProvider, useCustomer } from "../context/CustomerContext";
import { useAuth } from "../context/authContext.jsx";

import CustomerLayout from "../components/customer/layout/CustomerLayout";
import MenuPage from "../components/customer/menu/MenuPage";
import CheckoutPage from "../components/customer/checkout/CheckoutPage";
import PaymentPage from "../components/customer/payment/PaymentPage";
import OrderTrackingPage from "../components/customer/orders/OrderTrackingPage";
import MyOrdersPage from "../components/customer/orders/MyOrdersPage";
import ProfilePage from "../components/customer/profile/ProfilePage";
import AddressBookPage from "../components/customer/profile/AddressBookPage";
import RewardsPage from "../components/customer/profile/RewardsPage";
import CateringPage from "../components/customer/catering/CateringPage";

const ROLE_HOME = {
  customer: "/customer",
  outlet_manager: "/manager",
  central_admin: "/admin",
};

function CustomerOnly({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="cu-initial-loading">
        <span className="cu-brand-mark">D</span>
        <strong>Dastarkhwan</strong>
        <small>Checking your account…</small>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  if (user.role !== "customer") {
    return (
      <Navigate
        to={ROLE_HOME[user.role] || "/auth"}
        replace
      />
    );
  }

  return children;
}

function CustomerRoutes() {
  const { loading, loadError } = useCustomer();

  if (loading) {
    return (
      <div className="cu-initial-loading">
        <span className="cu-brand-mark">D</span>
        <strong>Dastarkhwan</strong>
        <small>Preparing your table…</small>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="cu-page cu-empty-page">
        <h2>Unable to load your customer account.</h2>
        <p>{loadError}</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        {/* Public menu browsing */}
        <Route index element={<MenuPage />} />
        <Route path="menu" element={<MenuPage />} />

        {/* Customer-only routes */}
        <Route
          path="checkout"
          element={
            <CustomerOnly>
              <CheckoutPage />
            </CustomerOnly>
          }
        />

        <Route
          path="payment"
          element={
            <CustomerOnly>
              <PaymentPage />
            </CustomerOnly>
          }
        />

        <Route
          path="order/:orderId"
          element={
            <CustomerOnly>
              <OrderTrackingPage />
            </CustomerOnly>
          }
        />

        <Route
          path="orders"
          element={
            <CustomerOnly>
              <MyOrdersPage />
            </CustomerOnly>
          }
        />

        <Route
          path="profile"
          element={
            <CustomerOnly>
              <ProfilePage />
            </CustomerOnly>
          }
        />

        <Route
          path="addresses"
          element={
            <CustomerOnly>
              <AddressBookPage />
            </CustomerOnly>
          }
        />

        <Route
          path="rewards"
          element={
            <CustomerOnly>
              <RewardsPage />
            </CustomerOnly>
          }
        />

        <Route
          path="catering"
          element={
            <CustomerOnly>
              <CateringPage />
            </CustomerOnly>
          }
        />

        <Route
          path="*"
          element={<Navigate to="/customer" replace />}
        />
      </Route>
    </Routes>
  );
}

export default function CustomerDashboard() {
  return (
    <CustomerProvider>
      <CustomerRoutes />
    </CustomerProvider>
  );
}