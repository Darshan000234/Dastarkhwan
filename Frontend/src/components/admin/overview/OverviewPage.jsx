import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Clock3,
  IndianRupee,
  ShoppingBag,
  UsersRound,
  ArrowUpRight,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { adminApi } from "../../../services/adminApi.js";
import {
  MetricCard,
  PageHeader,
  StatusBadge,
  money,
  statusTone,
} from "../common/AdminUI";
import OrderDetailsDrawer from "../orders/OrderDetailsDrawer";
import { BarChart, DonutChart, TrendChart } from "../common/Charts";

export default function OverviewPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    adminApi
      .getAdminOverview()
      .then((result) => {
        if (mounted) setData(result);
      })
      .catch((err) => {
        if (mounted) setError(err.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading)
    return <div className="ad-loading">Preparing your chain overview…</div>;
  if (error || !data)
    return (
      <div className="ad-inline-error">
        {error || "Overview could not be loaded."}
      </div>
    );

  const icons = {
    orders: ShoppingBag,
    revenue: IndianRupee,
    time: Clock3,
    cancel: Activity,
    customers: UsersRound,
  };
  const attention = [
    ...data.lateOrders.map((order) => ({
      title: `${order.id} is past its promised time`,
      detail: `${order.customer} · ${data.outlets.find((outlet) => outlet.id === order.outletId)?.name || "Outlet"}`,
      tone: "danger",
    })),
    ...data.outlets
      .filter((outlet) => !outlet.active)
      .map((outlet) => ({
        title: `${outlet.name} is inactive`,
        detail: "Review this outlet's operational status.",
        tone: "warning",
      })),
    ...data.outlets
      .filter((outlet) => !outlet.manager)
      .map((outlet) => ({
        title: `${outlet.name} has no designated manager`,
        detail: "Assign a verified Outlet Manager.",
        tone: "warning",
      })),
    ...data.unavailableItems.map(({ outlet, item }) => ({
      title: `${item.name} is unavailable at ${outlet.name}`,
      detail: "The mapping remains visible to administrators.",
      tone: "neutral",
    })),
    ...data.paymentIssues.map((order) => ({
      title: `${order.paymentStatus} payment · ${order.id}`,
      detail: `${order.customer} · ${money(order.amount)} · ${order.status}`,
      tone: order.paymentStatus === "Failed" ? "danger" : "warning",
    })),
  ];

  return (
    <>
      <PageHeader
        eyebrow="CHAIN-WIDE SNAPSHOT"
        title="Good afternoon, Mihir"
        description="A clear view of how the Dastarkhwan restaurant chain is performing."
        actions={
          <span className="ad-date-chip">
            Demo snapshot ·{" "}
            {new Date().toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        }
      />
      <section className="ad-kpi-grid">
        {data.kpis.map((metric) => (
          <MetricCard
            key={metric.label}
            {...metric}
            icon={icons[metric.icon]}
            tone={
              metric.icon === "cancel"
                ? "red"
                : metric.icon === "time"
                  ? "olive"
                  : "rust"
            }
            value={
              metric.format === "currency" ? money(metric.value) : metric.value
            }
          />
        ))}
      </section>

      <section className="ad-overview-grid">
        <article className="ad-panel">
          <div className="ad-panel-header">
            <div>
              <h2>Order activity</h2>
              <p>Order records by day, based on sample data timestamps</p>
            </div>
            <span className="ad-panel-meta">Orders</span>
          </div>
          <TrendChart data={data.orderTrend} />
        </article>
        <article className="ad-panel">
          <div className="ad-panel-header">
            <div>
              <h2>Order status mix</h2>
              <p>Current order-state distribution</p>
            </div>
          </div>
          <DonutChart data={data.statusCounts} />
        </article>
      </section>

      <section className="ad-panel ad-section-gap">
        <div className="ad-panel-header">
          <div>
            <h2>Revenue by outlet</h2>
            <p>Successful payments only · prices include 5% GST</p>
          </div>
          <span className="ad-panel-meta">INR</span>
        </div>
        <BarChart data={data.revenueByOutlet} valueKey="value" money />
      </section>

      <section className="ad-panel ad-section-gap">
        <div className="ad-panel-header">
          <div>
            <h2>Outlet performance</h2>
            <p>Chain-wide operational snapshot</p>
          </div>
          <Link className="ad-inline-link" to="/admin/outlets">
            All outlets <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Outlet</th>
                <th>Type / City</th>
                <th>Orders</th>
                <th>Revenue</th>
                <th>Avg. prep</th>
                <th>Manager</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.outlets.map((outlet) => {
                const outletOrders = data.orders.filter(
                  (order) => order.outletId === outlet.id,
                );
                const revenue = outletOrders
                  .filter((order) => order.paymentStatus === "Succeeded")
                  .reduce((sum, order) => sum + order.amount, 0);
                const prepRows = outletOrders.filter(
                  (order) => order.prepMinutes > 0,
                );
                const avgPrep = prepRows.length
                  ? Math.round(
                      prepRows.reduce(
                        (sum, order) => sum + order.prepMinutes,
                        0,
                      ) / prepRows.length,
                    )
                  : outlet.prepTime;
                return (
                  <tr key={outlet.id}>
                    <td>
                      <Link
                        className="ad-strong-link"
                        to={`/admin/outlets/${outlet.id}`}
                      >
                        {outlet.name}
                      </Link>
                      <small>{outlet.code}</small>
                    </td>
                    <td>
                      {outlet.type}
                      <small>{outlet.city}</small>
                    </td>
                    <td>{outletOrders.length}</td>
                    <td>{money(revenue)}</td>
                    <td>{avgPrep} min</td>
                    <td>
                      {outlet.manager ? (
                        outlet.manager.name
                      ) : (
                        <span className="ad-text-danger">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge tone={outlet.active ? "success" : "warning"}>
                        {outlet.active ? "Active" : "Inactive"}
                      </StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ad-overview-grid ad-section-gap">
        <article className="ad-panel">
          <div className="ad-panel-header">
            <div>
              <h2>Recent orders</h2>
              <p>Latest orders across all kitchens</p>
            </div>
            <Link className="ad-inline-link" to="/admin/orders">
              View all <ChevronRight size={15} />
            </Link>
          </div>
          <div className="ad-compact-list">
            {data.orders
              .slice()
              .sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt))
              .slice(0, 5)
              .map((order) => {
                const outlet = data.outlets.find(
                  (entry) => entry.id === order.outletId,
                );
                return (
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(order)}
                    className="ad-compact-row"
                    key={order.id}
                  >
                    <span className="ad-order-dot">
                      <ShoppingBag size={16} />
                    </span>
                    <span className="ad-compact-main">
                      <strong>{order.id}</strong>
                      <small>
                        {order.customer} · {outlet?.name}
                      </small>
                    </span>
                    <span className="ad-compact-end">
                      <strong>{money(order.amount)}</strong>
                      <StatusBadge tone={statusTone(order.paymentStatus)}>
                        {order.paymentStatus}
                      </StatusBadge>
                      <StatusBadge tone={statusTone(order.status)}>
                        {order.status}
                      </StatusBadge>
                    </span>
                  </button>
                );
              })}
          </div>
        </article>
        <article className="ad-panel">
          <div className="ad-panel-header">
            <div>
              <h2>Attention required</h2>
              <p>Issues derived from current demo records</p>
            </div>
            <AlertTriangle size={18} className="ad-text-warning" />
          </div>
          {attention.length ? (
            <div className="ad-alert-list">
              {attention.slice(0, 7).map((item, index) => (
                <div className="ad-alert-row" key={`${item.title}-${index}`}>
                  <span className={`ad-alert-icon ad-alert-${item.tone}`}>
                    <AlertTriangle size={15} />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="ad-empty-inline">No issues need attention.</div>
          )}
        </article>
      </section>
      <OrderDetailsDrawer
        order={selectedOrder}
        outletName={
          selectedOrder
            ? data.outlets.find(
                (outlet) => outlet.id === selectedOrder.outletId,
              )?.name || ""
            : ""
        }
        onClose={() => setSelectedOrder(null)}
      />
    </>
  );
}
