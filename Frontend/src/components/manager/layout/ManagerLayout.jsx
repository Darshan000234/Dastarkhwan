import { useState } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { useManager } from "../../../context/ManagerContext";
import ManagerSidebar from "./ManagerSidebar";
import ManagerTopbar from "./ManagerTopbar";
export default function ManagerLayout() {
  const { loading, error, outlet, manager, overview } = useManager();
  const [mobileOpen, setMobileOpen] = useState(false);


  const navigate = useNavigate();
  const logout = () => {
    try {
      sessionStorage.removeItem("demo_auth_session");
    } catch {
      /* storage disabled */
    }
    navigate("/auth?mode=staff", { replace: true });
  };
  if (loading)
    return (
      <div className="om-gate">
        <span className="om-brand-mark">
          <span>D</span>
        </span>
        <strong>Loading your outlet workspace…</strong>
      </div>
    );
  if (error || !outlet || !manager)
    return (
      <div className="om-gate">
        <strong>Outlet Manager access required</strong>
        <p>{error || "Sign in with your assigned manager account."}</p>
        <button
          type="button"
          onClick={() => navigate("/auth?mode=staff", { replace: true })}
        >
          Go to staff sign in
        </button>
      </div>
    );
  return (
    <div className="om-app-shell">
      <aside className="om-sidebar">
        <ManagerSidebar manager={manager} outlet={outlet} onLogout={logout} />
      </aside>
      {mobileOpen && (
        <div
          className="om-mobile-overlay"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setMobileOpen(false)
          }
        >
          <aside className="om-mobile-sidebar">
            <button
              className="om-mobile-close"
              onClick={() => setMobileOpen(false)}
            >
              Close
            </button>
            <ManagerSidebar
              manager={manager}
              outlet={outlet}
              onLogout={logout}
              onNavigate={() => setMobileOpen(false)}
              mobile
            />
          </aside>
        </div>
      )}
      <div className="om-main-shell">
        <ManagerTopbar
          outlet={outlet}
          attentionCount={overview?.attention?.length || 0}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="om-content">
          <Outlet />
        </main>
        <footer className="om-footer">
          <span>© {new Date().getFullYear()} Dastarkhwan</span>
          <span>Outlet operations · Illustrative frontend prototype</span>
        </footer>
      </div>
    </div>
  );
}
