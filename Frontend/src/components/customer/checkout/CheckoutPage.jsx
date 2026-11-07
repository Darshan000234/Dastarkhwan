import { useEffect, useMemo, useState } from "react";
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
import { mockCustomerApi } from "../../../services/mockCustomerApi";
import {
  currency,
  cartLineKey,
  calculateCartTotals,
} from "../../../utils/customerPricing";
import { seedCoupons } from "../../../data/customerDemo";
import AddressFormModal from "../profile/AddressFormModal";
import FoodImage from "../common/FoodImage";
import { OrderStatusBadge } from "../common/Badges";

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
    profile,
    couponCode,
    loyaltyRedeemPoints,
    loyalty,
    applyCoupon,
    removeCoupon,
    setRedeemPoints,
    notify,
  } = useCustomer();
  const [totals, setTotals] = useState(calculateCartTotals([]));
  const [couponInput, setCouponInput] = useState(couponCode || "");
  const [couponError, setCouponError] = useState("");
  const [instructions, setInstructions] = useState("");
  const [addressModal, setAddressModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const outlet = outlets.find((entry) => entry.id === selectedOutletId);
  const selectedAddress =
    addresses.find((entry) => entry.id === selectedAddressId) ||
    addresses.find((entry) => entry.isDefault);
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
      .catch((error) => {
        if (active) {
          setTotals({
            ...calculateCartTotals(cart),
            valid: false,
            errors: [error.message],
          });
        }
      });
    return () => {
      active = false;
    };
  }, [cart, couponCode, loyaltyRedeemPoints, selectedOutletId]);
  const discountCoupon = useMemo(
    () => seedCoupons.find((entry) => entry.code === couponCode),
    [couponCode],
  );
  if (!cart.length)
    return (
      <div className="cu-page">
        <div className="cu-empty cu-empty-page">
          <h2>Your cart is empty.</h2>
          <p>Add a few favourites before moving to checkout.</p>
          <Link className="cu-button" to="/customer">
            Explore menu
          </Link>
        </div>
      </div>
    );
  const useCoupon = async (event) => {
    event.preventDefault();
    setCouponError("");
    setBusy(true);
    try {
      await applyCoupon(couponInput);
    } catch (error) {
      setCouponError(error.message);
    } finally {
      setBusy(false);
    }
  };
  const continuePayment = async () => {
    if (!selectedAddress) {
      notify("Choose a delivery address before continuing.", "error");
      setAddressModal(true);
      return;
    }
    if (selectedAddress.pincode !== selectedPincode) {
      notify(
        "Your delivery address and selected outlet pincode do not match. Confirm the location before checkout.",
        "error",
      );
      return;
    }
    if (!totals.valid) {
      notify(totals.errors?.join(" ") || "Your cart needs attention.", "error");
      return;
    }
    setBusy(true);
    try {
      const draft = {
        outletId: selectedOutletId,
        address: selectedAddress,
        customer: profile,
        cart,
        couponCode,
        loyaltyRedeemPoints,
        totals,
        instructions,
        prepMinutes: outlet?.prepTime || 25,
      };
      await mockCustomerApi.saveCustomerState({ checkoutDraft: draft });
      navigate("/customer/payment");
    } catch (error) {
      notify(error.message, "error");
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
          <span className="cu-eyebrow">ALMOST AT YOUR TABLE</span>
          <h1>Checkout</h1>
          <p>
            Review your delivery details and order. A returning customer can
            complete this in under a minute.
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
                <p>Where should the kitchen send your order?</p>
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
                className={`cu-address-choice ${selectedAddress?.id === address.id ? "is-selected" : ""}`}
                onClick={() => selectAddress(address.id)}
              >
                <span className="cu-radio-dot" />
                <span>
                  <strong>
                    {address.name} <em>{address.type}</em>
                    {address.isDefault && <small>DEFAULT</small>}
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
            {selectedAddress && selectedAddress.pincode !== selectedPincode && (
              <div className="cu-inline-warning">
                This address has a different pincode from the selected delivery
                area. Change location and revalidate the cart before ordering.
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
                  {cart.reduce((sum, line) => sum + line.quantity, 0)} items
                </p>
              </div>
              <Link to="/customer" className="cu-text-action">
                Edit cart
              </Link>
            </div>
            <div className="cu-checkout-items">
              {cart.map((line) => (
                <div className="cu-checkout-item" key={cartLineKey(line)}>
                  <FoodImage src={line.image} alt={line.name} />
                  <div>
                    <strong>{line.name}</strong>
                    <small>
                      {line.portion} · Qty {line.quantity}
                      {line.addons?.length
                        ? ` · ${line.addons.map((item) => item.name).join(", ")}`
                        : ""}
                    </small>
                  </div>
                  <b>{currency(line.unitPrice * line.quantity)}</b>
                </div>
              ))}
            </div>
          </section>
          <section className="cu-checkout-card">
            <div className="cu-checkout-card-head">
              <span className="cu-step-number">03</span>
              <div>
                <h2>Offers and rewards</h2>
                <p>Apply one coupon or redeem your points.</p>
              </div>
            </div>
            <form className="cu-coupon-form" onSubmit={useCoupon}>
              <Tag size={17} />
              <input
                value={couponInput}
                onChange={(event) =>
                  setCouponInput(event.target.value.toUpperCase())
                }
                placeholder="Enter coupon code"
                disabled={Boolean(couponCode)}
              />
              <button type="submit" disabled={busy || Boolean(couponCode)}>
                {busy ? "Checking…" : "Apply"}
              </button>
              {couponCode && (
                <button
                  type="button"
                  onClick={async () => {
                    await removeCoupon();
                    setCouponInput("");
                  }}
                >
                  Remove
                </button>
              )}
            </form>
            {couponError && <p className="cu-form-error">{couponError}</p>}
            {discountCoupon && (
              <p className="cu-applied-coupon">
                {discountCoupon.code} applied · {discountCoupon.title}
              </p>
            )}
            <div className="cu-rewards-row">
              <span className="cu-rewards-icon">
                <Gift size={17} />
              </span>
              <div>
                <strong>
                  {loyalty.balance.toLocaleString("en-IN")} points available
                </strong>
                <small>
                  100 points = ₹10 · Redeem up to 25% of item subtotal.
                </small>
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={loyaltyRedeemPoints > 0}
                  onChange={(event) =>
                    setRedeemPoints(
                      event.target.checked
                        ? Math.floor(
                            Math.min(loyalty.balance, totals.subtotal * 2.5) /
                              100,
                          ) * 100
                        : 0,
                    )
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
              onChange={(event) => setInstructions(event.target.value)}
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
          <div className="cu-bill-lines">
            <div>
              <span>Item subtotal</span>
              <strong>{currency(totals.subtotal)}</strong>
            </div>
            {totals.couponDiscount > 0 && (
              <div className="is-discount">
                <span>Coupon discount</span>
                <strong>−{currency(totals.couponDiscount)}</strong>
              </div>
            )}
            {totals.loyaltyDiscount > 0 && (
              <div className="is-discount">
                <span>Rewards redemption</span>
                <strong>−{currency(totals.loyaltyDiscount)}</strong>
              </div>
            )}
            <div>
              <span>Delivery fee</span>
              <strong>
                {totals.deliveryFee ? currency(totals.deliveryFee) : "FREE"}
              </strong>
            </div>
            <div className="cu-total-line">
              <span>To pay</span>
              <strong>{currency(totals.total)}</strong>
            </div>
          </div>
          <p className="cu-gst-note">
            Prices are inclusive of 5% GST. No extra tax is added.
          </p>
          <div className="cu-safe-note">
            <ShieldCheck size={16} />
            <span>Test payment only. No real money is charged.</span>
          </div>
          <button
            className="cu-button cu-button-wide"
            onClick={continuePayment}
            disabled={busy || !totals.valid}
          >
            {busy ? "Preparing…" : "Continue to payment"}{" "}
            <ArrowRight size={17} />
          </button>
          <small className="cu-bill-small">
            <Clock3 size={13} /> Approx. {outlet?.prepTime || 25} min
            preparation after confirmation
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
