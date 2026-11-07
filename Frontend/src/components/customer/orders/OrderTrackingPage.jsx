import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { mockCustomerApi } from "../../../services/mockCustomerApi";
import { currency } from "../../../utils/customerPricing";
import { OrderStatusBadge } from "../common/Badges";
import OrderTimeline from "./OrderTimeline";
import EmptyState from "../common/EmptyState";

export default function OrderTrackingPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOrder(await mockCustomerApi.getOrderById(orderId));
    } finally {
      setLoading(false);
    }
  }, [orderId]);
  useEffect(() => {
    load();
  }, [load]);
  const progress = async () => {
    setBusy(true);
    try {
      setOrder(await mockCustomerApi.simulateNextStatus(orderId));
    } catch (error) {
      /* page can recover by reloading order */
    } finally {
      setBusy(false);
    }
  };
  if (loading)
    return (
      <div className="cu-page">
        <div className="cu-loading-card cu-order-loading" />
      </div>
    );
  if (!order)
    return (
      <div className="cu-page">
        <EmptyState
          title="We couldn't find this order"
          description="The order may have been reset from demo data."
          action="Back to menu"
          onAction={() => window.location.assign("/customer")}
        />
      </div>
    );
  const placedAt = new Date(order.placedAt);
  const promisedAt = order.promisedAt ? new Date(order.promisedAt) : null;
  return (
    <div className="cu-page cu-order-page">
      <Link to="/customer/orders" className="cu-back-link">
        <ArrowLeft size={15} /> My orders
      </Link>
      <div className="cu-order-success">
        <span className="cu-success-check">✓</span>
        <div>
          <span className="cu-eyebrow">
            {order.paymentStatus === "Succeeded"
              ? "ORDER CONFIRMED"
              : "ORDER UPDATE"}
          </span>
          <h1>
            {order.paymentStatus === "Succeeded"
              ? "Your meal is on its way."
              : "Your order details"}
          </h1>
          <p>
            Order <strong>{order.id}</strong> · Demo payment{" "}
            {order.paymentStatus?.toLowerCase()}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      <div className="cu-order-layout">
        <section className="cu-order-card">
          <div className="cu-order-card-head">
            <div>
              <span className="cu-eyebrow">ORDER PROGRESS</span>
              <h2>Kitchen updates</h2>
              <p>Simulated status updates for this frontend demo.</p>
            </div>
            <span className="cu-live-demo">
              <i /> DEMO LIVE UPDATES
            </span>
          </div>
          <OrderTimeline order={order} />
          <div className="cu-order-eta">
            <span>
              <Clock3 size={17} /> Estimated preparation
            </span>
            <strong>{order.prepMinutes || 25} min</strong>
            <small>
              {promisedAt
                ? `Promised around ${promisedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                : "Estimate provided by mock service"}
            </small>
          </div>
          {order.status !== "Handed Off" && order.status !== "Cancelled" && (
            <button
              className="cu-button cu-button-wide"
              disabled={busy}
              onClick={progress}
            >
              {busy ? "Updating…" : "Simulate next kitchen update"}{" "}
              <RefreshCw size={15} />
            </button>
          )}
          <small className="cu-demo-caption">
            These transitions are simulated and persisted in the browser. They
            are not live kitchen or delivery updates.
          </small>
        </section>
        <aside className="cu-order-card cu-order-summary">
          <span className="cu-eyebrow">ORDER SUMMARY</span>
          <h2>{order.outletSnapshot?.name || "Dastarkhwan outlet"}</h2>
          <p>
            <MapPin size={14} /> {order.address?.house || "Delivery address"},{" "}
            {order.address?.street || ""}, {order.address?.pincode || ""}
          </p>
          <div className="cu-order-items-list">
            {(order.items || []).map((item, index) => (
              <div key={`${item.name}-${index}`}>
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.portion || "Regular"} × {item.qty}
                  </small>
                </span>
                <b>{currency(item.price * item.qty)}</b>
              </div>
            ))}
          </div>
          <div className="cu-order-total">
            <span>Total paid</span>
            <strong>{currency(order.amount)}</strong>
          </div>
          <div className="cu-order-payment">
            <span>Payment</span>
            <strong>
              {order.paymentMethod} · {order.paymentStatus}
            </strong>
          </div>
          <div className="cu-payment-safe">
            <ShieldCheck size={15} /> Demo payment reference:{" "}
            {order.paymentReference || "Seeded order"}
          </div>
          <Link className="cu-text-link" to="/customer">
            Order more food <ArrowRight size={14} />
          </Link>
        </aside>
      </div>
      <div className="cu-order-time-note">
        Placed{" "}
        {placedAt.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}{" "}
        at{" "}
        {placedAt.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
    </div>
  );
}
