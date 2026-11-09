import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Repeat2 } from "lucide-react";

import { useCustomer } from "../../../context/CustomerContext";
import customerApi from "../../../services/customerApi";

import { currency } from "../../../utils/customerPricing";
import { OrderStatusBadge } from "../common/Badges";
import EmptyState from "../common/EmptyState";

const FILTERS = ["All", "Active", "Completed", "Cancelled"];

export default function MyOrdersPage() {
  const {
    orders,
    addresses,
    refreshOrders,
    selectedPincode,
    selectedOutletId,
    requestLocation,
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
    refreshOrders().catch((error) => {
      notify(error.message || "Unable to load orders.", "error");
    });
  }, [refreshOrders, notify]);

  const filtered = useMemo(
    () =>
      orders.filter((order) => {
        if (filter === "All") return true;

        if (filter === "Active") {
          return ["Placed", "Accepted", "Preparing", "Ready"].includes(
            order.status,
          );
        }

        if (filter === "Completed") {
          return order.status === "Handed Off";
        }

        return order.status === "Cancelled";
      }),
    [orders, filter],
  );

  const reorder = async (order) => {
    if (busyId) return;

    setBusyId(order.id);

    try {
      const orderPincode = order.address?.pincode;

      if (!orderPincode) {
        throw new Error(
          "The original order has no delivery pincode. Select a delivery location before reordering.",
        );
      }

      /*
       * 1. Check serviceability for the original order's pincode.
       * This is a public backend endpoint.
       */
      const serviceability = await customerApi.getServiceability(orderPincode);

      const eligibleOutlets = serviceability.outlets || [];

      if (!serviceability.serviceable || !eligibleOutlets.length) {
        throw new Error(
          serviceability.reason ||
            "The original delivery pincode is not currently serviceable.",
        );
      }

      /*
       * 2. The original outlet must still serve the original pincode.
       */
      const originalOutlet = eligibleOutlets.find(
        (outlet) => outlet.id === order.outletId,
      );

      if (!originalOutlet) {
        throw new Error(
          "The original outlet no longer serves this pincode. Choose another delivery location before reordering.",
        );
      }

      /*
       * 3. If the cart belongs to another outlet, ask before clearing it.
       */
      if (
        selectedOutletId &&
        selectedOutletId !== order.outletId &&
        cart.length
      ) {
        const confirmed = window.confirm(
          "This order belongs to another outlet. Clear your current cart and switch to the original outlet?",
        );

        if (!confirmed) return;

        await clearCart();
      }

      /*
       * 4. Set the original order's delivery pincode.
       */
      if (selectedPincode !== orderPincode) {
        const locationResult = await requestLocation(orderPincode);

        if (!locationResult.serviceable) {
          throw new Error(
            locationResult.reason ||
              "The original order's pincode is no longer serviceable.",
          );
        }
      }

      /*
       * 5. Select the original outlet.
       *
       * chooseOutlet can return false when a cart-switch
       * confirmation is still pending. Do not continue in that case.
       */
      if (selectedOutletId !== order.outletId) {
        const selected = await chooseOutlet(order.outletId);

        if (!selected) {
          throw new Error(
            "Confirm the outlet switch before continuing with reorder.",
          );
        }
      }

      /*
       * 6. Ask the backend to rebuild the historical order.
       * The backend recalculates current availability and pricing.
       */
      const matchingAddress = addresses.find(
        (address) => address.pincode === orderPincode,
      );

      if (!matchingAddress) {
        throw new Error(
          "You do not have a saved delivery address for this order's pincode. Add or select an address in that service area before reordering.",
        );
      }
      const rebuilt = await customerApi.reorder(order.id, {
        outletId: order.outletId,
        addressId: matchingAddress.id,
      });

      const rebuiltLines = rebuilt.lines || [];
      const unavailable = rebuilt.unavailable || [];

      if (!rebuiltLines.length) {
        throw new Error(
          unavailable.length
            ? `None of the previous dishes are currently available: ${unavailable.join(", ")}`
            : "No items from this order are currently available.",
        );
      }

      /*
       * 7. Add only backend-approved lines.
       * addToCart performs another current-menu lookup and cart validation.
       */
      const rejected = [];

      for (const line of rebuiltLines) {
        const added = await addToCart({
          itemId: line.itemId,
          outletId: line.outletId,
          name: line.name,
          image: line.image,
          category: line.category,
          quantity: line.quantity,
          portion: line.portion,
          portionId: line.portionId,
          addons: (line.addons || []).map((addon) => ({
            id: addon.id,
            name: addon.name,
            price: Number(addon.price || 0),
          })),
          specialNote: line.specialNote || "",
        });

        if (!added) {
          rejected.push(line.name);
        }
      }

      const warnings = [
        ...unavailable,
        ...rejected.map(
          (name) => `${name} (could not be added to the current cart)`,
        ),
      ];

      if (warnings.length) {
        notify(
          `Available dishes were added using current prices. Not added: ${warnings.join("; ")}`,
          "error",
        );
      } else {
        notify(
          "Your previous order has been rebuilt using current prices and availability.",
        );
      }

      navigate("/customer");
    } catch (error) {
      notify(error.message || "Could not reorder this order.", "error");
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
                    {order.paymentMethod || "Payment"} · {order.paymentStatus}
                  </small>
                </div>

                <b>{currency(order.amount)}</b>
              </div>

              <div className="cu-order-list-actions">
                <button
                  className="cu-button-secondary"
                  onClick={() =>
                    navigate(`/customer/order/${encodeURIComponent(order.id)}`)
                  }
                >
                  View details <ArrowRight size={14} />
                </button>

                {order.status !== "Cancelled" && (
                  <button
                    className="cu-text-action"
                    disabled={Boolean(busyId)}
                    onClick={() => reorder(order)}
                  >
                    <Repeat2 size={14} />{" "}
                    {busyId === order.id ? "Rebuilding…" : "Reorder"}
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
