import { useEffect, useState } from "react";
import {
  Clock3,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";

import managerApi from "../../../services/managerApi";
import { timerState } from "../../../hooks/useOrderTimer";
import {
  Badge,
  Modal,
  dateTime,
  money,
  timeOnly,
} from "../common/ManagerUI";

export default function ManagerOrderDetailsDrawer({
  order,
  onClose,
  onOverride,
}) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const orderId = order?.orderId;

  useEffect(() => {
    if (!orderId) {
      setDetails(null);
      setError("");
      return undefined;
    }

    let active = true;

    setLoading(true);
    setError("");

    Promise.all([
      managerApi.getOrderDetails(orderId),
      managerApi.getOrderTimeline(orderId),
    ])
      .then(([orderDetails, timeline]) => {
        if (!active) return;

        setDetails({
          ...orderDetails,
          timeline: timeline.events || [],
          etaOverrides: timeline.etaOverrides || [],
        });
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Unable to load order details.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderId]);

  if (!order) return null;

  const current = details || order;
  const timer = current.promisedAt
    ? timerState(current)
    : { state: "normal", label: "—" };

  const events = current.timeline || [];

  const actualStart =
    current.startedAt ||
    events.find(
      (event) =>
        event.eventType === "ORDER_PREPARING" ||
        event.label === "Preparing",
    )?.at;

  const actualEnd =
    current.completedPrepAt ||
    current.readyAt ||
    events.find(
      (event) =>
        event.eventType === "ORDER_READY" ||
        event.label === "Ready",
    )?.at;

  const actualPrep =
    actualStart && actualEnd
      ? Math.max(
          0,
          Math.round(
            (new Date(actualEnd) - new Date(actualStart)) / 60000,
          ),
        )
      : null;

  const estimate = current.estimateExplanation || {};

  return (
    <Modal
      open={Boolean(order)}
      onClose={onClose}
      title={`Order ${order.id}`}
      wide
    >
      {loading && (
        <p className="om-form-note">Loading order details and timeline…</p>
      )}

      {error && <p className="om-form-error">{error}</p>}

      <div className="om-detail-top">
        <div>
          <Badge
            tone={
              current.rawStatus === "HANDED_OFF"
                ? "success"
                : current.rawStatus === "CANCELLED"
                  ? "danger"
                  : timer.state
            }
          >
            {current.status}
          </Badge>

          <p className="om-detail-sub">
            Placed {dateTime(current.placedAt)}
          </p>
        </div>

        <div className={`om-detail-timer ${timer.state}`}>
          <Clock3 size={17} />
          <strong>{timer.label}</strong>
        </div>
      </div>

      <div className="om-detail-grid">
        <div>
          <small>Customer</small>
          <strong>
            <UserRound size={14} /> {current.customer}
          </strong>
        </div>

        <div>
          <small>Contact</small>
          <strong>
            <Phone size={14} />{" "}
            {current.phone
              ? `${current.phone.slice(0, 3)}••••${current.phone.slice(-2)}`
              : "Not provided"}
          </strong>
        </div>

        <div>
          <small>Payment</small>
          <strong>
            <Badge
              tone={
                current.rawPaymentStatus === "SUCCEEDED"
                  ? "success"
                  : "warning"
              }
            >
              {current.paymentStatus}
            </Badge>{" "}
            {current.paymentMethod}
          </strong>
        </div>

        <div>
          <small>Promised time</small>
          <strong>{timeOnly(current.promisedAt)}</strong>
        </div>
      </div>

      {current.address && (
        <div className="om-address-note">
          <MapPin size={15} />
          {[
            current.address.line1,
            current.address.line2,
            current.address.locality,
            current.address.city,
            current.address.pincode,
          ]
            .filter(Boolean)
            .join(", ")}
        </div>
      )}

      <section className="om-detail-section">
        <h3>Order items</h3>

        {(current.items || []).map((item, index) => {
          const quantity = item.qty || item.quantity || 1;

          return (
            <div
              className="om-detail-item"
              key={item.id || `${item.name}-${index}`}
            >
              <div>
                <strong>
                  {item.name} × {quantity}
                </strong>

                <small>
                  {item.portion || "Regular"}
                  {item.addons?.length
                    ? ` · ${item.addons.join(", ")}`
                    : ""}
                </small>
              </div>

              <b>
                {money(
                  item.lineTotal ??
                    (item.price || 0) * quantity,
                )}
              </b>
            </div>
          );
        })}

        <div className="om-detail-total">
          <span>Order total</span>
          <strong>{money(current.amount)}</strong>
        </div>
      </section>

      {current.instructions && (
        <div className="om-instructions">
          <small>SPECIAL INSTRUCTIONS</small>
          <p>{current.instructions}</p>
        </div>
      )}

      <div className="om-detail-section">
        <div className="om-section-row">
          <h3>Preparation estimate</h3>

          {["ACCEPTED", "PREPARING"].includes(current.rawStatus) && (
            <button
              type="button"
              className="om-link-button"
              onClick={() => onOverride?.(current)}
            >
              Override estimate
            </button>
          )}
        </div>

        <p className="om-detail-sub">
          {current.prepMinutes || "—"} minutes estimated ·{" "}
          {actualPrep == null
            ? "Actual prep duration not recorded"
            : `${actualPrep} minutes actual preparation`}
        </p>

        <p className="om-estimate-explain">
          {current.etaOverride
            ? `Manager override: ${current.etaOverride.reason}`
            : estimate
              ? `Estimated preparation: ${estimate.predictedMinutes ?? current.prepMinutes ?? "—"} minutes. Outlet minimum: ${estimate.outletMinimumMinutes ?? "not supplied"} minutes.`
              : "Preparation estimate returned by the backend."}
        </p>
      </div>

      <div className="om-detail-section">
        <h3>Status history</h3>

        {events.length ? (
          <div className="om-timeline">
            {events.map((event, index) => (
              <div
                key={event.id || `${event.label}-${index}`}
                className="om-timeline-row"
              >
                <i />
                <div>
                  <strong>{event.label || event.eventType}</strong>
                  <small>
                    {event.at
                      ? dateTime(event.at)
                      : event.time || "Time unavailable"}
                  </small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="om-detail-sub">
            {loading ? "Loading timeline…" : "No timeline events returned."}
          </p>
        )}
      </div>

      {(current.etaOverrides || []).length > 0 && (
        <div className="om-detail-section">
          <h3>ETA override history</h3>

          {(current.etaOverrides || []).map((entry) => (
            <p key={entry.id} className="om-detail-sub">
              {entry.previousMinutes} → {entry.newMinutes} minutes ·{" "}
              {entry.reason} · {dateTime(entry.createdAt)}
            </p>
          ))}
        </div>
      )}
    </Modal>
  );
}