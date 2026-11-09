import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import HomeDashboard from "./components/HomePage";
import SignupLogin from "./components/SignupLogin";

import CentralAdminDashboard from "./pages/CentralAdminDashboard";
import CustomerDashboard from "./pages/CustomerDashboard";
import OutletManagerDashboard from "./pages/OutletManagerDashboard";

import RoleGate from "./routes/RoleGate";

import "./App.css";
import "./styles/admin.css";
import "./styles/customer.css";
import "./styles/manager.css";

function CustomerLegacyRedirect({ to = "/customer" }) {
  const location = useLocation();

  return (
    <Navigate
      to={`${to}${location.search}${location.hash}`}
      replace
    />
  );
}

function LegacyOutletRedirect() {
  const location = useLocation();

  const remainingPath = location.pathname.replace(
    /^\/outlet(?=\/|$)/,
    "",
  );

  return (
    <Navigate
      to={`/manager${remainingPath}${location.search}${location.hash}`}
      replace
    />
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeDashboard />} />

        <Route path="/auth" element={<SignupLogin />} />

        <Route
          path="/login"
          element={<SignupLogin initialMode="login" />}
        />

        <Route
          path="/signup"
          element={<SignupLogin initialMode="signup" />}
        />

        <Route
          path="/staff-login"
          element={<SignupLogin initialMode="staff" />}
        />

        <Route
          path="/order"
          element={<CustomerLegacyRedirect />}
        />

        <Route
          path="/menu"
          element={<CustomerLegacyRedirect />}
        />

        <Route
          path="/catering"
          element={
            <CustomerLegacyRedirect to="/customer/catering" />
          }
        />

        {/* Menu is public. Customer-only routes are guarded
            inside CustomerDashboard. */}
        <Route
          path="/customer/*"
          element={<CustomerDashboard />}
        />

        <Route
          path="/admin/*"
          element={
            <RoleGate role="central_admin">
              <CentralAdminDashboard />
            </RoleGate>
          }
        />

        <Route
          path="/outlet/*"
          element={<LegacyOutletRedirect />}
        />

        <Route
          path="/manager/*"
          element={
            <RoleGate role="outlet_manager">
              <OutletManagerDashboard />
            </RoleGate>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;