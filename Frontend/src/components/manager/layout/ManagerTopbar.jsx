import { useLocation, Link } from "react-router-dom";
import { Bell, Menu, Store } from "lucide-react";
const titles = [
  ["/manager/kitchen", "Kitchen Display"],
  ["/manager/orders", "Orders"],
  ["/manager/menu-availability", "Menu Availability"],
  ["/manager/performance", "Outlet Performance"],
  ["/manager/account", "My Account"],
];
export default function ManagerTopbar({ outlet, attentionCount, onMenuClick }) {
  const { pathname } = useLocation();
  const title =
    titles.find(([path]) => pathname.startsWith(path))?.[1] ||
    "Outlet Overview";
  return (
    <header className="om-topbar">
      <div className="om-topbar-left">
        <button
          className="om-mobile-menu"
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div>
          <small>OUTLET OPERATIONS</small>
          <strong>{title}</strong>
        </div>
      </div>
      <div className="om-topbar-right">
        <span className="om-outlet-chip">
          <Store size={15} />
          {outlet?.name}
        </span>
        <span className="om-demo-pill">Demo mode · Local updates</span>
        <Link
          to="/manager/kitchen"
          className="om-alert-icon"
          aria-label="Open kitchen alerts"
        >
          <Bell size={18} />
          {attentionCount > 0 && <i>{Math.min(attentionCount, 99)}</i>}
        </Link>
      </div>
    </header>
  );
}
