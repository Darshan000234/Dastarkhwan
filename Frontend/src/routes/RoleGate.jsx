import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/authContext.jsx";

const ROLE_HOME = {
  customer: "/customer",
  outlet_manager: "/manager",
  central_admin: "/admin",
};

export default function RoleGate({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          color: "#716d65",
          fontSize: 14,
        }}
      >
        Checking your session...
      </div>
    );
  }

  if (!user) {
    const loginPath =
      role === "customer" ? "/login" : "/staff-login";

    return (
      <Navigate
        to={loginPath}
        replace
        state={{ from: location }}
      />
    );
  }

  if (user.role !== role) {
    return (
      <Navigate
        to={ROLE_HOME[user.role] || "/auth"}
        replace
      />
    );
  }

  return children;
}