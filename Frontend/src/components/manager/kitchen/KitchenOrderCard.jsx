import {
  ArrowRight,
  Clock3,
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
    order.status === "Placed"
      ? { label: "Accept Order", icon: CheckCircle2, next: "Accepted" }
      : order.status === "Accepted"
        ? { label: "Start Preparing", icon: Play, next: "Preparing" }
        : order.status === "Preparing"
          ? { label: "Mark as Ready", icon: PackageCheck, next: "Ready" }
          : order.status === "Ready"
            ? {
                label: "Mark Handed Off",
                icon: CheckCircle2,
                next: "Handed Off",
              }
            : null;
  const ActionIcon = action?.icon;
  const late = new Date(order.promisedAt).getTime() < now;
  return (
    <article
      className={`om-kitchen-card ${late ? "is-late" : ""} ${order.criticalLateNotifiedAt ? "is-critical" : ""}`}
    >
      <div className="om-kitchen-card-top">
        <div>
          <span className="om-order-number">{order.id}</span>
          <small>Received {timeOnly(order.placedAt)}</small>
        </div>
        <Badge
          tone={
            order.status === "Ready"
              ? "success"
              : late
                ? "danger"
                : order.status === "Placed"
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
          {order.items?.length || 0} dish line(s) · {money(order.amount)}
        </small>
      </div>
      <div className="om-kitchen-items">
        {(order.items || []).map((item, index) => (
          <div key={`${item.name}-${index}`}>
            <span>
              <b>{item.qty || 1}×</b> {item.name}
            </span>
            <small>
              {item.portion || "Regular"}
              {item.addons?.length ? ` · ${item.addons.join(", ")}` : ""}
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
        {order.etaOverride
          ? `Manager ETA · ${order.prepMinutes} min`
          : order.estimateExplanation?.method === "Workload-based demo estimate"
            ? `Workload estimate · ${order.prepMinutes || "—"} min · ${order.estimateExplanation.activeOrders} active orders considered`
            : `Seeded estimate · ${order.prepMinutes || "—"} min`}
      </div>
      {order.criticalLateNotifiedAt && (
        <div className="om-kitchen-notified">
          Critical · Customer notified (demo)
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
            className={`om-button kitchen-action ${action.next === "Handed Off" ? "handoff" : ""}`}
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
