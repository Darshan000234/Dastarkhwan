import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Repeat2, ShoppingBag } from "lucide-react";
import { useCustomer } from "../../../context/CustomerContext";
import { mockCustomerApi } from "../../../services/mockCustomerApi";
import { currency } from "../../../utils/customerPricing";
import { OrderStatusBadge } from "../common/Badges";
import EmptyState from "../common/EmptyState";

const FILTERS = ["All", "Active", "Completed", "Cancelled"];
export default function MyOrdersPage() {
  const {
    orders,
    refreshOrders,
    selectedPincode,
    selectedOutletId,
    chooseOutlet,
    addToCart,
    notify,
    cart,
    clearCart,
  } = useCustomer();
  const [filter, setFilter] = useState("All");
  const [busyId, setBusyId] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    refreshOrders();
  }, [refreshOrders]);
  const filtered = useMemo(
    () =>
      orders.filter(
        (order) =>
          filter === "All" ||
          (filter === "Active"
            ? ["Placed", "Accepted", "Preparing", "Ready"].includes(
                order.status,
              )
            : filter === "Completed"
              ? order.status === "Handed Off"
              : order.status === "Cancelled"),
      ),
    [orders, filter],
  );
  const reorder = async (order) => {
    setBusyId(order.id);
    try {
      const eligible =
        await mockCustomerApi.getEligibleOutlets(selectedPincode);
      if (!eligible.some((outlet) => outlet.id === order.outletId))
        throw new Error(
          "Your current delivery pincode is not served by the original outlet. Change your delivery location first.",
        );
      if (selectedOutletId !== order.outletId && cart.length) {
        const confirmed = window.confirm(
          "This order belongs to another outlet. Clear your current cart and switch to the original outlet?",
        );
        if (!confirmed) return;
        await clearCart();
      }
      if (selectedOutletId !== order.outletId)
        await chooseOutlet(order.outletId);
      const result = await mockCustomerApi.reorder(order.id, order.outletId);
      const rejected = [];
      for (const line of result.lines) {
        const added = await addToCart(line);
        if (!added) rejected.push(line.name);
      }
      const warnings = [
        ...result.unavailable,
        ...rejected.map(
          (name) =>
            `${name} (quantity exceeds remaining stock or is no longer valid)`,
        ),
      ];
      if (warnings.length)
        notify(
          `Added available dishes at current prices. Not available or changed: ${warnings.join(", ")}.`,
          "error",
        );
      else
        notify(
          "Your previous order has been rebuilt using current prices and available extras.",
        );
      navigate("/customer");
    } catch (error) {
      notify(error.message || "Could not reorder.", "error");
    } finally {
      setBusyId("");
    }
  };
  return (
    <div className="cu-page cu-orders-page">
      <div className="cu-page-heading">
        <div>
          <span className="cu-eyebrow">YOUR DASTARKHWAN JOURNEY</span>
          <h1>My orders</h1>
          <p>Find a previous meal, follow an active order or order it again.</p>
        </div>
        <Link to="/customer" className="cu-button">
          Explore menu <ArrowRight size={15} />
        </Link>
      </div>
      <div className="cu-tabs">
        {FILTERS.map((entry) => (
          <button
            key={entry}
            className={filter === entry ? "is-active" : ""}
            onClick={() => setFilter(entry)}
          >
            {entry}
          </button>
        ))}
      </div>
      {filtered.length ? (
        <div className="cu-order-list">
          {filtered.map((order) => (
            <article className="cu-order-list-card" key={order.id}>
              <div className="cu-order-list-head">
                <div>
                  <span className="cu-eyebrow">{order.id}</span>
                  <small>
                    {new Date(order.placedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {order.outletSnapshot?.name || order.outletId}
                  </small>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>
              <div className="cu-order-list-body">
                <div>
                  <strong>
                    {order.itemSummary ||
                      order.items
                        ?.map((item) => `${item.name} ×${item.qty}`)
                        .join(", ")}
                  </strong>
                  <small>
                    {order.paymentMethod} · {order.paymentStatus}
                  </small>
                </div>
                <b>{currency(order.amount)}</b>
              </div>
              <div className="cu-order-list-actions">
                <button
                  className="cu-button-secondary"
                  onClick={() => navigate(`/customer/order/${order.id}`)}
                >
                  View details <ArrowRight size={14} />
                </button>
                {order.status !== "Cancelled" && (
                  <button
                    className="cu-text-action"
                    disabled={busyId === order.id}
                    onClick={() => reorder(order)}
                  >
                    <Repeat2 size={14} />{" "}
                    {busyId === order.id ? "Checking…" : "Reorder"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No orders in this view"
          description="Your orders will appear here once you place them."
          icon="cart"
          action="Browse the menu"
          onAction={() => navigate("/customer")}
        />
      )}
    </div>
  );
}
