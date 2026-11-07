import { Navigate } from "react-router-dom";

export default function RoleGate({ role, children }) {
  let session = null;
  try {
    session = JSON.parse(sessionStorage.getItem("demo_auth_session") || "null");
  } catch {
    session = null;
  }
  if (!session?.role) return <Navigate to="/auth?mode=staff" replace />;
  if (session.role !== role) {
    if (session.role === "outlet_manager")
      return <Navigate to="/manager" replace />;
    if (session.role === "central_admin")
      return <Navigate to="/admin" replace />;
    return <Navigate to="/auth?mode=staff" replace />;
  }
  return children;
}
