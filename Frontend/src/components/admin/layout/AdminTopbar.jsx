import { useState } from "react";
import { Bell, ChevronDown, LogOut, Menu, UserRound } from "lucide-react";

const titles = {
  "/admin": "Overview",
  "/admin/orders": "Orders",
  "/admin/outlets": "Outlets",
  "/admin/menu": "Menu management",
  "/admin/settings": "Settings",
};

export default function AdminTopbar({
  pathname,
  outletName,
  onMenuClick,
  attentionCount = 0,
  onLogout,
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const title = pathname.includes("/admin/outlets/")
    ? outletName || "Outlet details"
    : titles[pathname] || "Central Admin";
  return (
    <header className="ad-topbar">
      <div className="ad-topbar-left">
        <button
          type="button"
          className="ad-mobile-menu"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <div>
          <span className="ad-topbar-kicker">DASTARKHWAN / OPERATIONS</span>
          <div className="ad-topbar-title">{title}</div>
        </div>
      </div>
      <div className="ad-topbar-right">
        <span className="ad-environment">
          <i /> DEMO ENVIRONMENT
        </span>
        <div className="ad-notification-wrap">
          <span
            className="ad-icon-button"
            aria-label={`${attentionCount} items need attention`}
            title="Attention required"
          >
            <Bell size={18} />
            {attentionCount > 0 && <i />}
          </span>
          {attentionCount > 0 && (
            <span className="ad-notification-count">{attentionCount}</span>
          )}
        </div>
        <div className="ad-profile-menu-wrap">
          <button
            type="button"
            className="ad-top-profile"
            onClick={() => setProfileOpen((value) => !value)}
          >
            <span className="ad-avatar">MT</span>
            <span>
              <strong>Mihir Tathe</strong>
              <small>Central Admin</small>
            </span>
            <ChevronDown size={14} />
          </button>
          {profileOpen && (
            <div className="ad-profile-popover">
              <div>
                <UserRound size={15} /> Mihir Tathe
              </div>
              <button type="button" onClick={onLogout}>
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
