import {
  ArrowRight,
  Eye,
  Flame,
  PackageCheck,
  Play,
  CheckCircle2,
} from "lucide-react";

import { Badge, money, timeOnly } from "../common/ManagerUI";
import OrderTimer from "./OrderTimer";

export default function KitchenOrderCard({
  order,
  now,
  onView,
  onAction,
  busy,
}) {
  const action =
    order.rawStatus === "PLACED"
      ? {
          label: "Accept Order",
          icon: CheckCircle2,
          next: "ACCEPTED",
        }
      : order.rawStatus === "ACCEPTED"
        ? {
            label: "Start Preparing",
            icon: Play,
            next: "PREPARING",
          }
        : order.rawStatus === "PREPARING"
          ? {
              label: "Mark as Ready",
              icon: PackageCheck,
              next: "READY",
            }
          : order.rawStatus === "READY"
            ? {
                label: "Mark Handed Off",
                icon: CheckCircle2,
                next: "HANDED_OFF",
              }
            : null;

  const ActionIcon = action?.icon;
  const late = Boolean(order.isLate);

  return (
    <article
      className={`om-kitchen-card ${late ? "is-late" : ""}`}
    >
      <div className="om-kitchen-card-top">
        <div>
          <span className="om-order-number">{order.id}</span>
          <small>Received {timeOnly(order.placedAt)}</small>
        </div>

        <Badge
          tone={
            order.rawStatus === "READY"
              ? "success"
              : late
                ? "danger"
                : order.rawStatus === "PLACED"
                  ? "warning"
                  : "info"
          }
        >
          {order.status}
        </Badge>
      </div>

      <OrderTimer order={order} now={now} />

      <div className="om-kitchen-customer">
        <strong>{order.customer}</strong>
        <small>
          {order.itemCount ?? order.items?.length ?? 0} item(s)
          {" · "}
          {money(order.amount)}
        </small>
      </div>

      <div className="om-kitchen-items">
        {(order.items || []).map((item, index) => (
          <div key={item.id || `${item.name}-${index}`}>
            <span>
              <b>{item.qty || item.quantity || 1}×</b> {item.name}
            </span>
            <small>
              {item.portion || "Regular"}
              {item.addons?.length
                ? ` · ${item.addons.join(", ")}`
                : ""}
            </small>
          </div>
        ))}
      </div>

      {order.instructions && (
        <div className="om-kitchen-instructions">
          <Flame size={14} />
          <span>{order.instructions}</span>
        </div>
      )}

      <div className="om-kitchen-promise">
        <span>Promised {timeOnly(order.promisedAt)}</span>
        <span>Payment: {order.paymentStatus}</span>
      </div>

      <div className="om-kitchen-override">
        Preparation estimate: {order.prepMinutes || "—"} min
        {order.etaOverride
          ? ` · Manager override: ${order.etaOverride.reason}`
          : ""}
      </div>

      {late && (
        <div className="om-kitchen-notified">
          Late order · {order.lateMinutes || 0} minutes past promise
        </div>
      )}

      <div className="om-kitchen-actions">
        <button
          type="button"
          className="om-button kitchen-secondary"
          onClick={() => onView(order)}
        >
          <Eye size={15} /> Details
        </button>

        {action && (
          <button
            type="button"
            className={`om-button kitchen-action ${
              action.next === "HANDED_OFF" ? "handoff" : ""
            }`}
            disabled={busy}
            onClick={() => onAction(order, action.next)}
          >
            <ActionIcon size={16} />
            {busy ? "Updating…" : action.label}
            <ArrowRight size={15} />
          </button>
        )}
      </div>
    </article>
  );
}