import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  MapPin,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

import customerApi from "../../../services/customerApi";
import { currency } from "../../../utils/customerPricing";
import { OrderStatusBadge } from "../common/Badges";
import OrderTimeline from "./OrderTimeline";
import EmptyState from "../common/EmptyState";
import socketClient from "../../../services/socketClient.js";

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OrderTrackingPage() {
  const { orderId } = useParams();

  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [timeline, setTimeline] = useState([]);

  const [loadedOrderId, setLoadedOrderId] = useState(null);

  const loading = loadedOrderId !== orderId;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(0);

  const load = useCallback(async () => {
    try {
      const orderResult = await customerApi.getOrder(orderId);

      if (!orderResult) {
        const error = new Error("Order not found.");
        error.status = 404;
        throw error;
      }

      const now = Date.now();

      const promisedAt = orderResult.promisedAt
        ? new Date(orderResult.promisedAt).getTime()
        : null;

      const isTerminal = ["Handed Off", "Cancelled"].includes(
        orderResult.status,
      );

      const delayMinutes =
        !isTerminal && promisedAt && now > promisedAt
          ? Math.floor((now - promisedAt) / 60000)
          : 0;

      const remainingMinutes =
        !isTerminal && promisedAt
          ? Math.max(0, Math.ceil((promisedAt - now) / 60000))
          : 0;

      setOrder(orderResult);

      setTracking({
        orderId: orderResult.id,
        status: orderResult.status,
        promisedAt: orderResult.promisedAt,
        estimatedPrepMinutes: orderResult.prepMinutes,
        remainingMinutes,
        delayMinutes,
        isLate: delayMinutes > 0,
        outlet: orderResult.outletSnapshot,
      });

      setTimeline(
        (orderResult.timeline || []).map((event) => ({
          label: event.label,
          time: event.time,
          at: event.at,
          note: event.note,
        })),
      );

      setError("");
    } catch (err) {
      setError(err.message || "Unable to refresh your order.");

      // Do not erase a previously loaded order when a
      // temporary database or network failure occurs.
      console.error("Customer order refresh failed:", err);
    } finally {
      setBusy(false);
      setLoadedOrderId(orderId);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let active = true;
    let reconnecting = false;

    const socket = socketClient.connect();

    const LIVE_STATUS_LABELS = {
      PLACED: "Placed",
      ACCEPTED: "Accepted",
      PREPARING: "Preparing",
      READY: "Ready",
      HANDED_OFF: "Handed Off",
      CANCELLED: "Cancelled",
    };

    const refreshIfCurrentOrder = (payload) => {
      if (!active) return;

      // Match either the database ID or public order number.
      const currentOrderKey = String(orderId);

      const matchesCurrentOrder = [payload?.orderId, payload?.orderNumber].some(
        (eventOrderId) =>
          eventOrderId !== undefined &&
          eventOrderId !== null &&
          String(eventOrderId) === currentOrderKey,
      );

      if (!matchesCurrentOrder) return;

      const nextStatus = LIVE_STATUS_LABELS[payload.status];

      if (!nextStatus) {
        console.warn("[Order Tracking] Unknown status:", payload.status);
        return;
      }

      const eventTime = payload.updatedAt || new Date().toISOString();

      console.info("[Order Tracking] Live status received:", nextStatus);

      // 1. Update the order directly.
      setOrder((current) => {
        if (!current) return current;

        return {
          ...current,
          status: nextStatus,
          ...(payload.updatedAt ? { updatedAt: payload.updatedAt } : {}),
        };
      });

      // 2. Update tracking state without an API request.
      setTracking((current) => ({
        ...(current || {}),
        orderId: payload.orderNumber || currentOrderKey,
        status: nextStatus,
      }));

      // 3. Update the timeline immediately.
      setTimeline((current) => {
        const alreadyExists = current.some(
          (event) => event.label === nextStatus && event.at === eventTime,
        );

        if (alreadyExists) return current;

        return [
          ...current,
          {
            label: nextStatus,
            time: eventTime,
            at: eventTime,
            note: "Live update from the kitchen.",
          },
        ];
      });

      // No HTTP request here.
      // The socket payload already contains the new status.

      // NO GET REQUEST HERE.
    };

    const onConnect = () => {
      if (!active) return;

      console.info("[Customer Tracking] Socket connected:", socket.id);

      // Run after both the initial connection and reconnect.
      // This retrieves any status that may have changed
      // before the customer joined the socket room.

      reconnecting = true;
    };

    const onDisconnect = (reason) => {
      reconnecting = true;

      console.warn("[Customer Tracking] Socket disconnected:", reason);
    };

    const onConnectError = (error) => {
      console.error(
        "[Customer Tracking] Socket connection failed:",
        error.message,
      );
    };

    socket.on("order:status-updated", refreshIfCurrentOrder);

    socket.on("order:eta-updated", refreshIfCurrentOrder);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    return () => {
      active = false;
      socket.off("connect_error", onConnectError);
      socket.off("order:status-updated", refreshIfCurrentOrder);

      socket.off("order:eta-updated", refreshIfCurrentOrder);

      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);

      socketClient.disconnect();
    };
  }, [orderId, load]);

  const refresh = async () => {
    setBusy(true);
    await load();
  };

  if (loading) {
    return (
      <div className="cu-page">
        <div className="cu-loading-card cu-order-loading" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="cu-page">
        <EmptyState
          title={
            errorStatus === 404
              ? "We couldn't find this order"
              : "We couldn't load your order"
          }
          description={
            errorStatus === 404
              ? "This order does not exist or does not belong to your account."
              : "The order service is temporarily unavailable. Your order has not been deleted. Please try again."
          }
          action="Back to menu"
          onAction={() => {
            window.location.assign("/customer");
          }}
        />

        <div className="cu-order-refresh">
          <button
            className="cu-button-secondary"
            disabled={busy}
            onClick={refresh}
          >
            <RefreshCw size={15} /> Try again
          </button>
        </div>
      </div>
    );
  }

  const placedAt = order.placedAt ? new Date(order.placedAt) : null;

  const promisedAt = tracking?.promisedAt || order.promisedAt || null;

  const cancelled = order.status === "Cancelled";
  const handedOff = order.status === "Handed Off";

  const timelineOrder = {
    ...order,
    timeline,
  };

  return (
    <div className="cu-page cu-order-page">
      <Link to="/customer/orders" className="cu-back-link">
        <ArrowLeft size={15} /> My orders
      </Link>

      <div className="cu-order-success">
        <span className="cu-success-check">{cancelled ? "!" : "✓"}</span>

        <div>
          <span className="cu-eyebrow">
            {order.paymentStatus === "Succeeded"
              ? "ORDER CONFIRMED"
              : cancelled
                ? "ORDER CANCELLED"
                : "ORDER UPDATE"}
          </span>

          <h1>
            {cancelled
              ? "This order was cancelled."
              : handedOff
                ? "Your order has been handed off."
                : order.paymentStatus === "Succeeded"
                  ? "Your meal is being prepared."
                  : "Your order details"}
          </h1>

          <p>
            Order <strong>{order.id}</strong> · Payment{" "}
            {String(order.paymentStatus || "Unknown").toLowerCase()}
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
              <p>Order progress recorded by the backend.</p>
            </div>

            <span className="cu-live-demo">
              <i /> BACKEND STATUS
            </span>
          </div>

          <OrderTimeline order={timelineOrder} />

          {cancelled && (
            <div className="cu-payment-error">
              <AlertCircle size={17} />
              <span>
                This order is cancelled. No further kitchen progress is
                expected.
              </span>
            </div>
          )}

          <div className="cu-order-eta">
            <span>
              <Clock3 size={17} /> Estimated preparation
            </span>

            <strong>
              {tracking?.estimatedPrepMinutes ?? order.prepMinutes ?? "—"}{" "}
              {tracking?.estimatedPrepMinutes || order.prepMinutes ? "min" : ""}
            </strong>

            <small>
              {tracking?.isLate
                ? `Delayed by ${tracking.delayMinutes} minutes`
                : tracking?.remainingMinutes > 0
                  ? `${tracking.remainingMinutes} minutes remaining`
                  : promisedAt
                    ? `Promised around ${formatTime(promisedAt)}`
                    : "The outlet has not provided an ETA."}
            </small>
          </div>

          {tracking?.isLate && (
            <div className="cu-inline-warning">
              Your order is running later than its current promised time.
            </div>
          )}

          <button
            className="cu-button cu-button-wide"
            disabled={busy}
            onClick={load}
          >
            {busy ? "Refreshing…" : "Refresh order status"}{" "}
            <RefreshCw size={15} />
          </button>

          <small className="cu-demo-caption">
            Status and timeline are retrieved from the backend. This page does
            not simulate kitchen transitions.
          </small>

          {error && <p className="cu-form-error">{error}</p>}
        </section>

        <aside className="cu-order-card cu-order-summary">
          <span className="cu-eyebrow">ORDER SUMMARY</span>

          <h2>
            {order.outletSnapshot?.name ||
              tracking?.outlet?.name ||
              "Dastarkhwan outlet"}
          </h2>

          <p>
            <MapPin size={14} /> {order.address?.house || "Delivery address"},{" "}
            {order.address?.street || ""}, {order.address?.pincode || ""}
          </p>

          <div className="cu-order-items-list">
            {(order.items || []).map((item, index) => (
              <div key={`${item.itemId || item.name}-${index}`}>
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.portion || "Regular"} × {item.qty}
                    {item.addons?.length
                      ? ` · ${item.addons.map((addon) => addon.name).join(", ")}`
                      : ""}
                  </small>
                </span>

                <b>
                  {currency(
                    Number(item.lineTotal ?? item.price * item.qty ?? 0),
                  )}
                </b>
              </div>
            ))}
          </div>

          <div className="cu-order-total">
            <span>Total</span>
            <strong>{currency(order.amount)}</strong>
          </div>

          <div className="cu-order-payment">
            <span>Payment</span>
            <strong>
              {order.paymentMethod || "—"} · {order.paymentStatus || "—"}
            </strong>
          </div>

          <div className="cu-payment-safe">
            <ShieldCheck size={15} /> Payment reference:{" "}
            {order.paymentReference || "Not available"}
          </div>

          <Link className="cu-text-link" to="/customer">
            Order more food <ArrowRight size={14} />
          </Link>
        </aside>
      </div>

      <div className="cu-order-time-note">
        Placed {formatDate(order.placedAt)}
        {placedAt
          ? ` at ${placedAt.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : ""}
      </div>
    </div>
  );
}
