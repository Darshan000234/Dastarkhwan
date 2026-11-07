import { Navigate, Route, Routes } from "react-router-dom";
import { CustomerProvider, useCustomer } from "../context/CustomerContext";
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

function CustomerRoutes() {
  const { loading } = useCustomer();
  if (loading) return <div className="cu-initial-loading"><span className="cu-brand-mark">D</span><strong>Dastarkhwan</strong><small>Preparing your table…</small></div>;
  return <Routes><Route element={<CustomerLayout />}>
    <Route index element={<MenuPage />} />
    <Route path="menu" element={<MenuPage />} />
    <Route path="checkout" element={<CheckoutPage />} />
    <Route path="payment" element={<PaymentPage />} />
    <Route path="order/:orderId" element={<OrderTrackingPage />} />
    <Route path="orders" element={<MyOrdersPage />} />
    <Route path="profile" element={<ProfilePage />} />
    <Route path="addresses" element={<AddressBookPage />} />
    <Route path="rewards" element={<RewardsPage />} />
    <Route path="catering" element={<CateringPage />} />
    <Route path="*" element={<Navigate to="/customer" replace />} />
  </Route></Routes>;
}

export default function CustomerDashboard() {
  return <CustomerProvider><CustomerRoutes /></CustomerProvider>;
}
