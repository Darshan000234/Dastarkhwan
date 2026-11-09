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
import { useAuth } from "../../../context/authContext.jsx";

export default function CustomerNavbar({
  onOpenCart,
  onOpenLocation,
  onSearch,
}) {
  const {
    selectedPincode,
    selectedOutletId,
    outlets,
    cart,
    profile,
    notify,
  } = useCustomer();

  const { logout } = useAuth();

  const navigate = useNavigate();

  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const outlet = outlets.find(
    (entry) => entry.id === selectedOutletId,
  );

  const count = cart.reduce(
    (sum, line) => sum + Number(line.quantity || 0),
    0,
  );

  const links = [
    { to: "/customer", label: "Menu", end: true },
    { to: "/customer/orders", label: "My orders" },
    { to: "/customer/rewards", label: "Rewards" },
    { to: "/customer/catering", label: "Party & Catering" },
  ];

  const signOut = async () => {
    if (signingOut) return;

    setSigningOut(true);

    try {
      await logout();

      setProfileOpen(false);
      setMobileOpen(false);

      navigate("/login", {
        replace: true,
      });
    } catch (error) {
      /*
       * AuthContext should clear local user state even if the
       * backend logout request fails. Do not leave the menu open.
       */
      setProfileOpen(false);

      notify(
        error.message || "Could not complete sign out.",
        "error",
      );

      navigate("/login", {
        replace: true,
      });
    } finally {
      setSigningOut(false);
    }
  };

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

        <nav
          className={`cu-nav-links ${
            mobileOpen ? "is-open" : ""
          }`}
        >
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
          <button
            className="cu-location-trigger"
            onClick={onOpenLocation}
            type="button"
          >
            <MapPin size={15} />

            <span>
              <small>DELIVER TO</small>

              <strong>
                {selectedPincode || "Add pincode"}
              </strong>

              <em>
                {outlet?.name || "Choose location"}
              </em>
            </span>

            <ChevronDown size={13} />
          </button>

          <button
            className="cu-icon-button cu-search-button"
            onClick={onSearch}
            aria-label="Search menu"
            type="button"
          >
            <Search size={19} />
          </button>

          <button
            className="cu-icon-button cu-cart-button"
            onClick={onOpenCart}
            aria-label={`Cart with ${count} items`}
            type="button"
          >
            <ShoppingBag size={19} />

            {count > 0 && <i>{count}</i>}
          </button>

          <div className="cu-profile-wrap">
            <button
              className="cu-icon-button"
              onClick={() =>
                setProfileOpen((current) => !current)
              }
              aria-label="Open profile menu"
              aria-expanded={profileOpen}
              type="button"
            >
              <UserRound size={18} />
            </button>

            {profileOpen && (
              <div className="cu-profile-menu">
                <strong>
                  {profile?.name || "Your account"}
                </strong>

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
                  onClick={signOut}
                  disabled={signingOut}
                  type="button"
                >
                  {signingOut
                    ? "Signing out…"
                    : "Sign out"}
                </button>
              </div>
            )}
          </div>

          <button
            className="cu-mobile-menu"
            onClick={() =>
              setMobileOpen((current) => !current)
            }
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
            type="button"
          >
            {mobileOpen ? (
              <X size={21} />
            ) : (
              <Menu size={21} />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}