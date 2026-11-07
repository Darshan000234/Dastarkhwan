import { Clock3, MapPin, Phone, UserRound } from "lucide-react";
import { Badge, Modal, dateTime, money, timeOnly } from "../common/ManagerUI";
import { timerState } from "../../../hooks/useOrderTimer";
export default function ManagerOrderDetailsDrawer({
  order,
  onClose,
  onOverride,
}) {
  if (!order) return null;
  const timer = timerState(order);
  const events = order.timeline || [];
  const actualStart =
    order.startedAt ||
    events.find((event) => event.label === "Preparing" && event.at)?.at;
  const actualEnd =
    order.completedPrepAt ||
    order.readyAt ||
    events.find((event) => event.label === "Ready" && event.at)?.at;
  const actualPrep =
    actualStart && actualEnd
      ? Math.max(
          0,
          Math.round((new Date(actualEnd) - new Date(actualStart)) / 60000),
        )
      : null;
  const estimate = order.estimateExplanation || order.estimateDetails || {};
  return (
    <Modal
      open={Boolean(order)}
      onClose={onClose}
      title={`Order ${order.id}`}
      wide
    >
      <div className="om-detail-top">
        <div>
          <Badge tone={order.status === "Handed Off" ? "success" : timer.state}>
            {order.status}
          </Badge>
          <p className="om-detail-sub">Placed {dateTime(order.placedAt)}</p>
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
            <UserRound size={14} /> {order.customer}
          </strong>
        </div>
        <div>
          <small>Contact</small>
          <strong>
            <Phone size={14} />{" "}
            {order.phone
              ? `${order.phone.slice(0, 3)}••••${order.phone.slice(-2)}`
              : "Not provided"}
          </strong>
        </div>
        <div>
          <small>Payment</small>
          <strong>
            <Badge
              tone={order.paymentStatus === "Succeeded" ? "success" : "warning"}
            >
              {order.paymentStatus}
            </Badge>{" "}
            {order.paymentMethod}
          </strong>
        </div>
        <div>
          <small>Promised time</small>
          <strong>{timeOnly(order.promisedAt)}</strong>
        </div>
      </div>
      {order.address && (
        <div className="om-address-note">
          <MapPin size={15} />
          {[
            order.address.line1,
            order.address.locality,
            order.address.city,
            order.address.pincode,
          ]
            .filter(Boolean)
            .join(", ")}
        </div>
      )}
      <section className="om-detail-section">
        <h3>Order items</h3>
        {(order.items || []).map((item, index) => (
          <div className="om-detail-item" key={`${item.name}-${index}`}>
            <div>
              <strong>
                {item.name} × {item.qty || item.quantity || 1}
              </strong>
              <small>
                {item.portion || "Regular"}
                {item.addons?.length ? ` · ${item.addons.join(", ")}` : ""}
              </small>
            </div>
            <b>{money((item.price || 0) * (item.qty || item.quantity || 1))}</b>
          </div>
        ))}
        <div className="om-detail-total">
          <span>Order total</span>
          <strong>{money(order.amount)}</strong>
        </div>
      </section>
      {order.instructions && (
        <div className="om-instructions">
          <small>SPECIAL INSTRUCTIONS</small>
          <p>{order.instructions}</p>
        </div>
      )}
      <div className="om-detail-section">
        <div className="om-section-row">
          <h3>Preparation estimate</h3>
          {["Accepted", "Preparing"].includes(order.status) && (
            <button
              type="button"
              className="om-link-button"
              onClick={() => onOverride?.(order)}
            >
              Override estimate
            </button>
          )}
        </div>
        <p className="om-detail-sub">
          {order.prepMinutes || "—"} minutes promised ·{" "}
          {actualPrep == null
            ? "Actual prep duration not recorded"
            : `${actualPrep} minutes actual preparation`}
        </p>
        <p className="om-estimate-explain">
          {order.etaOverride
            ? `Manager override: ${order.etaOverride.reason}`
            : estimate.method === "Workload-based demo estimate"
              ? `Workload formula: ${estimate.baseItemMinutes} min base item prep + ${estimate.workloadMinutes} min workload (${estimate.activeOrders} active orders) + ${estimate.complexityMinutes} min item complexity = ${estimate.predictedMinutes} min predicted; outlet minimum ${estimate.outletMinimumMinutes} min.`
              : "Stored preparation estimate for this seeded demo scenario. New customer orders use the workload-based estimator."}
        </p>
      </div>
      <div className="om-detail-section">
        <h3>Status history</h3>
        <div className="om-timeline">
          {events.map((event, index) => (
            <div key={`${event.label}-${index}`} className="om-timeline-row">
              <i />
              <div>
                <strong>{event.label}</strong>
                <small>{event.at ? dateTime(event.at) : event.time}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
      {order.customerNotifications?.length > 0 && (
        <div className="om-notified-note">
          Customer notified (demo) · {order.customerNotifications.length}{" "}
          update(s)
        </div>
      )}
    </Modal>
  );
}
