import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import CustomerNavbar from "./CustomerNavbar";
import CustomerFooter from "./CustomerFooter";
import CartDrawer from "../cart/CartDrawer";
import LocationModal from "../location/LocationModal";
import Toast from "../common/Toast";
import { useCustomer } from "../../../context/CustomerContext";
import { X } from "lucide-react";

export default function CustomerLayout() {
  const [cartOpen, setCartOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const navigate = useNavigate();
  const {
    pendingLocation,
    confirmLocationSwitch,
    cancelLocationSwitch,
    toast,
    setToast,
    loading,
  } = useCustomer();
  useEffect(() => {
    const openLocation = () => setLocationOpen(true);
    const openCart = () => setCartOpen(true);
    window.addEventListener("dastarkhwan:open-location", openLocation);
    window.addEventListener("dastarkhwan:open-cart", openCart);
    return () => {
      window.removeEventListener("dastarkhwan:open-location", openLocation);
      window.removeEventListener("dastarkhwan:open-cart", openCart);
    };
  }, []);
  if (loading)
    return (
      <div className="cu-initial-loading">
        <span className="cu-brand-mark">D</span>
        <strong>Dastarkhwan</strong>
        <small>Preparing your table…</small>
      </div>
    );
  return (
    <div className="cu-app-shell">
      <CustomerNavbar
        onOpenCart={() => setCartOpen(true)}
        onOpenLocation={() => setLocationOpen(true)}
        onSearch={() => navigate("/customer?focusSearch=1")}
      />
      <main className="cu-main">
        <Outlet />
      </main>
      <CustomerFooter />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <LocationModal
        open={locationOpen}
        onClose={() => setLocationOpen(false)}
      />
      {pendingLocation && (
        <div className="cu-overlay cu-switch-overlay">
          <section className="cu-modal cu-switch-modal">
            <button
              className="cu-modal-close"
              onClick={cancelLocationSwitch}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <span className="cu-eyebrow">DELIVERY LOCATION CHANGED</span>
            <h2>Switch kitchens?</h2>
            <p>
              Your cart contains food from another outlet. The cart cannot
              contain items from two kitchens.
            </p>
            <div className="cu-switch-actions">
              <button
                className="cu-button"
                onClick={async () => {
                  await confirmLocationSwitch();
                  setLocationOpen(false);
                }}
              >
                Clear cart and switch
              </button>
              <button
                className="cu-button-secondary"
                onClick={() => {
                  cancelLocationSwitch();
                  setLocationOpen(false);
                }}
              >
                Keep current location
              </button>
            </div>
          </section>
        </div>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
