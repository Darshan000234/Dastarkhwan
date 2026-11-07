import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";
import { mockApi } from "../../../services/mockApi";

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [attentionCount, setAttentionCount] = useState(0);
  const [outletName, setOutletName] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    mockApi.getAdminOverview().then((data) => {
      if (!mounted) return;
      setAttentionCount(
        data.lateOrders.length +
          data.paymentIssues.length +
          data.outlets.filter((outlet) => !outlet.active || !outlet.manager)
            .length +
          data.unavailableItems.length,
      );
    });
    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    const match = location.pathname.match(/^\/admin\/outlets\/([^/]+)/);
    if (!match) {
      setOutletName("");
      return;
    }
    let mounted = true;
    mockApi.getOutletById(match[1]).then((outlet) => {
      if (mounted) setOutletName(outlet?.name || "Outlet details");
    });
    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  const logout = () => {
    try {
      sessionStorage.removeItem("demo_auth_session");
    } catch {
      /* ignore */
    }
    navigate("/auth?mode=login", { replace: true });
  };

  return (
    <div className="ad-app-shell">
      <aside className="ad-sidebar">
        <AdminSidebar onLogout={logout} />
      </aside>
      {mobileOpen && (
        <div
          className="ad-mobile-overlay"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setMobileOpen(false)
          }
        >
          <aside className="ad-mobile-sidebar">
            <button
              type="button"
              className="ad-mobile-close"
              onClick={() => setMobileOpen(false)}
            >
              Close
            </button>
            <AdminSidebar
              mobile
              onNavigate={() => setMobileOpen(false)}
              onLogout={logout}
            />
          </aside>
        </div>
      )}
      <div className="ad-main-shell">
        <AdminTopbar
          pathname={location.pathname}
          outletName={outletName}
          onMenuClick={() => setMobileOpen(true)}
          attentionCount={attentionCount}
          onLogout={logout}
        />
        <main className="ad-content">
          <Outlet />
        </main>
        <footer className="ad-app-footer">
          <span>© {new Date().getFullYear()} Dastarkhwan</span>
          <span>Central operations · Illustrative prototype</span>
          <Link to="/">View customer website</Link>
        </footer>
      </div>
    </div>
  );
}
