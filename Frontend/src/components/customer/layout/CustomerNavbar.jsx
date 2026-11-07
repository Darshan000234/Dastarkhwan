import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  MapPin,
  Search,
  ShoppingBag,
  UserRound,
  ChevronDown,
  Menu,
  X,
  Gift,
} from "lucide-react";
import { useCustomer } from "../../../context/CustomerContext";

export default function CustomerNavbar({
  onOpenCart,
  onOpenLocation,
  onSearch,
}) {
  const { selectedPincode, selectedOutletId, outlets, cart, profile } =
    useCustomer();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const outlet = outlets.find((entry) => entry.id === selectedOutletId);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const links = [
    { to: "/customer", label: "Menu", end: true },
    { to: "/customer/orders", label: "My orders" },
    { to: "/customer/rewards", label: "Rewards" },
    { to: "/customer/catering", label: "Party & Catering" },
  ];
  return (
    <header className="cu-navbar">
      <div className="cu-nav-inner">
        <Link to="/" className="cu-brand">
          <span className="cu-brand-mark">D</span>
          <span>
            <strong>Dastarkhwan</strong>
            <small>HYDERABADI KITCHEN</small>
          </span>
        </Link>
        <nav className={`cu-nav-links ${mobileOpen ? "is-open" : ""}`}>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="cu-nav-actions">
          <button className="cu-location-trigger" onClick={onOpenLocation}>
            <MapPin size={15} />
            <span>
              <small>DELIVER TO</small>
              <strong>{selectedPincode || "Add pincode"}</strong>
              <em>{outlet?.name || "Choose location"}</em>
            </span>
            <ChevronDown size={13} />
          </button>
          <button
            className="cu-icon-button cu-search-button"
            onClick={onSearch}
            aria-label="Search menu"
          >
            <Search size={19} />
          </button>
          <button
            className="cu-icon-button cu-cart-button"
            onClick={onOpenCart}
            aria-label={`Cart with ${count} items`}
          >
            <ShoppingBag size={19} />
            {count > 0 && <i>{count}</i>}
          </button>
          <div className="cu-profile-wrap">
            <button
              className="cu-icon-button"
              onClick={() => setProfileOpen((v) => !v)}
              aria-label="Open profile menu"
            >
              <UserRound size={18} />
            </button>
            {profileOpen && (
              <div className="cu-profile-menu">
                <strong>{profile?.name || "Your account"}</strong>
                <Link
                  onClick={() => setProfileOpen(false)}
                  to="/customer/profile"
                >
                  My profile
                </Link>
                <Link
                  onClick={() => setProfileOpen(false)}
                  to="/customer/addresses"
                >
                  Saved addresses
                </Link>
                <Link
                  onClick={() => setProfileOpen(false)}
                  to="/customer/rewards"
                >
                  <Gift size={14} /> Rewards
                </Link>
                <button
                  className="cu-profile-signout"
                  onClick={() => {
                    try {
                      sessionStorage.removeItem("demo_auth_session");
                    } catch {
                      /* ignored */
                    }
                    setProfileOpen(false);
                    navigate("/auth?mode=login");
                  }}
                >
                  Sign out / Switch account
                </button>
              </div>
            )}
          </div>
          <button
            className="cu-mobile-menu"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
    </header>
  );
}
