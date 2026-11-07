import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock3,
  IndianRupee,
  PackageCheck,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useManager } from "../../../context/ManagerContext";
import { mockOutletManagerApi } from "../../../services/mockOutletManagerApi";
import {
  Badge,
  Empty,
  ManagerPageHeader,
  MetricCard,
  Panel,
  money,
} from "../common/ManagerUI";
export default function OutletPerformancePage() {
  const { outlet } = useManager();
  const [range, setRange] = useState("7d");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    mockOutletManagerApi
      .getPerformance(range)
      .then((result) => {
        if (alive) setData(result);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [range]);
  const maxOrders = Math.max(1, ...(data?.trend || []).map((x) => x.orders));
  const maxRevenue = Math.max(1, ...(data?.trend || []).map((x) => x.revenue));
  const maxPrep = Math.max(1, ...(data?.trend || []).map((x) => x.avgPrep));
  return (
    <>
      <ManagerPageHeader
        eyebrow="OUTLET-LEVEL ANALYTICS"
        title="Performance"
        description={`Operational performance for ${outlet.name}. Only this outlet's order records are included.`}
        actions={
          <div className="om-range-switch">
            {[
              ["today", "Today"],
              ["7d", "7 days"],
              ["30d", "30 days"],
            ].map(([key, label]) => (
              <button
                type="button"
                key={key}
                className={range === key ? "active" : ""}
                onClick={() => setRange(key)}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />
      {loading ? (
        <div className="om-loading">Calculating outlet performance…</div>
      ) : (
        data && (
          <>
            <div className="om-metric-grid">
              <MetricCard
                icon={PackageCheck}
                label="Total orders"
                value={data.totalOrders}
                note="Selected date range"
              />
              <MetricCard
                icon={CheckCircle2}
                label="Completed"
                value={data.completedOrders}
                note="Handed off"
                tone="olive"
              />
              <MetricCard
                icon={XCircle}
                label="Cancelled"
                value={data.cancelledOrders}
                note="All cancellation reasons"
                tone="red"
              />
              <MetricCard
                icon={Clock3}
                label="Avg. preparation"
                value={`${data.averagePrep} min`}
                note="Durations or legacy estimates"
                tone="olive"
              />
              <MetricCard
                icon={Activity}
                label="Late orders"
                value={data.lateOrders}
                note="Past promised time"
                tone="red"
              />
              <MetricCard
                icon={IndianRupee}
                label="Revenue"
                value={money(data.revenue)}
                note="Paid, non-cancelled orders"
              />
            </div>
            <div className="om-performance-grid">
              <Panel
                title="Order volume"
                subtitle="Orders received in selected period"
              >
                <div className="om-chart-bars">
                  {data.trend.map((point, index) => (
                    <div
                      className="om-chart-column"
                      key={`${point.label}-${index}`}
                    >
                      <span>{point.orders}</span>
                      <div>
                        <i
                          style={{
                            height: `${Math.max(3, (point.orders / maxOrders) * 100)}%`,
                          }}
                        />
                      </div>
                      <small>{point.label}</small>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel
                title="Revenue trend"
                subtitle="Successful payments, excluding cancellations"
              >
                <div className="om-chart-bars revenue">
                  {data.trend.map((point, index) => (
                    <div
                      className="om-chart-column"
                      key={`${point.label}-${index}`}
                    >
                      <span>{point.revenue ? money(point.revenue) : "—"}</span>
                      <div>
                        <i
                          style={{
                            height: `${Math.max(3, (point.revenue / maxRevenue) * 100)}%`,
                          }}
                        />
                      </div>
                      <small>{point.label}</small>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
            <div className="om-performance-grid">
              <Panel
                title="Order status distribution"
                subtitle="Current status of orders in this period"
              >
                <div className="om-status-distribution">
                  {data.statusDistribution.map((row) => (
                    <div key={row.status}>
                      <span>{row.status}</span>
                      <div>
                        <i
                          style={{
                            width: `${data.totalOrders ? (row.count / data.totalOrders) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <b>{row.count}</b>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel
                title="Preparation performance"
                subtitle="Based on completed order timestamps where available"
              >
                <div className="om-prep-stats">
                  <div>
                    <small>Completed within promised time</small>
                    <strong>
                      {data.onTime} / {data.onTimeMeasured}
                    </strong>
                  </div>
                  <div>
                    <small>Average delay</small>
                    <strong>{data.averageDelay} min</strong>
                  </div>
                  <div>
                    <small>Orders with manager ETA override</small>
                    <strong>{data.overrides}</strong>
                  </div>
                  <div>
                    <small>Average order value</small>
                    <strong>{money(data.averageOrderValue)}</strong>
                  </div>
                </div>
              </Panel>
            </div>
            <Panel
              title="Average preparation time trend"
              subtitle="Completed orders only · estimate used for legacy sample orders"
            >
              <div className="om-chart-bars prep">
                {data.trend.map((point, index) => (
                  <div
                    className="om-chart-column"
                    key={`${point.label}-${index}`}
                  >
                    <span>{point.avgPrep ? `${point.avgPrep}m` : "—"}</span>
                    <div>
                      <i
                        style={{
                          height: `${Math.max(3, (point.avgPrep / maxPrep) * 100)}%`,
                        }}
                      />
                    </div>
                    <small>{point.label}</small>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel
              title="Popular dishes"
              subtitle="Sorted by paid quantity in this period"
            >
              {data.popular.length ? (
                <div className="om-popular-table">
                  {data.popular.map((item, index) => (
                    <div key={item.id}>
                      <span className="om-rank">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <strong>{item.name}</strong>
                      <span>{item.quantity} units</span>
                      <b>{money(item.revenue)}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  title="No paid dishes yet"
                  detail="Paid order items will be ranked here."
                />
              )}
            </Panel>
            <p className="om-analytics-note">
              <TrendingUp size={14} /> Metrics are calculated from the shared
              local demo order collection. They are not production reporting.
            </p>
          </>
        )
      )}
    </>
  );
}
