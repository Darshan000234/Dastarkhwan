import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ClipboardList,
  IndianRupee,
  PackageCheck,
  Timer,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useManager } from "../../../context/ManagerContext";
import { useOrderTimer, timerState } from "../../../hooks/useOrderTimer";
import {
  Badge,
  Empty,
  ManagerPageHeader,
  MetricCard,
  Panel,
  dateTime,
  money,
  timeOnly,
} from "../common/ManagerUI";
import ManagerOrderDetailsDrawer from "../orders/ManagerOrderDetailsDrawer";
export default function ManagerOverviewPage() {
  const { outlet, manager, orders, menu, overview } = useManager();
  const [selected, setSelected] = useState(null);
  const now = useOrderTimer();
  const popular = useMemo(() => {
    const rows = new Map();
    orders
      .filter((order) => order.paymentStatus === "Succeeded")
      .forEach((order) =>
        (order.items || []).forEach((item) => {
          const key = item.itemId || item.name;
          const value = rows.get(key) || {
            name: item.name,
            qty: 0,
            revenue: 0,
          };
          value.qty += Number(item.qty || 1);
          value.revenue += Number(item.qty || 1) * Number(item.price || 0);
          rows.set(key, value);
        }),
      );
    return [...rows.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [orders]);
  const kpi = overview || {};
  return (
    <>
      <ManagerPageHeader
        eyebrow="YOUR KITCHEN AT A GLANCE"
        title="Good shift, good service."
        description="A live operational snapshot of your assigned outlet."
        actions={
          <Link className="om-button primary" to="/manager/kitchen">
            <ChefIcon /> Open Kitchen Display <ArrowRight size={15} />
          </Link>
        }
      />
      <section className="om-outlet-banner">
        <div>
          <span className="om-eyebrow">ASSIGNED OUTLET</span>
          <h2>{outlet.name}</h2>
          <p>
            {outlet.type} · {outlet.city} · {outlet.address}
          </p>
        </div>
        <div className="om-outlet-banner-meta">
          <Badge tone={outlet.active ? "success" : "danger"}>
            {outlet.active ? "Operational" : "Inactive"}
          </Badge>
          <span>
            <Clock3 size={14} /> {outlet.openTime}–{outlet.closeTime} IST
          </span>
          <span>Manager: {manager.name}</span>
        </div>
      </section>
      <div className="om-metric-grid">
        <MetricCard
          icon={ClipboardList}
          label="Orders today"
          value={kpi.ordersToday ?? 0}
          note="All order states"
        />
        <MetricCard
          icon={Activity}
          label="Active orders"
          value={kpi.activeOrders ?? 0}
          note="Paid · in kitchen or handoff"
          tone="olive"
        />
        <MetricCard
          icon={Timer}
          label="Avg. prep time"
          value={`${kpi.averagePrep ?? 0} min`}
          note="Recorded durations or seeded estimates"
          tone="olive"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Late orders"
          value={kpi.lateOrders ?? 0}
          note="Past promised time"
          tone="red"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Completed"
          value={kpi.completedOrders ?? 0}
          note="Handed off successfully"
          tone="olive"
        />
        <MetricCard
          icon={IndianRupee}
          label="Revenue today"
          value={money(kpi.revenueToday)}
          note="Paid orders only"
        />{" "}
      </div>
      <div className="om-overview-grid">
        <Panel
          title="Kitchen workload"
          subtitle="Successfully paid orders only"
          action={
            <Link to="/manager/kitchen" className="om-text-link">
              Open KDS <ArrowRight size={14} />
            </Link>
          }
        >
          <div className="om-queue-summary">
            <div>
              <strong>{kpi.queue?.new || 0}</strong>
              <span>New</span>
            </div>
            <div>
              <strong>{kpi.queue?.preparing || 0}</strong>
              <span>Preparing</span>
            </div>
            <div>
              <strong>{kpi.queue?.ready || 0}</strong>
              <span>Ready</span>
            </div>
            <div className="late">
              <strong>{kpi.queue?.late || 0}</strong>
              <span>Late</span>
            </div>
          </div>
          <div className="om-queue-foot">
            Timers refresh locally · current time{" "}
            {new Date(now).toLocaleTimeString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            IST
          </div>
        </Panel>
        <Panel
          title="Attention required"
          subtitle="Alerts derived from your outlet data"
        >
          {kpi.attention?.length ? (
            <div className="om-alert-list">
              {kpi.attention.slice(0, 6).map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  className={`om-alert-row ${alert.tone}`}
                  onClick={() =>
                    alert.orderId &&
                    setSelected(
                      orders.find((order) => order.id === alert.orderId),
                    )
                  }
                >
                  <span>
                    <AlertTriangle size={16} />
                  </span>
                  <div>
                    <strong>{alert.title}</strong>
                    <small>{alert.detail}</small>
                  </div>
                  {alert.orderId && <ArrowRight size={15} />}
                </button>
              ))}
            </div>
          ) : (
            <Empty
              title="All clear"
              detail="No active operational alerts right now."
            />
          )}
        </Panel>
      </div>
      <div className="om-overview-grid">
        <Panel
          title="Recent orders"
          subtitle="Latest activity from this outlet"
          action={
            <Link to="/manager/orders" className="om-text-link">
              All orders <ArrowRight size={14} />
            </Link>
          }
        >
          {orders.length ? (
            <div className="om-recent-list">
              {[...orders]
                .sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt))
                .slice(0, 6)
                .map((order) => {
                  const timer = timerState(order, now);
                  return (
                    <button
                      type="button"
                      key={order.id}
                      className="om-recent-row"
                      onClick={() => setSelected(order)}
                    >
                      <div>
                        <strong>{order.id}</strong>
                        <small>
                          {order.customer} · {order.itemSummary}
                        </small>
                      </div>
                      <div>
                        <Badge
                          tone={
                            order.paymentStatus === "Succeeded"
                              ? "success"
                              : "warning"
                          }
                        >
                          {order.status}
                        </Badge>
                        <small>
                          {timeOnly(order.placedAt)} ·{" "}
                          {order.status === "Preparing"
                            ? timer.label
                            : order.paymentStatus}
                        </small>
                      </div>
                    </button>
                  );
                })}
            </div>
          ) : (
            <Empty
              title="No orders yet"
              detail="New customer orders will appear here."
            />
          )}
        </Panel>
        <Panel title="Popular dishes" subtitle="Ranked by paid item quantity">
          {popular.length ? (
            <div className="om-popular-list">
              {popular.map((item, index) => (
                <div key={item.name}>
                  <span className="om-rank">0{index + 1}</span>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.qty} ordered</small>
                  </div>
                  <b>{money(item.revenue)}</b>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="No sales data"
              detail="Paid order items will appear here."
            />
          )}
        </Panel>
      </div>
      <ManagerOrderDetailsDrawer
        order={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
function ChefIcon() {
  return <PackageCheck size={16} />;
}
