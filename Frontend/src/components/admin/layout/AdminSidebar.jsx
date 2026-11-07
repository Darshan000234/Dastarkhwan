import { NavLink } from "react-router-dom";
import {
  ChefHat,
  LayoutDashboard,
  ShoppingBag,
  Store,
  Utensils,
  Settings,
  LogOut,
} from "lucide-react";

const items = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/outlets", label: "Outlets", icon: Store },
  { to: "/admin/menu", label: "Menu management", icon: Utensils },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminSidebar({ onNavigate, onLogout, mobile = false }) {
  return (
    <div
      className={`ad-sidebar-inner ${mobile ? "ad-sidebar-inner-mobile" : ""}`}
    >
      <div className="ad-brand">
        <span className="ad-brand-mark">
          <ChefHat size={20} />
        </span>
        <span>
          <strong>Dastarkhwan</strong>
          <small>Central Admin</small>
        </span>
      </div>
      <div className="ad-nav-label">WORKSPACE</div>
      <nav className="ad-sidebar-nav" aria-label="Admin navigation">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={onNavigate}>
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="ad-sidebar-bottom">
        <div className="ad-admin-profile">
          <span className="ad-avatar">MT</span>
          <span>
            <strong>Mihir Tathe</strong>
            <small>Central Admin · Demo</small>
          </span>
        </div>
        <button type="button" onClick={onLogout} className="ad-logout">
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  );
}
