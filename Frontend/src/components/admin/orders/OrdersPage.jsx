import { useEffect, useState } from "react";
import { Filter, Eye } from "lucide-react";
import { mockApi } from "../../../services/mockApi";
import {
  PageHeader,
  SearchBox,
  Select,
  StatusBadge,
  money,
  formatDate,
  statusTone,
} from "../common/AdminUI";
import OrderDetailsDrawer from "./OrderDetailsDrawer";

const ORDER_STATUSES = [
  "Placed",
  "Accepted",
  "Preparing",
  "Ready",
  "Handed Off",
  "Cancelled",
];
const PAYMENT_STATUSES = ["Pending", "Succeeded", "Failed"];

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [search, setSearch] = useState("");
  const [outletId, setOutletId] = useState("all");
  const [status, setStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      mockApi.getOrders({ search, outletId, status, paymentStatus, from, to }),
      mockApi.getOutlets(),
    ])
      .then(([rows, outletRows]) => {
        if (mounted) {
          setOrders(rows);
          setOutlets(outletRows);
          setError("");
        }
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
  }, [search, outletId, status, paymentStatus, from, to]);

  const outletName = (id) =>
    outlets.find((outlet) => outlet.id === id)?.name || "Unknown outlet";
  const resetFilters = () => {
    setSearch("");
    setOutletId("all");
    setStatus("all");
    setPaymentStatus("all");
    setFrom("");
    setTo("");
  };

  return (
    <>
      <PageHeader
        eyebrow="CHAIN-WIDE MONITORING"
        title="Orders"
        description="Review orders across every outlet. Kitchen-stage operations remain with the assigned Outlet Manager."
      />
      <div className="ad-filter-row">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Search order ID, customer or phone…"
        />
        <Select value={outletId} onChange={setOutletId}>
          <option value="all">All outlets</option>
          {outlets.map((outlet) => (
            <option key={outlet.id} value={outlet.id}>
              {outlet.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={setStatus}>
          <option value="all">All order statuses</option>
          {ORDER_STATUSES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
        <Select value={paymentStatus} onChange={setPaymentStatus}>
          <option value="all">All payment statuses</option>
          {PAYMENT_STATUSES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
        <label className="ad-date-filter">
          <span>From</span>
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className="ad-date-filter">
          <span>To</span>
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="ad-button ad-button-quiet"
          onClick={resetFilters}
        >
          Clear filters
        </button>
      </div>
      <section className="ad-panel">
        <div className="ad-panel-header">
          <div>
            <h2>Order register</h2>
            <p>
              {orders.length} matching record{orders.length === 1 ? "" : "s"} ·
              payment and fulfilment statuses are separate
            </p>
          </div>
          <span className="ad-panel-meta">
            <Filter size={14} /> Filtered view
          </span>
        </div>
        {error && <div className="ad-inline-error">{error}</div>}
        {loading ? (
          <div className="ad-loading">Loading orders…</div>
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Outlet</th>
                  <th>Items summary</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Order status</th>
                  <th>Order time</th>
                  <th>Promise</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.id}</strong>
                    </td>
                    <td>
                      {order.customer}
                      <small>{order.phone}</small>
                    </td>
                    <td>{outletName(order.outletId)}</td>
                    <td className="ad-cell-truncate" title={order.itemSummary}>
                      {order.itemSummary}
                    </td>
                    <td>
                      <strong>{money(order.amount)}</strong>
                      <small>GST inclusive</small>
                    </td>
                    <td>
                      <StatusBadge tone={statusTone(order.paymentStatus)}>
                        {order.paymentStatus}
                      </StatusBadge>
                      <small>{order.paymentMethod}</small>
                    </td>
                    <td>
                      <StatusBadge tone={statusTone(order.status)}>
                        {order.status}
                      </StatusBadge>
                    </td>
                    <td>
                      {order.placedLabel}
                      <small>{formatDate(order.placedAt)}</small>
                    </td>
                    <td>
                      {order.promisedLabel}
                      {order.status === "Preparing" &&
                        order.paymentStatus === "Succeeded" &&
                        new Date(order.promisedAt).getTime() < Date.now() && (
                          <small className="ad-text-danger">Late</small>
                        )}
                    </td>
                    <td>
                      <button
                        className="ad-row-action"
                        type="button"
                        onClick={() => setSelected(order)}
                        title={`View ${order.id}`}
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders.length === 0 && (
              <div className="ad-empty-inline">
                No orders match the selected filters.
              </div>
            )}
          </div>
        )}
      </section>
      <OrderDetailsDrawer
        order={selected}
        outletName={selected ? outletName(selected.outletId) : ""}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
