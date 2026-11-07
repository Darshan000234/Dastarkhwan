import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  Smartphone,
  LockKeyhole,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { mockCustomerApi } from "../../../services/mockCustomerApi";
import { currency } from "../../../utils/customerPricing";
import { useCustomer } from "../../../context/CustomerContext";

export default function PaymentPage() {
  const navigate = useNavigate();
  const { notify, refreshOrders, refreshLoyalty, clearCart } = useCustomer();
  const [draft, setDraft] = useState(null);
  const [method, setMethod] = useState("upi");
  const [outcome, setOutcome] = useState("success");
  const [card, setCard] = useState({
    name: "",
    number: "",
    expiry: "",
    cvv: "",
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    mockCustomerApi.getBootstrap().then((data) => {
      if (data.checkoutDraft) setDraft(data.checkoutDraft);
    });
  }, []);
  const updateCard = (key, value) =>
    setCard((current) => ({ ...current, [key]: value }));
  const validateCard = () => {
    if (card.name.trim().length < 2) return "Enter the cardholder name.";
    if (!/^(?:\d{4} ?){3}\d{4}$/.test(card.number.trim()))
      return "Enter a valid 16-digit demo card number.";
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.expiry))
      return "Enter expiry as MM/YY.";
    if (!/^\d{3,4}$/.test(card.cvv)) return "Enter a 3 or 4 digit CVV.";
    return "";
  };
  const pay = async () => {
    if (!draft) return;
    setError("");
    if (method === "card") {
      const invalid = validateCard();
      if (invalid) {
        setError(invalid);
        return;
      }
    }
    setBusy(true);
    setResult(null);
    try {
      const serviceability = await mockCustomerApi.checkServiceability(
        draft.address?.pincode,
      );
      if (
        !serviceability.serviceable ||
        !serviceability.outlets.some((outlet) => outlet.id === draft.outletId)
      )
        throw new Error(
          "The selected outlet can no longer serve this delivery address. Return to checkout and choose a supported address.",
        );
      const totals = await mockCustomerApi.calculateCartTotal(
        draft.cart,
        draft.couponCode,
        draft.loyaltyRedeemPoints,
        draft.outletId,
      );
      if (!totals.valid)
        throw new Error(
          totals.errors?.join(" ") || "Your cart is no longer valid.",
        );
      if (Number(totals.total) !== Number(draft.totals.total))
        throw new Error(
          "The order total changed. Return to checkout to review the updated bill.",
        );
      const payment = await mockCustomerApi.createMockPayment({
        method,
        outcome,
        amount: totals.total,
      });
      setResult(payment);
      if (payment.status === "CANCELLED") {
        notify("Payment cancelled. Your cart is unchanged.", "error");
        navigate("/customer/checkout");
        return;
      }
      if (payment.status === "FAILED") {
        setError(
          "The demo payment was declined. Your cart and checkout details have been preserved. Retry with a successful test outcome.",
        );
        return;
      }
      const order = await mockCustomerApi.createOrder({
        outletId: draft.outletId,
        address: draft.address,
        cart: draft.cart,
        couponCode: draft.couponCode,
        loyaltyPoints: draft.loyaltyRedeemPoints,
        paymentStatus: payment.status,
        paymentReference: payment.reference,
        paymentMethod: method,
        prepMinutes: draft.prepMinutes,
        instructions: draft.instructions,
      });
      await Promise.all([refreshOrders(), refreshLoyalty(), clearCart()]);
      navigate(`/customer/order/${order.id}`, { state: { justPlaced: true } });
    } catch (err) {
      setError(err.message || "Payment could not be completed.");
    } finally {
      setBusy(false);
    }
  };
  if (!draft)
    return (
      <div className="cu-page cu-payment-loading">
        <span className="cu-eyebrow">SECURE DEMO CHECKOUT</span>
        <h1>Preparing payment…</h1>
        <p>Your checkout details may have expired.</p>
        <Link to="/customer/checkout" className="cu-button">
          Return to checkout
        </Link>
      </div>
    );
  return (
    <div className="cu-page cu-payment-page">
      <Link to="/customer/checkout" className="cu-back-link">
        <ArrowLeft size={15} /> Back to checkout
      </Link>
      <div className="cu-payment-heading">
        <span className="cu-eyebrow">DEVELOPMENT PAYMENT EXPERIENCE</span>
        <h1>Choose how to pay.</h1>
        <p>
          This is a simulated transaction. No real payment is processed and no
          card details are stored.
        </p>
      </div>
      <div className="cu-payment-layout">
        <section className="cu-payment-card">
          <div className="cu-payment-methods">
            <button
              className={method === "upi" ? "is-active" : ""}
              onClick={() => setMethod("upi")}
            >
              <Smartphone size={19} />
              <span>
                <strong>UPI</strong>
                <small>Demo UPI flow</small>
              </span>
            </button>
            <button
              className={method === "card" ? "is-active" : ""}
              onClick={() => setMethod("card")}
            >
              <CreditCard size={19} />
              <span>
                <strong>Card</strong>
                <small>Test card details</small>
              </span>
            </button>
          </div>
          {method === "upi" ? (
            <div className="cu-upi-panel">
              <div className="cu-demo-qr">
                <span className="cu-qr-mark">D</span>
                <div className="cu-qr-grid" aria-hidden="true">
                  {Array.from({ length: 49 }, (_, index) => (
                    <i
                      key={index}
                      className={
                        index % 3 === 0 ||
                        index % 7 === 0 ||
                        [0, 1, 2, 7, 14, 21, 28, 35, 42, 43, 44, 48].includes(
                          index,
                        )
                          ? "is-dark"
                          : ""
                      }
                    />
                  ))}
                </div>
              </div>
              <h2>Pay using UPI</h2>
              <p>Demo UPI ID</p>
              <strong className="cu-upi-id">dastarkhwan.demo@upi</strong>
              <small>
                This QR is decorative and does not initiate a real transfer.
              </small>
            </div>
          ) : (
            <div className="cu-card-form">
              <h2>Test card details</h2>
              <label>
                Cardholder name
                <input
                  value={card.name}
                  onChange={(e) => updateCard("name", e.target.value)}
                  placeholder="Name on card"
                  autoComplete="off"
                />
              </label>
              <label>
                Card number
                <input
                  value={card.number}
                  onChange={(e) =>
                    updateCard(
                      "number",
                      e.target.value.replace(/[^\d ]/g, "").slice(0, 19),
                    )
                  }
                  placeholder="4111 1111 1111 1111"
                  inputMode="numeric"
                  autoComplete="off"
                />
              </label>
              <div>
                <label>
                  Expiry
                  <input
                    value={card.expiry}
                    onChange={(e) =>
                      updateCard(
                        "expiry",
                        e.target.value.replace(/[^\d/]/g, "").slice(0, 5),
                      )
                    }
                    placeholder="MM/YY"
                    autoComplete="off"
                  />
                </label>
                <label>
                  CVV
                  <input
                    value={card.cvv}
                    onChange={(e) =>
                      updateCard(
                        "cvv",
                        e.target.value.replace(/\D/g, "").slice(0, 4),
                      )
                    }
                    placeholder="123"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </label>
              </div>
              <small>
                Use dummy details only. The card form is cleared when you leave
                this screen.
              </small>
            </div>
          )}
          <div className="cu-payment-outcome">
            <strong>Choose a demo result</strong>
            <div className="cu-outcome-options">
              <button
                className={outcome === "success" ? "is-selected" : ""}
                onClick={() => setOutcome("success")}
              >
                <CheckCircle2 size={15} /> Success
              </button>
              <button
                className={outcome === "failed" ? "is-selected" : ""}
                onClick={() => setOutcome("failed")}
              >
                <AlertCircle size={15} /> Failure
              </button>
              <button
                className={outcome === "cancelled" ? "is-selected" : ""}
                onClick={() => setOutcome("cancelled")}
              >
                Cancel
              </button>
            </div>
          </div>
          {error && (
            <div className="cu-payment-error">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}
          <button
            className="cu-button cu-button-wide"
            disabled={busy}
            onClick={pay}
          >
            {busy
              ? "Simulating payment…"
              : `Pay ${currency(draft.totals.total)}`}{" "}
            <LockKeyhole size={16} />
          </button>
          <div className="cu-payment-safe">
            <ShieldCheck size={16} /> Mock payment · no real money · no payment
            credentials retained
          </div>
          {result?.status === "FAILED" && (
            <button
              className="cu-button-secondary cu-button-wide"
              onClick={() => {
                setOutcome("success");
                setError("");
                setResult(null);
              }}
            >
              Retry with successful demo result
            </button>
          )}
        </section>
        <aside className="cu-bill-card cu-payment-bill">
          <span className="cu-eyebrow">PAYMENT SUMMARY</span>
          <h2>{currency(draft.totals.total)}</h2>
          <p>
            {draft.cart.reduce((sum, line) => sum + line.quantity, 0)} items
            from{" "}
            {draft.outletId === "out-kondapur"
              ? "Kondapur"
              : draft.outletId === "out-gachibowli"
                ? "Gachibowli Cloud Kitchen"
                : "Kukatpally"}
          </p>
          <hr />
          <div>
            <span>Deliver to</span>
            <strong>
              {draft.address?.type} · {draft.address?.pincode}
            </strong>
          </div>
          <div>
            <span>Recipient</span>
            <strong>{draft.address?.name}</strong>
          </div>
          <div>
            <span>Payment mode</span>
            <strong>{method.toUpperCase()}</strong>
          </div>
          <small>Prices inclusive of 5% GST.</small>
        </aside>
      </div>
    </div>
  );
}
