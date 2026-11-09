import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShoppingBag,
  X,
  Trash2,
  ArrowRight,
} from "lucide-react";

import { useCustomer } from "../../../context/CustomerContext";
import { cartLineKey, currency } from "../../../utils/customerPricing";

import QuantitySelector from "../common/QuantitySelector";
import FoodImage from "../common/FoodImage";

export default function CartDrawer({ open, onClose }) {
  const {
    cart,
    changeQuantity,
    removeCartLine,
    selectedOutletId,
    selectedAddressId,
    outlets,
    cartQuote,
    refreshQuote,
    notify,
  } = useCustomer();

  const [quoteError, setQuoteError] = useState("");

  const navigate = useNavigate();

  const outlet = outlets.find(
    (entry) => entry.id === selectedOutletId,
  );

  useEffect(() => {
    if (!open || !cart.length) return undefined;

    let active = true;

    refreshQuote({
      addressId: selectedAddressId,
    })
      .then(() => {
        if (active) {
          setQuoteError("");
        }
      })
      .catch((error) => {
        if (active) {
          setQuoteError(error.message || "Unable to calculate your cart.");
        }
      });

    return () => {
      active = false;
    };
  }, [
    open,
    cart,
    selectedAddressId,
    refreshQuote,
  ]);

  if (!open) return null;

  const canCheckout =
    cart.length > 0 &&
    Boolean(cartQuote?.valid) &&
    !quoteError;

  return (
    <div
      className="cu-drawer-backdrop"
      onMouseDown={(event) =>
        event.target === event.currentTarget && onClose()
      }
    >
      <aside className="cu-cart-drawer" aria-label="Your cart">
        <header>
          <div>
            <span className="cu-eyebrow">YOUR ORDER</span>
            <h2>Your table is waiting.</h2>
            <small>
              {outlet?.name || "Choose a delivery outlet"}
            </small>
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

            <p>
              Find something delicious from your selected kitchen.
            </p>

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
                <article
                  className="cu-cart-line"
                  key={cartLineKey(line)}
                >
                  <FoodImage
                    src={line.image}
                    alt={line.name}
                  />

                  <div className="cu-cart-line-main">
                    <strong>{line.name}</strong>

                    <small>
                      {line.portion}
                      {line.addons?.length
                        ? ` · ${line.addons
                            .map((item) => item.name)
                            .join(", ")}`
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
                        {currency(
                          Number(line.unitPrice || 0) *
                            line.quantity,
                        )}
                      </strong>
                    </div>
                  </div>

                  <button
                    className="cu-remove-line"
                    onClick={() =>
                      removeCartLine(cartLineKey(line))
                    }
                    aria-label={`Remove ${line.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </article>
              ))}
            </div>

            <div className="cu-cart-summary">
              {quoteError ? (
                <p className="cu-form-error">
                  {quoteError}
                </p>
              ) : !cartQuote ? (
                <p className="cu-muted">
                  Calculating your cart using current outlet prices…
                </p>
              ) : (
                <>
                  <div>
                    <span>Item subtotal</span>
                    <strong>
                      {currency(cartQuote.subtotal)}
                    </strong>
                  </div>

                  {Number(cartQuote.couponDiscount) > 0 && (
                    <div className="is-discount">
                      <span>Coupon {cartQuote.couponCode}</span>
                      <strong>
                        −{currency(cartQuote.couponDiscount)}
                      </strong>
                    </div>
                  )}

                  {Number(cartQuote.loyaltyDiscount) > 0 && (
                    <div className="is-discount">
                      <span>Rewards redeemed</span>
                      <strong>
                        −{currency(cartQuote.loyaltyDiscount)}
                      </strong>
                    </div>
                  )}

                  <div>
                    <span>Delivery fee</span>
                    <strong>
                      {Number(cartQuote.deliveryFee)
                        ? currency(cartQuote.deliveryFee)
                        : "FREE"}
                    </strong>
                  </div>

                  <div className="cu-grand-total">
                    <span>Total</span>
                    <strong>
                      {currency(cartQuote.total)}
                    </strong>
                  </div>

                  <small>
                    {cartQuote.gstInclusive
                      ? "Prices inclusive of GST. No additional GST is added."
                      : "Tax is included as shown in the server quote."}
                  </small>
                </>
              )}

              <button
                className="cu-button cu-button-wide"
                disabled={!canCheckout}
                onClick={() => {
                  if (!canCheckout) {
                    notify(
                      quoteError ||
                        "Wait for the backend cart quote before checkout.",
                      "error",
                    );
                    return;
                  }

                  onClose();
                  navigate("/customer/checkout");
                }}
              >
                Continue to checkout <ArrowRight size={17} />
              </button>

              <Link
                className="cu-text-link"
                to="/customer"
                onClick={onClose}
              >
                Continue browsing
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}