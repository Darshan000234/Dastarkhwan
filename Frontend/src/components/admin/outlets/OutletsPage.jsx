import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Store,
  Cloud,
  MapPin,
  Clock3,
  Utensils,
  Pencil,
  Power,
  LayoutGrid,
  List,
  UserRound,
} from "lucide-react";
import { mockApi } from "../../../services/mockApi";
import { PageHeader, StatusBadge, money } from "../common/AdminUI";
import OutletFormModal from "./OutletFormModal";

export default function OutletsPage() {
  const [outlets, setOutlets] = useState([]);
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState("grid");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    const [nextOutlets, nextOrders] = await Promise.all([
      mockApi.getOutlets(),
      mockApi.getOrders(),
    ]);
    setOutlets(nextOutlets);
    setOrders(nextOrders);
  };
  useEffect(() => {
    let mounted = true;
    Promise.all([mockApi.getOutlets(), mockApi.getOrders()])
      .then(([o, r]) => {
        if (mounted) {
          setOutlets(o);
          setOrders(r);
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
  }, []);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (outlet) => {
    setEditing(outlet);
    setModalOpen(true);
  };
  const save = async (payload) => {
    if (editing) await mockApi.updateOutlet(editing.id, payload);
    else await mockApi.createOutlet(payload);
    await refresh();
  };
  const toggleStatus = async (outlet) => {
    if (
      !window.confirm(
        `${outlet.active ? "Deactivate" : "Activate"} ${outlet.name}?`,
      )
    )
      return;
    await mockApi.updateOutletStatus(outlet.id, !outlet.active);
    await refresh();
  };

  return (
    <>
      <PageHeader
        eyebrow="CHAIN LOCATIONS"
        title="Outlets"
        description="Create and maintain restaurants and cloud kitchens, service areas, operating hours and designated managers."
        actions={
          <button
            type="button"
            className="ad-button ad-button-primary"
            onClick={openCreate}
          >
            <Plus size={16} /> Create outlet
          </button>
        }
      />
      <div className="ad-toolbar">
        <div className="ad-toolbar-note">
          <strong>{outlets.length}</strong> outlets configured <span>·</span>{" "}
          {outlets.filter((outlet) => outlet.active).length} active
        </div>
        <div className="ad-view-switch">
          <button
            type="button"
            className={view === "grid" ? "selected" : ""}
            onClick={() => setView("grid")}
          >
            <LayoutGrid size={15} /> Cards
          </button>
          <button
            type="button"
            className={view === "table" ? "selected" : ""}
            onClick={() => setView("table")}
          >
            <List size={15} /> Table
          </button>
        </div>
      </div>
      {error && <div className="ad-inline-error">{error}</div>}
      {loading ? (
        <div className="ad-loading">Loading outlets…</div>
      ) : view === "grid" ? (
        <div className="ad-outlet-grid">
          {outlets.map((outlet) => {
            const rows = orders.filter((order) => order.outletId === outlet.id);
            const revenue = rows
              .filter((order) => order.paymentStatus === "Succeeded")
              .reduce((sum, order) => sum + order.amount, 0);
            const prepRows = rows.filter((order) => order.prepMinutes > 0);
            const avgPrep = prepRows.length
              ? Math.round(
                  prepRows.reduce((sum, order) => sum + order.prepMinutes, 0) /
                    prepRows.length,
                )
              : outlet.prepTime;
            const unavailable = outlet.menu.filter(
              (mapping) => !mapping.available,
            ).length;
            return (
              <article className="ad-outlet-card" key={outlet.id}>
                <div className="ad-outlet-card-top">
                  <span className="ad-outlet-type-icon">
                    {outlet.type === "Restaurant" ? (
                      <Store size={19} />
                    ) : (
                      <Cloud size={19} />
                    )}
                  </span>
                  <StatusBadge tone={outlet.active ? "success" : "warning"}>
                    {outlet.active ? "Active" : "Inactive"}
                  </StatusBadge>
                </div>
                <div className="ad-outlet-card-heading">
                  <h2>{outlet.name}</h2>
                  <span>
                    {outlet.code} · {outlet.type}
                  </span>
                </div>
                <div className="ad-outlet-meta">
                  <span>
                    <MapPin size={14} /> {outlet.city} · PIN{" "}
                    {outlet.primaryPincode}
                  </span>
                  <span>
                    <MapPin size={14} /> Service: {outlet.pincodes.join(", ")}
                  </span>
                  <span>
                    <Clock3 size={14} /> {outlet.openTime}–{outlet.closeTime}
                  </span>
                  <span>
                    <UserRound size={14} />{" "}
                    {outlet.manager?.name || "No manager assigned"}
                  </span>
                </div>
                <div className="ad-manager-summary">
                  <small>DESIGNATED MANAGER</small>
                  {outlet.manager ? (
                    <>
                      <strong>
                        {outlet.manager.name}{" "}
                        <StatusBadge tone="success">Phone verified</StatusBadge>
                      </strong>
                      <span>+91 {outlet.manager.phone}</span>
                    </>
                  ) : (
                    <strong className="ad-text-danger">Unassigned</strong>
                  )}
                </div>
                <div className="ad-outlet-stats">
                  <div>
                    <strong>{rows.length}</strong>
                    <small>Sample orders</small>
                  </div>
                  <div>
                    <strong>{money(revenue)}</strong>
                    <small>Paid revenue</small>
                  </div>
                  <div>
                    <strong>{avgPrep} min</strong>
                    <small>Avg. prep*</small>
                  </div>
                </div>
                <div className="ad-outlet-foot">
                  <span>
                    <Utensils size={13} /> {outlet.menu.length} mapped ·{" "}
                    {unavailable} unavailable
                  </span>
                  <div>
                    <button
                      type="button"
                      className="ad-button ad-button-quiet ad-button-xs"
                      onClick={() => openEdit(outlet)}
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    <button
                      type="button"
                      className="ad-button ad-button-quiet ad-button-xs"
                      onClick={() => toggleStatus(outlet)}
                    >
                      <Power size={12} />{" "}
                      {outlet.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
                <Link
                  className="ad-card-open"
                  to={`/admin/outlets/${outlet.id}`}
                >
                  View outlet details <span>→</span>
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="ad-panel ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Outlet</th>
                <th>Type</th>
                <th>Address / PIN</th>
                <th>Manager</th>
                <th>Mapped</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {outlets.map((outlet) => (
                <tr key={outlet.id}>
                  <td>
                    <strong>{outlet.name}</strong>
                    <small>{outlet.code}</small>
                  </td>
                  <td>{outlet.type}</td>
                  <td>
                    {outlet.address}
                    <small>{outlet.primaryPincode}</small>
                  </td>
                  <td>
                    {outlet.manager
                      ? `${outlet.manager.name} · +91 ${outlet.manager.phone}`
                      : "Unassigned"}
                  </td>
                  <td>{outlet.menu.length}</td>
                  <td>
                    <StatusBadge tone={outlet.active ? "success" : "warning"}>
                      {outlet.active ? "Active" : "Inactive"}
                    </StatusBadge>
                  </td>
                  <td>
                    <div className="ad-row-actions">
                      <button
                        type="button"
                        className="ad-button ad-button-quiet ad-button-xs"
                        onClick={() => openEdit(outlet)}
                      >
                        Edit
                      </button>
                      <Link
                        className="ad-inline-link"
                        to={`/admin/outlets/${outlet.id}`}
                      >
                        Details →
                      </Link>
                      <button
                        type="button"
                        className="ad-button ad-button-quiet ad-button-xs"
                        onClick={() => toggleStatus(outlet)}
                      >
                        {outlet.active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <p className="ad-footnote">
        Demo records only. The sample order totals are not live daily sales.
        Demo FSSAI placeholders must be replaced with verified compliance
        records.
      </p>
      <OutletFormModal
        open={modalOpen}
        outlet={editing}
        onClose={() => setModalOpen(false)}
        onSave={save}
      />
    </>
  );
}
