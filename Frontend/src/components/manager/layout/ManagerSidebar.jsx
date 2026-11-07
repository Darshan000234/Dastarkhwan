import { NavLink } from "react-router-dom";
import {
  Activity,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  UserRound,
  Utensils,
} from "lucide-react";
const nav = [
  { to: "/manager", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/manager/kitchen", label: "Kitchen Display", icon: ChefHat },
  { to: "/manager/orders", label: "Orders", icon: ClipboardList },
  {
    to: "/manager/menu-availability",
    label: "Menu Availability",
    icon: Utensils,
  },
  { to: "/manager/performance", label: "Performance", icon: Activity },
  { to: "/manager/account", label: "My Account", icon: UserRound },
];
export default function ManagerSidebar({
  manager,
  outlet,
  onLogout,
  onNavigate,
  mobile = false,
}) {
  return (
    <div className={`om-sidebar-inner ${mobile ? "mobile" : ""}`}>
      <div className="om-brand">
        <span className="om-brand-mark">
          <ChefHat size={21} />
        </span>
        <span>
          <strong>Dastarkhwan</strong>
          <small>Outlet Manager</small>
        </span>
      </div>
      <div className="om-nav-label">MY OUTLET</div>
      <nav aria-label="Outlet manager navigation">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={onNavigate}>
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="om-sidebar-bottom">
        <div className="om-profile-mini">
          <span className="om-avatar">
            {(manager?.name || "M")
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")}
          </span>
          <span>
            <strong>{manager?.name || "Manager"}</strong>
            <small>{outlet?.name || "Assigned outlet"}</small>
          </span>
        </div>
        <button type="button" onClick={onLogout}>
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  );
}
