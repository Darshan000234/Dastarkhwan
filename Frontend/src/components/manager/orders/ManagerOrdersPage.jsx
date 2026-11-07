import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Eye, Filter, Search } from "lucide-react";
import { useManager } from "../../../context/ManagerContext";
import {
  Badge,
  Empty,
  ManagerPageHeader,
  money,
  timeOnly,
} from "../common/ManagerUI";
import ManagerOrderDetailsDrawer from "./ManagerOrderDetailsDrawer";
const statuses = [
  "Placed",
  "Accepted",
  "Preparing",
  "Ready",
  "Handed Off",
  "Cancelled",
];
export default function ManagerOrdersPage() {
  const { orders } = useManager();
  const { orderId } = useParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [payment, setPayment] = useState("all");
  const [scope, setScope] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (orderId)
      setSelected(orders.find((order) => order.id === orderId) || null);
  }, [orderId, orders]);
  const rows = useMemo(
    () =>
      orders
        .filter((order) => {
          const q = search.toLowerCase();
          const placed = new Date(order.placedAt).getTime();
          return (
            (!q ||
              order.id.toLowerCase().includes(q) ||
              order.customer.toLowerCase().includes(q)) &&
            (status === "all" || order.status === status) &&
            (payment === "all" || order.paymentStatus === payment) &&
            (scope === "all" ||
              (scope === "active" &&
                ["Placed", "Accepted", "Preparing", "Ready"].includes(
                  order.status,
                ) &&
                order.paymentStatus === "Succeeded") ||
              (scope === "completed" && order.status === "Handed Off") ||
              (scope === "cancelled" && order.status === "Cancelled")) &&
            (!from || placed >= new Date(`${from}T00:00:00+05:30`).getTime()) &&
            (!to || placed <= new Date(`${to}T23:59:59+05:30`).getTime())
          );
        })
        .sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt)),
    [orders, search, status, payment, scope, from, to],
  );
  return (
    <>
      <ManagerPageHeader
        eyebrow="OUTLET ORDER REGISTER"
        title="Orders"
        description="Review the orders assigned to this outlet. Kitchen actions remain available in the Kitchen Display."
      />
      <div className="om-filterbar">
        <label className="om-search">
          <Search size={16} />
          <input
            placeholder="Search order ID or customer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          <span>Order status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Payment</span>
          <select value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="all">All payments</option>
            {["Pending", "Succeeded", "Failed", "Cancelled"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>View</span>
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="all">All orders</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label>
          <span>From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="om-button ghost"
          onClick={() => {
            setSearch("");
            setStatus("all");
            setPayment("all");
            setScope("all");
            setFrom("");
            setTo("");
          }}
        >
          Clear
        </button>
        <span className="om-filter-count">
          <Filter size={14} />
          {rows.length} results
        </span>
      </div>
      <section className="om-panel">
        <header className="om-panel-head">
          <div>
            <h2>Outlet orders</h2>
            <p>Payment and order states are tracked separately.</p>
          </div>
        </header>
        <div className="om-table-wrap">
          <table className="om-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Order status</th>
                <th>Received</th>
                <th>Promised</th>
                <th>Prep estimate</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.id}</strong>
                  </td>
                  <td>
                    {order.customer}
                    <small>
                      {order.phone
                        ? `${order.phone.slice(0, 3)}••••${order.phone.slice(-2)}`
                        : ""}
                    </small>
                  </td>
                  <td className="om-truncate" title={order.itemSummary}>
                    {order.itemSummary}
                  </td>
                  <td>
                    <strong>{money(order.amount)}</strong>
                  </td>
                  <td>
                    <Badge
                      tone={
                        order.paymentStatus === "Succeeded"
                          ? "success"
                          : order.paymentStatus === "Failed"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {order.paymentStatus}
                    </Badge>
                    <small>{order.paymentMethod}</small>
                  </td>
                  <td>
                    <Badge
                      tone={
                        order.status === "Handed Off"
                          ? "success"
                          : order.status === "Cancelled"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {order.status}
                    </Badge>
                  </td>
                  <td>{timeOnly(order.placedAt)}</td>
                  <td>{timeOnly(order.promisedAt)}</td>
                  <td>{order.prepMinutes || "—"} min</td>
                  <td>
                    <button
                      className="om-icon-button"
                      type="button"
                      onClick={() => setSelected(order)}
                      aria-label={`View ${order.id}`}
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <Empty
              title="No matching orders"
              detail="Change the search or filters to see more records."
            />
          )}
        </div>
      </section>
      <ManagerOrderDetailsDrawer
        order={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
