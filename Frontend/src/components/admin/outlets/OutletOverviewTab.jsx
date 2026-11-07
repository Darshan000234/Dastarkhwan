import { useEffect, useState } from "react";
import {
  Activity,
  Clock3,
  IndianRupee,
  ShoppingBag,
  UsersRound,
  AlertTriangle,
} from "lucide-react";
import { mockApi } from "../../../services/mockApi";
import { MetricCard, StatusBadge, money } from "../common/AdminUI";
import { BarChart, DonutChart } from "../common/Charts";

export default function OutletOverviewTab({ outlet }) {
  const [analytics, setAnalytics] = useState(null);
  useEffect(() => {
    let mounted = true;
    mockApi.getOutletAnalytics(outlet.id).then((data) => {
      if (mounted) setAnalytics(data);
    });
    return () => {
      mounted = false;
    };
  }, [outlet.id]);
  if (!analytics)
    return <div className="ad-loading">Loading outlet analytics…</div>;
  const mostOrdered = Object.entries(
    analytics.orders.reduce((acc, order) => {
      order.items.forEach((item) => {
        acc[item.name] = (acc[item.name] || 0) + item.qty;
      });
      return acc;
    }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const metrics = [
    {
      label: "Sample orders",
      value: analytics.orderCount,
      note: "Orders linked to this outlet",
      icon: ShoppingBag,
    },
    {
      label: "Paid revenue",
      value: money(analytics.revenue),
      note: "Successful payments",
      icon: IndianRupee,
    },
    {
      label: "Average preparation",
      value: `${analytics.avgPrep} min`,
      note: "Outlet baseline",
      icon: Clock3,
    },
    {
      label: "Average order value",
      value: money(analytics.avgOrder),
      note: "Paid orders only",
      icon: Activity,
    },
  ];
  return (
    <div className="ad-tab-content">
      <div className="ad-kpi-grid ad-kpi-four">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>
      <div className="ad-overview-grid ad-section-gap">
        <section className="ad-panel">
          <div className="ad-panel-header">
            <div>
              <h2>Outlet configuration</h2>
              <p>Service coverage and operational information</p>
            </div>
            <StatusBadge tone={outlet.active ? "success" : "warning"}>
              {outlet.active ? "Active" : "Inactive"}
            </StatusBadge>
          </div>
          <div className="ad-info-grid">
            <div>
              <small>Outlet code</small>
              <strong>{outlet.code}</strong>
            </div>
            <div>
              <small>Outlet type</small>
              <strong>{outlet.type}</strong>
            </div>
            <div>
              <small>Complete address</small>
              <strong>{outlet.address}</strong>
            </div>
            <div>
              <small>City</small>
              <strong>{outlet.city}</strong>
            </div>
            <div>
              <small>Primary pincode</small>
              <strong>{outlet.primaryPincode}</strong>
            </div>
            <div>
              <small>Serviceable pincodes</small>
              <strong>{outlet.pincodes.join(", ")}</strong>
            </div>
            <div>
              <small>Delivery radius</small>
              <strong>{outlet.radius} km</strong>
            </div>
            <div>
              <small>Contact mobile</small>
              <strong>
                {outlet.phone ? `+91 ${outlet.phone}` : "Not provided"}
              </strong>
            </div>
            <div>
              <small>Operating hours</small>
              <strong>
                {outlet.openTime} – {outlet.closeTime}
              </strong>
            </div>
            <div>
              <small>Operating days</small>
              <strong>{outlet.days.join(", ")}</strong>
            </div>
            <div>
              <small>Minimum prep</small>
              <strong>{outlet.prepTime} minutes</strong>
            </div>
            <div>
              <small>Food support</small>
              <strong>
                {[outlet.veg && "Veg", outlet.nonVeg && "Non-veg"]
                  .filter(Boolean)
                  .join(" · ") || "Not configured"}
              </strong>
            </div>
            <div className="ad-span-2">
              <small>FSSAI record</small>
              <strong>
                {outlet.fssai} <em>· verify before launch</em>
              </strong>
            </div>
          </div>
        </section>
        <section className="ad-panel">
          <div className="ad-panel-header">
            <div>
              <h2>Outlet order status</h2>
              <p>Distribution of this outlet's sample orders</p>
            </div>
          </div>
          <DonutChart
            data={[
              "Placed",
              "Accepted",
              "Preparing",
              "Ready",
              "Handed Off",
              "Cancelled",
            ].map((status) => ({
              name: status,
              value: analytics.orders.filter((order) => order.status === status)
                .length,
            }))}
          />
          <div className="ad-outlet-analytic-strip">
            <div>
              <small>Cancelled</small>
              <strong>{analytics.cancelled}</strong>
            </div>
            <div>
              <small>Late orders</small>
              <strong>{analytics.late}</strong>
            </div>
            <div>
              <small>Repeat customer rate</small>
              <strong>{analytics.repeatRate}%</strong>
            </div>
          </div>
        </section>
      </div>
      <section className="ad-panel ad-section-gap">
        <div className="ad-panel-header">
          <div>
            <h2>Most ordered dishes</h2>
            <p>Quantity totals from this outlet's sample order lines</p>
          </div>
        </div>
        {mostOrdered.length ? (
          <BarChart data={mostOrdered} />
        ) : (
          <div className="ad-empty-inline">No dish quantities available.</div>
        )}
      </section>
      <div className="ad-note-line">
        <UsersRound size={15} /> Analytics are calculated from the outlet-linked
        demo order dataset. They are not live performance figures.
      </div>
    </div>
  );
}
