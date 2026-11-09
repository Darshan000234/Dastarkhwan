import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { adminApi } from "../../../services/adminApi.js";
import {
  SearchBox,
  Select,
  StatusBadge,
  money,
  formatDate,
  statusTone,
} from "../common/AdminUI";
import OrderDetailsDrawer from "../orders/OrderDetailsDrawer";

export default function OutletOrdersTab({ outlet }) {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    let mounted = true;
    adminApi.getOrders({ outletId: outlet.id }).then((rows) => {
      if (mounted) setOrders(rows);
    });
    return () => {
      mounted = false;
    };
  }, [outlet.id]);
  const filtered = orders.filter(
    (order) =>
      (order.id.toLowerCase().includes(search.toLowerCase()) ||
        order.customer.toLowerCase().includes(search.toLowerCase())) &&
      (status === "all" || order.status === status),
  );
  return (
    <section className="ad-panel ad-section-gap">
      <div className="ad-panel-header">
        <div>
          <h2>Orders for {outlet.name}</h2>
          <p>
            Only orders linked to this outlet are shown. Central Admin is
            monitoring, not operating the kitchen.
          </p>
        </div>
        <StatusBadge tone="neutral">{orders.length} sample orders</StatusBadge>
      </div>
      <div className="ad-filter-row">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Search order or customer…"
        />
        <Select value={status} onChange={setStatus}>
          <option value="all">All statuses</option>
          {[
            "Placed",
            "Accepted",
            "Preparing",
            "Ready",
            "Handed Off",
            "Cancelled",
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
      </div>
      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Order value</th>
              <th>Payment</th>
              <th>Order status</th>
              <th>Received</th>
              <th>Promised</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id}>
                <td>
                  <strong>{order.id}</strong>
                </td>
                <td>{order.customer}</td>
                <td>{order.itemSummary}</td>
                <td>
                  {money(order.amount)}
                  <small>GST inclusive</small>
                </td>
                <td>
                  <StatusBadge tone={statusTone(order.paymentStatus)}>
                    {order.paymentStatus}
                  </StatusBadge>
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
                <td>{order.promisedLabel}</td>
                <td>
                  <button
                    type="button"
                    className="ad-row-action"
                    onClick={() => setSelected(order)}
                  >
                    <Eye size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="ad-empty-inline">No orders match these filters.</div>
        )}
      </div>
      <OrderDetailsDrawer
        order={selected}
        outletName={outlet.name}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}
