
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";
import { adminApi } from "../../../services/adminApi.js";
import { useAuth } from "../../../context/authContext.jsx";


export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [attentionCount, setAttentionCount] = useState(0);
  const [outletName, setOutletName] = useState("");

  const location = useLocation();
  const navigate = useNavigate();

  const { logout: authLogout } = useAuth();

  // Load the chain-wide attention count.
  useEffect(() => {
    let mounted = true;

    adminApi
      .getAdminOverview()
      .then((data) => {
        if (!mounted) return;

        const lateOrders = Array.isArray(data?.lateOrders)
          ? data.lateOrders
          : [];

        const paymentIssues = Array.isArray(data?.paymentIssues)
          ? data.paymentIssues
          : [];

        const outlets = Array.isArray(data?.outlets)
          ? data.outlets
          : [];

        const unavailableItems = Array.isArray(data?.unavailableItems)
          ? data.unavailableItems
          : [];

        setAttentionCount(
          lateOrders.length +
            paymentIssues.length +
            outlets.filter(
              (outlet) => !outlet.active || !outlet.manager,
            ).length +
            unavailableItems.length,
        );
      })
      .catch((error) => {
        if (!mounted) return;

        // Keep the last successfully loaded count.
        // The Admin layout must remain usable if this request fails.
        console.error(
          "Failed to load Admin attention count:",
          error,
        );
      });

    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  // Load the outlet name when viewing outlet details.
  useEffect(() => {
    const match = location.pathname.match(
      /^\/admin\/outlets\/([^/]+)/,
    );

    if (!match) {
      setOutletName("");
      return;
    }

    let mounted = true;

    // Avoid displaying the previous outlet's name while loading.
    setOutletName("Outlet details");

    adminApi
      .getOutletById(match[1])
      .then((outlet) => {
        if (!mounted) return;

        setOutletName(outlet?.name || "Outlet details");
      })
      .catch((error) => {
        if (!mounted) return;

        // Keep a safe fallback instead of breaking the layout.
        setOutletName("Outlet details");

        console.error(
          "Failed to load Admin outlet details:",
          error,
        );
      });

    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  const logout = async () => {
    try {
      await authLogout();
    } catch (error) {
      console.error("Admin logout failed:", error);
    } finally {
      navigate("/auth?mode=login", {
        replace: true,
      });
    }
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
            event.target === event.currentTarget &&
            setMobileOpen(false)
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
