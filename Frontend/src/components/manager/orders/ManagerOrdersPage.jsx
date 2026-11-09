import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Eye, Filter, Search } from "lucide-react";

import managerApi from "../../../services/managerApi";

import {
  Badge,
  Empty,
  ManagerPageHeader,
  money,
  timeOnly,
} from "../common/ManagerUI";

import ManagerOrderDetailsDrawer from "./ManagerOrderDetailsDrawer";

const PAGE_SIZE = 20;

const statuses = [
  "Placed",
  "Accepted",
  "Preparing",
  "Ready",
  "Handed Off",
  "Cancelled",
];

const paymentStatuses = [
  "Pending",
  "Succeeded",
  "Failed",
  "Cancelled",
  "Refunded",
];

export default function ManagerOrdersPage() {
  const { orderId: routeOrderId } = useParams();

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [status, setStatus] = useState("all");
  const [payment, setPayment] = useState("all");
  const [scope, setScope] = useState("all");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState(null);

  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState("");

  /*
   * Search debounce:
   * API requests start after the manager pauses typing.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  /*
   * Backend getOrders requires both dates when either
   * from or to is provided.
   */
  const dateRangeIncomplete =
    Boolean(from || to) && !(from && to);

  const dateRangeInvalid =
    Boolean(from && to) && from > to;

  /*
   * The backend supports these exact filter parameters.
   * Do not filter the received page again in JavaScript.
   */
  const query = useMemo(() => {
    const params = {
      page,
      limit: PAGE_SIZE,
      sortBy: "placedAt",
      sortOrder: "desc",
      scope,
    };

    if (debouncedSearch) {
      params.search = debouncedSearch;
    }

    /*
     * Scope=completed and scope=cancelled already select
     * their corresponding status in the backend.
     *
     * Avoid sending a conflicting separate status filter.
     */
    if (
      status !== "all" &&
      ["all", "active"].includes(scope)
    ) {
      params.status = status;
    }

    if (payment !== "all") {
      params.paymentStatus = payment;
    }

    if (from && to) {
      params.from = from;
      params.to = to;
    }

    return params;
  }, [
    page,
    scope,
    debouncedSearch,
    status,
    payment,
    from,
    to,
  ]);

  const requestKey = JSON.stringify(query);

  /*
   * Server-side fetch.
   *
   * Only the current requested page is received and stored.
   * The backend applies search, status, payment and date filters
   * before applying skip/take pagination.
   */
  useEffect(() => {
    if (dateRangeIncomplete || dateRangeInvalid) {
      return undefined;
    }

    let active = true;

    managerApi
      .getOrders(query)
      .then((result) => {
        if (!active) return;

        if (!Array.isArray(result.orders)) {
          throw new Error(
            "The manager orders endpoint returned an invalid orders collection.",
          );
        }

        setOrders(result.orders);
        setPagination(result.pagination || null);
        setError("");
        setLoadedKey(requestKey);
      })
      .catch((err) => {
        if (!active) return;

        setOrders([]);
        setPagination(null);
        setError(err.message || "Unable to load orders.");
        setLoadedKey(requestKey);
      });

    return () => {
      active = false;
    };
  }, [
    query,
    requestKey,
    dateRangeIncomplete,
    dateRangeInvalid,
  ]);

  const loading =
    !dateRangeIncomplete &&
    !dateRangeInvalid &&
    loadedKey !== requestKey;

  /*
   * Deep link support:
   * /manager/orders/:orderId
   *
   * The route parameter may be a display order number or
   * database identifier. Backend details resolve the identifier,
   * then the drawer uses the actual database orderId.
   */
  useEffect(() => {
    if (!routeOrderId) {
      return undefined;
    }

    const existing = orders.find(
      (order) =>
        order.orderId === routeOrderId ||
        order.id === routeOrderId,
    );

    if (existing) {
      setSelected(existing);
      return undefined;
    }

    let active = true;

    managerApi
      .getOrderDetails(routeOrderId)
      .then((order) => {
        if (active) {
          setSelected(order);
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            err.message || "Unable to load the requested order.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [routeOrderId, orders]);

  const updateFilters = (setter, value) => {
    setter(value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("all");
    setPayment("all");
    setScope("all");
    setFrom("");
    setTo("");
    setPage(1);
    setError("");
  };

  const totalItems = pagination?.totalItems ?? 0;
  const totalPages = pagination?.totalPages ?? 0;

  const hasPreviousPage =
    pagination?.hasPreviousPage ?? page > 1;

  const hasNextPage =
    pagination?.hasNextPage ?? false;

  const visibleOrders = dateRangeIncomplete || dateRangeInvalid
    ? []
    : orders;

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
            maxLength={120}
            onChange={(event) => {
              updateFilters(setSearch, event.target.value);
            }}
          />
        </label>

        <label>
          <span>Order status</span>
          <select
            value={status}
            onChange={(event) => {
              updateFilters(setStatus, event.target.value);
            }}
          >
            <option value="all">All statuses</option>

            {statuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Payment</span>
          <select
            value={payment}
            onChange={(event) => {
              updateFilters(setPayment, event.target.value);
            }}
          >
            <option value="all">All payments</option>

            {paymentStatuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>View</span>
          <select
            value={scope}
            onChange={(event) => {
              updateFilters(setScope, event.target.value);
            }}
          >
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
            onChange={(event) => {
              updateFilters(setFrom, event.target.value);
            }}
          />
        </label>

        <label>
          <span>To</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => {
              updateFilters(setTo, event.target.value);
            }}
          />
        </label>

        <button
          type="button"
          className="om-button ghost"
          onClick={clearFilters}
        >
          Clear
        </button>

        <span className="om-filter-count">
          <Filter size={14} />
          {loading
            ? "Loading…"
            : `${totalItems} results`}
        </span>
      </div>

      {dateRangeIncomplete && (
        <p className="om-form-note">
          Select both a From date and a To date to filter by date.
        </p>
      )}

      {dateRangeInvalid && (
        <p className="om-form-error">
          The From date cannot be after the To date.
        </p>
      )}

      {error && (
        <p className="om-form-error">{error}</p>
      )}

      <section className="om-panel">
        <header className="om-panel-head">
          <div>
            <h2>Outlet orders</h2>
            <p>
              Results are filtered and paginated by the backend.
            </p>
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
              {visibleOrders.map((order) => (
                <tr key={order.orderId}>
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

                  <td
                    className="om-truncate"
                    title={order.itemSummary}
                  >
                    {order.itemSummary}
                  </td>

                  <td>
                    <strong>{money(order.amount)}</strong>
                  </td>

                  <td>
                    <Badge
                      tone={
                        order.rawPaymentStatus === "SUCCEEDED"
                          ? "success"
                          : order.rawPaymentStatus === "FAILED"
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
                        order.rawStatus === "HANDED_OFF"
                          ? "success"
                          : order.rawStatus === "CANCELLED"
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

              {!loading && visibleOrders.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <Empty
                      title={
                        error
                          ? "Unable to load orders"
                          : "No matching orders"
                      }
                      detail={
                        error
                          ? "Check the backend response and try again."
                          : "Change the search or filters to see other records."
                      }
                    />
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={10}>
                    <div className="om-loading">
                      Loading orders…
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="om-pagination">
          <span>
            {totalItems
              ? `Page ${page} of ${totalPages} · ${totalItems} matching orders`
              : "No matching orders"}
          </span>

          <div>
            <button
              type="button"
              className="om-button ghost"
              disabled={
                loading ||
                !hasPreviousPage
              }
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>

            <button
              type="button"
              className="om-button ghost"
              disabled={
                loading ||
                !hasNextPage
              }
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <ManagerOrderDetailsDrawer
        order={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}