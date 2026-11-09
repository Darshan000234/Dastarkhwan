import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Plus,
  ShieldCheck,
  Tag,
  Gift,
  Clock3,
} from "lucide-react";

import { useCustomer } from "../../../context/CustomerContext";

import {
  currency,
  cartLineKey,
} from "../../../utils/customerPricing";

import AddressFormModal from "../profile/AddressFormModal";
import FoodImage from "../common/FoodImage";

export default function CheckoutPage() {
  const navigate = useNavigate();

  const {
    cart,
    outlets,
    selectedOutletId,
    selectedPincode,

    addresses,
    selectedAddressId,
    selectAddress,

    couponCode,
    loyaltyRedeemPoints,
    loyalty,

    cartQuote,
    refreshQuote,
    validateCart,

    applyCoupon,
    removeCoupon,
    setRedeemPoints,

    setCheckoutDraft,
    requestLocation,
    notify,
  } = useCustomer();

  const [couponInput, setCouponInput] = useState(
    couponCode || "",
  );

  const [couponError, setCouponError] = useState("");
  const [quoteError, setQuoteError] = useState("");

  const [instructions, setInstructions] = useState("");

  const [addressModal, setAddressModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loyaltyBusy, setLoyaltyBusy] = useState(false);

  const outlet = outlets.find(
    (entry) => entry.id === selectedOutletId,
  );

  const selectedAddress =
    addresses.find(
      (entry) => entry.id === selectedAddressId,
    ) ||
    addresses.find((entry) => entry.isDefault);

  const quoteReady =
    Boolean(cartQuote?.valid) &&
    cartQuote?.outlet?.id === selectedOutletId &&
    !quoteError;

  /* ======================================================
     REFRESH BACKEND QUOTE
  ====================================================== */

  useEffect(() => {
    if (!cart.length || !selectedOutletId) return undefined;

    let active = true;

    refreshQuote({
      addressId: selectedAddress?.id,
    })
      .then(() => {
        if (active) setQuoteError("");
      })
      .catch((error) => {
        if (active) {
          setQuoteError(
            error.message || "Unable to calculate checkout.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [
    cart,
    selectedOutletId,
    selectedAddress?.id,
    couponCode,
    loyaltyRedeemPoints,
    refreshQuote,
  ]);

  if (!cart.length) {
    return (
      <div className="cu-page">
        <div className="cu-empty cu-empty-page">
          <h2>Your cart is empty.</h2>

          <p>
            Add a few favourites before moving to checkout.
          </p>

          <Link className="cu-button" to="/customer">
            Explore menu
          </Link>
        </div>
      </div>
    );
  }

  const useCoupon = async (event) => {
    event.preventDefault();

    setCouponError("");
    setBusy(true);

    try {
      await applyCoupon(couponInput);
      setCouponInput(couponInput.trim().toUpperCase());
    } catch (error) {
      setCouponError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const removeAppliedCoupon = async () => {
    setCouponError("");
    setBusy(true);

    try {
      await removeCoupon();
      setCouponInput("");
    } catch (error) {
      setCouponError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleLoyalty = async (checked) => {
    if (!checked) {
      setLoyaltyBusy(true);

      try {
        await setRedeemPoints(0);
      } catch (error) {
        notify(error.message, "error");
      } finally {
        setLoyaltyBusy(false);
      }

      return;
    }

    if (!cartQuote?.subtotal) {
      notify("Wait for the backend quote before redeeming points.", "error");
      return;
    }

    const pointsPerRupee =
      Number(loyalty.redemption?.pointsPerRupee || 10);

    const pointsPerReward =
      Number(loyalty.redemption?.pointsPerReward || 100);

    const maximumPercentage =
      Number(
        loyalty.redemption?.maximumSubtotalPercentage || 25,
      );

    const maximumPoints = Math.floor(
      Math.min(
        loyalty.balance,
        (cartQuote.subtotal * maximumPercentage * pointsPerRupee) /
          100,
      ) / pointsPerReward,
    ) * pointsPerReward;

    if (maximumPoints <= 0) {
      notify("There are no redeemable points for this cart.", "error");
      return;
    }

    setLoyaltyBusy(true);

    try {
      await setRedeemPoints(maximumPoints);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setLoyaltyBusy(false);
    }
  };

  const continuePayment = async () => {
    if (!selectedAddress) {
      notify(
        "Choose a delivery address before continuing.",
        "error",
      );

      setAddressModal(true);
      return;
    }

    if (!selectedOutletId) {
      notify("Select a delivery outlet first.", "error");
      return;
    }

    if (selectedAddress.pincode !== selectedPincode) {
      const result = await requestLocation(
        selectedAddress.pincode,
      );

      if (!result.serviceable) {
        notify(
          result.reason ||
            "The selected address is not serviceable.",
          "error",
        );
        return;
      }

      if (result.outlets?.length > 1) {
        window.dispatchEvent(
          new Event("dastarkhwan:open-location"),
        );
      }

      notify(
        "Confirm the outlet for the selected address, then continue to payment.",
        "error",
      );

      return;
    }

    setBusy(true);

    try {
      /*
       * Step 1: Validate the cart through the backend.
       */
      const validation = await validateCart(cart, {
        addressId: selectedAddress.id,
      });

      if (validation.valid !== true) {
        throw new Error(
          "The backend could not validate the cart.",
        );
      }

      /*
       * Step 2: Retrieve a fresh authoritative quote.
       */
      const quote = await refreshQuote({
        addressId: selectedAddress.id,
        instructions,
      });

      if (!quote?.valid) {
        throw new Error("The backend did not return a valid quote.");
      }

      setCheckoutDraft({
        outletId: selectedOutletId,
        outletName: outlet?.name || quote.outlet?.name || "",

        addressId: selectedAddress.id,
        address: selectedAddress,

        cart,
        couponCode,
        loyaltyRedeemPoints,

        quote,
        instructions,
      });

      navigate("/customer/payment");
    } catch (error) {
      notify(
        error.message || "Unable to prepare checkout.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cu-page cu-checkout-page">
      <div className="cu-checkout-top">
        <Link to="/customer" className="cu-back-link">
          <ArrowLeft size={15} /> Back to menu
        </Link>

        <div>
          <span className="cu-eyebrow">
            ALMOST AT YOUR TABLE
          </span>

          <h1>Checkout</h1>

          <p>
            Review your delivery details and order. A returning
            customer can complete this in under a minute.
          </p>
        </div>
      </div>

      <div className="cu-checkout-layout">
        <div className="cu-checkout-main">
          <section className="cu-checkout-card">
            <div className="cu-checkout-card-head">
              <span className="cu-step-number">01</span>

              <div>
                <h2>Delivery address</h2>
                <p>
                  Where should the kitchen send your order?
                </p>
              </div>

              <button
                className="cu-text-action"
                onClick={() => setAddressModal(true)}
              >
                <Plus size={14} /> Add new
              </button>
            </div>

            {addresses.map((address) => (
              <button
                key={address.id}
                className={`cu-address-choice ${
                  selectedAddress?.id === address.id
                    ? "is-selected"
                    : ""
                }`}
                onClick={() => selectAddress(address.id)}
              >
                <span className="cu-radio-dot" />

                <span>
                  <strong>
                    {address.name}
                    <em>{address.type}</em>

                    {address.isDefault && (
                      <small>DEFAULT</small>
                    )}
                  </strong>

                  <span>
                    {address.house}, {address.street}, {address.city} —{" "}
                    {address.pincode}
                  </span>

                  <small>{address.phone}</small>
                </span>

                <MapPin size={17} />
              </button>
            ))}

            {selectedAddress &&
              selectedAddress.pincode !== selectedPincode && (
                <div className="cu-inline-warning">
                  This address has a different pincode from
                  your selected delivery location. Recheck the
                  serviceability before continuing.
                </div>
              )}
          </section>

          <section className="cu-checkout-card">
            <div className="cu-checkout-card-head">
              <span className="cu-step-number">02</span>

              <div>
                <h2>Order summary</h2>

                <p>
                  {outlet?.name} ·{" "}
                  {cart.reduce(
                    (sum, line) => sum + line.quantity,
                    0,
                  )}{" "}
                  items
                </p>
              </div>

              <Link to="/customer" className="cu-text-action">
                Edit cart
              </Link>
            </div>

            <div className="cu-checkout-items">
              {cart.map((line, index) => {
                const quotedItem = cartQuote?.items?.[index];

                return (
                  <div
                    className="cu-checkout-item"
                    key={cartLineKey(line)}
                  >
                    <FoodImage
                      src={line.image}
                      alt={line.name}
                    />

                    <div>
                      <strong>{line.name}</strong>

                      <small>
                        {line.portion} · Qty {line.quantity}

                        {line.addons?.length
                          ? ` · ${line.addons
                              .map((item) => item.name)
                              .join(", ")}`
                          : ""}
                      </small>
                    </div>

                    <b>
                      {quotedItem
                        ? currency(quotedItem.lineTotal)
                        : "—"}
                    </b>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="cu-checkout-card">
            <div className="cu-checkout-card-head">
              <span className="cu-step-number">03</span>

              <div>
                <h2>Offers and rewards</h2>
                <p>
                  Apply a coupon or preview your points redemption.
                </p>
              </div>
            </div>

            <form
              className="cu-coupon-form"
              onSubmit={useCoupon}
            >
              <Tag size={17} />

              <input
                value={couponInput}
                onChange={(event) =>
                  setCouponInput(
                    event.target.value.toUpperCase(),
                  )
                }
                placeholder="Enter coupon code"
                disabled={Boolean(couponCode)}
              />

              <button
                type="submit"
                disabled={busy || Boolean(couponCode)}
              >
                {busy ? "Checking…" : "Apply"}
              </button>

              {couponCode && (
                <button
                  type="button"
                  onClick={removeAppliedCoupon}
                  disabled={busy}
                >
                  Remove
                </button>
              )}
            </form>

            {couponError && (
              <p className="cu-form-error">{couponError}</p>
            )}

            {couponCode && (
              <p className="cu-applied-coupon">
                {couponCode} applied
              </p>
            )}

            <div className="cu-rewards-row">
              <span className="cu-rewards-icon">
                <Gift size={17} />
              </span>

              <div>
                <strong>
                  {Number(loyalty.balance || 0).toLocaleString("en-IN")}{" "}
                  points available
                </strong>

                <small>
                  {loyalty.redemption?.pointsPerReward || 100} points
                  = ₹{loyalty.redemption?.rewardValue || 10}. The
                  backend enforces the maximum redemption limit.
                </small>
              </div>

              <label>
                <input
                  type="checkbox"
                  checked={loyaltyRedeemPoints > 0}
                  disabled={loyaltyBusy || !cartQuote}
                  onChange={(event) =>
                    toggleLoyalty(event.target.checked)
                  }
                />{" "}
                Redeem
              </label>
            </div>
          </section>

          <section className="cu-checkout-card">
            <div className="cu-checkout-card-head">
              <span className="cu-step-number">04</span>

              <div>
                <h2>Kitchen instructions</h2>
                <p>Optional notes for the kitchen.</p>
              </div>
            </div>

            <textarea
              className="cu-instructions"
              value={instructions}
              maxLength={180}
              onChange={(event) =>
                setInstructions(event.target.value)
              }
              placeholder="Less spicy, extra raita, no onions…"
            />

            <small className="cu-character-count">
              {instructions.length}/180
            </small>
          </section>
        </div>

        <aside className="cu-bill-card">
          <span className="cu-eyebrow">YOUR BILL</span>

          <h2>Order total</h2>

          {!cartQuote ? (
            <p className="cu-muted">
              Waiting for the backend checkout quote…
            </p>
          ) : (
            <div className="cu-bill-lines">
              <div>
                <span>Item subtotal</span>
                <strong>{currency(cartQuote.subtotal)}</strong>
              </div>

              {Number(cartQuote.couponDiscount) > 0 && (
                <div className="is-discount">
                  <span>Coupon discount</span>
                  <strong>
                    −{currency(cartQuote.couponDiscount)}
                  </strong>
                </div>
              )}

              {Number(cartQuote.loyaltyDiscount) > 0 && (
                <div className="is-discount">
                  <span>Rewards redemption</span>
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

              <div className="cu-total-line">
                <span>To pay</span>
                <strong>{currency(cartQuote.total)}</strong>
              </div>
            </div>
          )}

          {quoteError && (
            <p className="cu-form-error">{quoteError}</p>
          )}

          <p className="cu-gst-note">
            {cartQuote?.gstInclusive
              ? "Prices are GST-inclusive. No extra GST is added."
              : "Tax is reflected in the backend quote."}
          </p>

          <div className="cu-safe-note">
            <ShieldCheck size={16} />

            <span>
              Test payment only. No real money is charged.
            </span>
          </div>

          <button
            className="cu-button cu-button-wide"
            onClick={continuePayment}
            disabled={busy || !quoteReady}
          >
            {busy ? "Preparing…" : "Continue to payment"}{" "}
            <ArrowRight size={17} />
          </button>

          <small className="cu-bill-small">
            <Clock3 size={13} /> Approx.{" "}
            {cartQuote?.outlet?.minimumPrepMinutes ||
              outlet?.prepTime ||
              "—"}{" "}
            min preparation after confirmation
          </small>
        </aside>
      </div>

      <AddressFormModal
        open={addressModal}
        onClose={() => setAddressModal(false)}
      />
    </div>
  );
}