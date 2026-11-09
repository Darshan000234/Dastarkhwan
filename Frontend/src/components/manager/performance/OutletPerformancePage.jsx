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
import managerApi from "../../../services/managerApi";

import {
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
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");

    managerApi
      .getPerformance(range)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Unable to load performance metrics.");
          setData(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [range]);

  const trend = data?.trend || [];

  const maxOrders = Math.max(
    1,
    ...trend.map((point) => Number(point.orders || 0)),
  );

  const maxRevenue = Math.max(
    1,
    ...trend.map((point) => Number(point.revenue || 0)),
  );

  const maxPrep = Math.max(
    1,
    ...trend.map((point) => Number(point.avgPrep || 0)),
  );

  return (
    <>
      <ManagerPageHeader
        eyebrow="OUTLET-LEVEL ANALYTICS"
        title="Performance"
        description={`Operational performance for ${outlet?.name || "your assigned outlet"}. Metrics are returned by the backend.`}
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
        <div className="om-loading">Loading outlet performance…</div>
      ) : error ? (
        <p className="om-form-error">{error}</p>
      ) : data ? (
        <>
          <div className="om-metric-grid">
            <MetricCard
              icon={PackageCheck}
              label="Total orders"
              value={data.totalOrders ?? 0}
              note="Selected date range"
            />

            <MetricCard
              icon={CheckCircle2}
              label="Completed"
              value={data.completedOrders ?? 0}
              note="Handed off"
              tone="olive"
            />

            <MetricCard
              icon={XCircle}
              label="Cancelled"
              value={data.cancelledOrders ?? 0}
              note="Cancelled orders"
              tone="red"
            />

            <MetricCard
              icon={Clock3}
              label="Avg. preparation"
              value={`${data.averagePrep ?? data.averagePreparation ?? 0} min`}
              note="Backend preparation metric"
              tone="olive"
            />

            <MetricCard
              icon={Activity}
              label="Late orders"
              value={data.lateOrders ?? 0}
              note="Past promised time"
              tone="red"
            />

            <MetricCard
              icon={IndianRupee}
              label="Revenue"
              value={money(data.revenue)}
              note="Backend-reported revenue"
            />
          </div>

          <div className="om-performance-grid">
            <Panel
              title="Order volume"
              subtitle="Orders received in selected period"
            >
              {trend.length ? (
                <div className="om-chart-bars">
                  {trend.map((point, index) => (
                    <div
                      className="om-chart-column"
                      key={`${point.label}-${index}`}
                    >
                      <span>{point.orders || 0}</span>
                      <div>
                        <i
                          style={{
                            height: `${Math.max(
                              3,
                              (Number(point.orders || 0) / maxOrders) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                      <small>{point.label}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  title="No order trend"
                  detail="The backend returned no trend points for this range."
                />
              )}
            </Panel>

            <Panel
              title="Revenue trend"
              subtitle="Backend-reported revenue by period"
            >
              {trend.length ? (
                <div className="om-chart-bars revenue">
                  {trend.map((point, index) => (
                    <div
                      className="om-chart-column"
                      key={`${point.label}-${index}`}
                    >
                      <span>
                        {point.revenue ? money(point.revenue) : "—"}
                      </span>
                      <div>
                        <i
                          style={{
                            height: `${Math.max(
                              3,
                              (Number(point.revenue || 0) / maxRevenue) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                      <small>{point.label}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  title="No revenue trend"
                  detail="No revenue trend points were returned."
                />
              )}
            </Panel>
          </div>

          <div className="om-performance-grid">
            <Panel
              title="Order status distribution"
              subtitle="Current status of orders in this period"
            >
              <div className="om-status-distribution">
                {(data.statusDistribution || []).map((row) => (
                  <div key={row.rawStatus || row.status}>
                    <span>{row.status}</span>
                    <div>
                      <i
                        style={{
                          width: `${
                            data.totalOrders
                              ? (row.count / data.totalOrders) * 100
                              : 0
                          }%`,
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
              subtitle="Backend completion timing metrics"
            >
              <div className="om-prep-stats">
                <div>
                  <small>Completed within promised time</small>
                  <strong>
                    {data.onTime ?? 0} / {data.onTimeMeasured ?? 0}
                  </strong>
                </div>

                <div>
                  <small>Average delay</small>
                  <strong>
                    {data.averageDelay == null
                      ? "—"
                      : `${data.averageDelay} min`}
                  </strong>
                </div>

                <div>
                  <small>Orders with manager ETA override</small>
                  <strong>{data.overrides ?? 0}</strong>
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
            subtitle="Backend-reported preparation trend"
          >
            {trend.length ? (
              <div className="om-chart-bars prep">
                {trend.map((point, index) => (
                  <div
                    className="om-chart-column"
                    key={`${point.label}-${index}`}
                  >
                    <span>
                      {point.avgPrep ? `${point.avgPrep}m` : "—"}
                    </span>
                    <div>
                      <i
                        style={{
                          height: `${Math.max(
                            3,
                            (Number(point.avgPrep || 0) / maxPrep) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                    <small>{point.label}</small>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="No preparation trend"
                detail="No preparation trend points were returned."
              />
            )}
          </Panel>

          <Panel
            title="Popular dishes"
            subtitle="Sorted by paid quantity in this period"
          >
            {data.popular?.length ? (
              <div className="om-popular-table">
                {data.popular.map((item, index) => (
                  <div key={item.id || item.name}>
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
            <TrendingUp size={14} /> Metrics are retrieved from the
            authenticated manager performance endpoint.
          </p>
        </>
      ) : (
        <Empty
          title="No performance data"
          detail="The backend did not return performance data for this range."
        />
      )}
    </>
  );
}