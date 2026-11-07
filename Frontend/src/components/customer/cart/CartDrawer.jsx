import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingBag, X, Trash2, ArrowRight } from "lucide-react";
import { useCustomer } from "../../../context/CustomerContext";
import { mockCustomerApi } from "../../../services/mockCustomerApi";
import {
  calculateCartTotals,
  cartLineKey,
  currency,
} from "../../../utils/customerPricing";
import QuantitySelector from "../common/QuantitySelector";
import FoodImage from "../common/FoodImage";

export default function CartDrawer({ open, onClose }) {
  const {
    cart,
    changeQuantity,
    removeCartLine,
    couponCode,
    loyaltyRedeemPoints,
    selectedOutletId,
    outlets,
    notify,
  } = useCustomer();
  const [totals, setTotals] = useState(calculateCartTotals([]));
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    mockCustomerApi
      .calculateCartTotal(
        cart,
        couponCode,
        loyaltyRedeemPoints,
        selectedOutletId,
      )
      .then((value) => {
        if (active) setTotals(value);
      })
      .catch(() => {
        if (active) setTotals(calculateCartTotals(cart));
      });
    return () => {
      active = false;
    };
  }, [cart, couponCode, loyaltyRedeemPoints, selectedOutletId]);
  if (!open) return null;
  const outlet = outlets.find((entry) => entry.id === selectedOutletId);
  return (
    <div
      className="cu-drawer-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside className="cu-cart-drawer" aria-label="Your cart">
        <header>
          <div>
            <span className="cu-eyebrow">YOUR ORDER</span>
            <h2>Your table is waiting.</h2>
            <small>{outlet?.name || "Choose a delivery outlet"}</small>
          </div>
          <button
            className="cu-modal-close"
            onClick={onClose}
            aria-label="Close cart"
          >
            <X size={19} />
          </button>
        </header>
        {cart.length === 0 ? (
          <div className="cu-drawer-empty">
            <span>
              <ShoppingBag size={30} />
            </span>
            <h3>Your cart is empty</h3>
            <p>Find something delicious from your selected kitchen.</p>
            <button
              className="cu-button"
              onClick={() => {
                onClose();
                navigate("/customer");
              }}
            >
              Explore menu
            </button>
          </div>
        ) : (
          <>
            <div className="cu-cart-lines">
              {cart.map((line) => (
                <article className="cu-cart-line" key={cartLineKey(line)}>
                  <FoodImage src={line.image} alt={line.name} />
                  <div className="cu-cart-line-main">
                    <strong>{line.name}</strong>
                    <small>
                      {line.portion}
                      {line.addons?.length
                        ? ` · ${line.addons.map((item) => item.name).join(", ")}`
                        : ""}
                    </small>
                    <div className="cu-cart-line-bottom">
                      <QuantitySelector
                        value={line.quantity}
                        onChange={(next) =>
                          changeQuantity(
                            cartLineKey(line),
                            next - line.quantity,
                          )
                        }
                      />
                      <strong>
                        {currency(line.unitPrice * line.quantity)}
                      </strong>
                    </div>
                  </div>
                  <button
                    className="cu-remove-line"
                    onClick={() => removeCartLine(cartLineKey(line))}
                    aria-label={`Remove ${line.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </article>
              ))}
            </div>
            <div className="cu-cart-summary">
              <div>
                <span>Item subtotal</span>
                <strong>{currency(totals.subtotal)}</strong>
              </div>
              {totals.couponDiscount > 0 && (
                <div className="is-discount">
                  <span>Coupon {couponCode}</span>
                  <strong>−{currency(totals.couponDiscount)}</strong>
                </div>
              )}
              {totals.loyaltyDiscount > 0 && (
                <div className="is-discount">
                  <span>Rewards redeemed</span>
                  <strong>−{currency(totals.loyaltyDiscount)}</strong>
                </div>
              )}
              <div>
                <span>Delivery fee</span>
                <strong>
                  {totals.deliveryFee ? currency(totals.deliveryFee) : "FREE"}
                </strong>
              </div>
              <div className="cu-grand-total">
                <span>Total</span>
                <strong>{currency(totals.total)}</strong>
              </div>
              <small>
                Prices inclusive of 5% GST. No additional GST is added.
              </small>
              <button
                className="cu-button cu-button-wide"
                onClick={() => {
                  if (!totals.valid && totals.errors?.length) {
                    notify(totals.errors.join(" "), "error");
                    return;
                  }
                  onClose();
                  navigate("/customer/checkout");
                }}
              >
                Continue to checkout <ArrowRight size={17} />
              </button>
              <Link className="cu-text-link" to="/customer" onClick={onClose}>
                Continue browsing
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
