import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  Power,
  ShieldCheck,
  UserRound,
  CalendarDays,
} from "lucide-react";
import { adminApi } from "../../../services/adminApi.js";
import { PageHeader, StatusBadge } from "../common/AdminUI";
import OutletFormModal from "./OutletFormModal";
import ManagerAssignmentModal from "./ManagerAssignmentModal";
import OutletOverviewTab from "./OutletOverviewTab";
import OutletMenuTab from "./OutletMenuTab";
import OutletOrdersTab from "./OutletOrdersTab";
import OutletSettingsTab from "./OutletSettingsTab";

const TABS = ["Overview", "Menu", "Orders", "Manager", "Settings"];

export default function OutletDetailsPage() {
  const { outletId } = useParams();
  const navigate = useNavigate();
  const [outlet, setOutlet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("Overview");
  const [managerOpen, setManagerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    const next = await adminApi.getOutletById(outletId);
    setOutlet(next);
    return next;
  }, [outletId]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    adminApi
      .getOutletById(outletId)
      .then((next) => {
        if (mounted) setOutlet(next);
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
  }, [outletId]);

  const toggleStatus = async () => {
    const nextActive = !outlet.active;
    if (
      !window.confirm(
        `${nextActive ? "Activate" : "Deactivate"} ${outlet.name}?`,
      )
    )
      return;
    await adminApi.updateOutletStatus(outlet.id, nextActive);
    await refresh();
  };

  const saveEdit = async (payload) => {
    await adminApi.updateOutlet(outlet.id, payload);
    await refresh();
    setNotice("Outlet information updated.");
  };

  if (loading) return <div className="ad-loading">Loading outlet details…</div>;
  if (error || !outlet)
    return (
      <section className="ad-panel">
        <p className="ad-inline-error">{error || "Outlet not found."}</p>
        <Link to="/admin/outlets" className="ad-inline-link">
          ← Back to outlets
        </Link>
      </section>
    );

  return (
    <>
      <div className="ad-back-line">
        <button type="button" onClick={() => navigate("/admin/outlets")}>
          <ArrowLeft size={15} /> Back to outlets
        </button>
      </div>
      <PageHeader
        eyebrow={`${outlet.code} · ${outlet.city}`}
        title={outlet.name}
        description={`${outlet.type} · ${outlet.address}`}
        actions={
          <>
            <StatusBadge tone={outlet.active ? "success" : "warning"}>
              {outlet.active ? "Active" : "Inactive"}
            </StatusBadge>
            <button
              type="button"
              className="ad-button ad-button-quiet"
              onClick={() => setEditOpen(true)}
            >
              <Pencil size={14} /> Edit outlet
            </button>
            <button
              type="button"
              className="ad-button ad-button-quiet"
              onClick={toggleStatus}
            >
              <Power size={14} /> {outlet.active ? "Deactivate" : "Activate"}
            </button>
          </>
        }
      />

      <section className="ad-outlet-manager-strip">
        <span className="ad-manager-avatar">
          <UserRound size={18} />
        </span>
        <span className="ad-manager-strip-text">
          <small>DESIGNATED OUTLET MANAGER</small>
          <strong>{outlet.manager?.name || "No manager assigned"}</strong>
          <em>
            {outlet.manager
              ? `+91 ${outlet.manager.phone}`
              : "A verified manager is required"}
          </em>
        </span>
        {outlet.manager?.verified ? (
          <StatusBadge tone="success">
            <ShieldCheck size={12} /> Phone verified
          </StatusBadge>
        ) : (
          <StatusBadge tone="warning">Unassigned</StatusBadge>
        )}
        <button
          type="button"
          className="ad-button ad-button-primary ad-button-xs"
          onClick={() => setManagerOpen(true)}
        >
          {outlet.manager ? "Replace manager" : "Assign manager"}
        </button>
      </section>

      <nav className="ad-tabs" aria-label="Outlet details sections">
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab}
            className={activeTab === tab ? "active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>
      {notice && (
        <div className="ad-inline-success ad-section-gap">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")}>
            Dismiss
          </button>
        </div>
      )}

      {activeTab === "Overview" && <OutletOverviewTab outlet={outlet} />}
      {activeTab === "Menu" && (
        <OutletMenuTab outlet={outlet} onNotice={setNotice} />
      )}
      {activeTab === "Orders" && <OutletOrdersTab outlet={outlet} />}
      {activeTab === "Manager" && (
        <section className="ad-panel ad-section-gap">
          <div className="ad-panel-header">
            <div>
              <h2>Outlet Manager</h2>
              <p>
                One designated manager is assigned to each outlet. A phone
                verification is required.
              </p>
            </div>
            <button
              type="button"
              className="ad-button ad-button-primary"
              onClick={() => setManagerOpen(true)}
            >
              {outlet.manager ? "Replace manager" : "Assign manager"}
            </button>
          </div>
          {outlet.manager ? (
            <div className="ad-manager-detail">
              <span className="ad-manager-large-avatar">
                <UserRound size={23} />
              </span>
              <div>
                <h3>{outlet.manager.name}</h3>
                <p>+91 {outlet.manager.phone}</p>
                <StatusBadge tone="success">
                  <ShieldCheck size={12} /> Phone verified
                </StatusBadge>
                <small>
                  <CalendarDays size={12} /> Assigned{" "}
                  {new Date(outlet.manager.assignedAt).toLocaleDateString(
                    "en-IN",
                  )}
                </small>
                <small>
                  Account status:{" "}
                  {outlet.manager.active ? "Active" : "Inactive"}
                </small>
                <small>Assigned outlet: {outlet.name}</small>
              </div>
            </div>
          ) : (
            <div className="ad-empty-inline">
              No manager assigned. Assign a verified staff member to this
              outlet.
            </div>
          )}
        </section>
      )}
      {activeTab === "Settings" && (
        <OutletSettingsTab outlet={outlet} onSaved={refresh} />
      )}

      {managerOpen && (
        <ManagerAssignmentModal
          outlet={outlet}
          onClose={() => setManagerOpen(false)}
          onAssigned={async () => {
            await refresh();
            setNotice("Verified Outlet Manager assigned successfully.");
            setActiveTab("Manager");
          }}
        />
      )}
      <OutletFormModal
        open={editOpen}
        outlet={outlet}
        onClose={() => setEditOpen(false)}
        onSave={saveEdit}
      />
    </>
  );
}
