import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  IndianRupee,
  RotateCcw,
  Save,
  ShieldCheck,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../../context/authContext.jsx";
import { adminApi } from "../../../services/adminApi.js";
import { Field, PageHeader } from "../common/AdminUI";

const INITIAL_SETTINGS = {
  brandName: "",
  defaultCity: "",
  gstInclusive: true,
  gstRate: 5,
  defaultPrepTime: 25,
};

function formatTimestamp(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [updatedBy, setUpdatedBy] = useState(null);

  const [auditRows, setAuditRows] = useState([]);
  const [auditPagination, setAuditPagination] = useState(null);
  const [auditPage, setAuditPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");
  const [auditError, setAuditError] = useState("");
  const [notice, setNotice] = useState("");

  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");

  const loadSettings = useCallback(async () => {
    const result = await adminApi.getSettings();

    setSettings({
      ...INITIAL_SETTINGS,
      ...(result || {}),
    });
  }, []);

  const loadAudit = useCallback(async (page = 1) => {
    setAuditLoading(true);
    setAuditError("");

    try {
      const result = await adminApi.getAuditEvents({
        page,
        limit: 15,
      });

      setAuditRows(result.logs || []);
      setAuditPagination(result.pagination || null);
      setAuditPage(page);
    } catch (err) {
      setAuditError(err.message || "Unable to load audit history.");
      setAuditRows([]);
      setAuditPagination(null);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([
      adminApi.getSettings(),
      adminApi.getAuditEvents({ page: 1, limit: 15 }),
    ])
      .then(([settingsResult, auditResult]) => {
        if (!active) return;

        setSettings({
          ...INITIAL_SETTINGS,
          ...(settingsResult || {}),
        });

        setUpdatedAt(settingsResult?.updatedAt || null);
        setUpdatedBy(settingsResult?.updatedBy || null);

        setAuditRows(auditResult.logs || []);
        setAuditPagination(auditResult.pagination || null);
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Unable to load platform settings.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setAuditLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const update = (key, value) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));

    setNotice("");
    setError("");
  };

  const save = async (event) => {
    event.preventDefault();

    setError("");
    setNotice("");

    if (!settings.brandName?.trim()) {
      setError("Enter the restaurant brand name.");
      return;
    }

    if (!settings.defaultCity?.trim()) {
      setError("Enter the default city.");
      return;
    }

    if (
      !Number.isSafeInteger(Number(settings.defaultPrepTime)) ||
      Number(settings.defaultPrepTime) < 1 ||
      Number(settings.defaultPrepTime) > 240
    ) {
      setError("Default preparation time must be between 1 and 240 minutes.");
      return;
    }

    if (settings.gstInclusive !== true) {
      setError(
        "The current checkout implementation requires GST-inclusive pricing.",
      );
      return;
    }

    if (Number(settings.gstRate) !== 5) {
      setError(
        "The current checkout implementation supports a 5% GST rate only.",
      );
      return;
    }

    setBusy(true);

    try {
      const result = await adminApi.updateSettings({
        brandName: settings.brandName.trim(),
        defaultCity: settings.defaultCity.trim(),
        gstInclusive: true,
        gstRate: 5,
        defaultPrepTime: Number(settings.defaultPrepTime),
      });

      const saved = result.settings || result;

      setSettings({
        ...INITIAL_SETTINGS,
        ...saved,
      });

      setUpdatedAt(result.updatedAt || null);
      setUpdatedBy(result.updatedBy || null);

      setNotice(
        result.unchanged
          ? "Settings are already up to date."
          : "Platform settings saved successfully.",
      );

      await loadAudit(1);
    } catch (err) {
      setError(err.message || "Unable to save platform settings.");
    } finally {
      setBusy(false);
    }
  };

  const resetDemo = async () => {
    const confirmed = window.confirm(
      [
        "You are requesting a demo-data reset.",
        "",
        "This is a destructive operation. Continue only if you explicitly intend to reset demo data.",
        "",
        "The backend currently blocks the reset until demo records are isolated from real records.",
      ].join("\n"),
    );

    if (!confirmed) return;

    setResetBusy(true);
    setResetError("");
    setNotice("");

    try {
      const result = await adminApi.resetDemo();

      /*
       * Do not assume the operation succeeded because the button
       * was clicked. The backend must return success and data.
       */
      setNotice(
        result?.message ||
          "The backend accepted the demo reset request.",
      );

      await Promise.all([
        loadSettings(),
        loadAudit(1),
      ]);
    } catch (err) {
      setResetError(
        err.message ||
          "The backend did not permit the demo reset.",
      );
    } finally {
      setResetBusy(false);
    }
  };

  const signOut = async () => {
    try {
      await logout();
    } finally {
      navigate("/auth?mode=login", {
        replace: true,
      });
    }
  };

  if (loading) {
    return (
      <div className="ad-loading">
        Loading platform settings…
      </div>
    );
  }

  if (error && !settings.brandName) {
    return (
      <div className="ad-inline-error">
        {error}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="PLATFORM CONFIGURATION"
        title="Settings"
        description="Manage the supported chain-wide business defaults and inspect the platform audit history."
      />

      <form
        onSubmit={save}
        className="ad-settings-layout"
      >
        <section className="ad-panel">
          <div className="ad-settings-section-title">
            <span>
              <Building2 size={18} />
            </span>

            <div>
              <h2>General settings</h2>
              <p>Platform brand and default operating city</p>
            </div>
          </div>

          <div className="ad-form-grid">
            <Field label="Restaurant brand name">
              <input
                className="ad-input"
                value={settings.brandName}
                maxLength={80}
                onChange={(event) =>
                  update("brandName", event.target.value)
                }
                required
              />
            </Field>

            <Field label="Default city">
              <input
                className="ad-input"
                value={settings.defaultCity}
                maxLength={100}
                onChange={(event) =>
                  update("defaultCity", event.target.value)
                }
                required
              />
            </Field>
          </div>
        </section>

        <section className="ad-panel">
          <div className="ad-settings-section-title">
            <span>
              <IndianRupee size={18} />
            </span>

            <div>
              <h2>Tax and pricing</h2>
              <p>Checkout currently enforces GST-inclusive prices</p>
            </div>
          </div>

          <div className="ad-setting-line">
            <div>
              <strong>Prices include GST</strong>
              <small>
                The current checkout implementation requires GST-inclusive
                pricing. This setting cannot be disabled.
              </small>
            </div>

            <label className="ad-switch">
              <input
                type="checkbox"
                checked={settings.gstInclusive === true}
                disabled
                readOnly
              />
              <i />
            </label>
          </div>

          <Field label="GST rate (%)">
            <input
              className="ad-input ad-setting-number"
              type="number"
              value={5}
              disabled
              readOnly
            />
          </Field>

          <p className="ad-help">
            The backend rejects GST rates other than 5% because checkout
            currently uses a fixed 5% rate. Do not change this field here.
          </p>
        </section>

        <section className="ad-panel">
          <div className="ad-settings-section-title">
            <span>
              <ClipboardList size={18} />
            </span>

            <div>
              <h2>Default preparation time</h2>
              <p>Default operational preparation value</p>
            </div>
          </div>

          <Field label="Default preparation time (minutes)">
            <input
              className="ad-input ad-setting-number"
              type="number"
              min="1"
              max="240"
              step="1"
              value={settings.defaultPrepTime}
              onChange={(event) =>
                update("defaultPrepTime", Number(event.target.value))
              }
            />
          </Field>
        </section>

        <section className="ad-panel">
          <div className="ad-settings-section-title">
            <span>
              <ShieldCheck size={18} />
            </span>

            <div>
              <h2>Account and security</h2>
              <p>Authenticated Central Admin session</p>
            </div>
          </div>

          <div className="ad-account-note">
            Manager assignment, outlet access and administrator roles are
            controlled by authenticated backend operations. They cannot be
            edited in platform settings.
          </div>

          <div className="ad-setting-actions">
            <button
              type="button"
              className="ad-button ad-button-quiet"
              onClick={signOut}
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </section>

        {error && (
          <div className="ad-inline-error">
            {error}
          </div>
        )}

        {notice && (
          <div className="ad-inline-success">
            <Save size={15} /> {notice}
          </div>
        )}

        <div className="ad-form-actions">
          <button
            type="button"
            className="ad-button ad-button-danger-ghost"
            onClick={resetDemo}
            disabled={resetBusy}
          >
            <RotateCcw size={14} />
            {resetBusy ? "Requesting reset…" : "Reset demo data"}
          </button>

          <button
            type="submit"
            className="ad-button ad-button-primary"
            disabled={busy}
          >
            <Save size={14} />
            {busy ? "Saving…" : "Save settings"}
          </button>
        </div>

        {resetError && (
          <div className="ad-inline-error">
            {resetError}
          </div>
        )}
      </form>

      <section className="ad-panel ad-section-gap">
        <div className="ad-panel-header">
          <div>
            <h2>Audit history</h2>
            <p>
              Administrative changes recorded by the backend.
            </p>
          </div>

          <span className="ad-panel-meta">
            {auditPagination?.total ?? 0} records
          </span>
        </div>

        {auditError && (
          <div className="ad-inline-error">
            {auditError}
          </div>
        )}

        {auditLoading ? (
          <div className="ad-loading">
            Loading audit history…
          </div>
        ) : (
          <>
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Entity ID</th>
                    <th>Actor</th>
                    <th>Role</th>
                  </tr>
                </thead>

                <tbody>
                  {auditRows.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        {formatTimestamp(entry.createdAt)}
                      </td>

                      <td>
                        <strong>{entry.action}</strong>
                      </td>

                      <td>{entry.entityType}</td>

                      <td>{entry.entityId || "—"}</td>

                      <td>{entry.actorName || entry.actor?.name || "Deleted user"}</td>

                      <td>{entry.actor?.role || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!auditRows.length && (
                <div className="ad-empty-inline">
                  No audit records were returned for this page.
                </div>
              )}
            </div>

            <div className="ad-pagination">
              <span>
                Page {auditPagination?.page || auditPage} of{" "}
                {auditPagination?.totalPages || 1}
              </span>

              <div>
                <button
                  type="button"
                  className="ad-button ad-button-quiet ad-button-xs"
                  disabled={
                    auditLoading ||
                    !auditPagination?.hasPreviousPage
                  }
                  onClick={() => loadAudit(auditPage - 1)}
                >
                  <ChevronLeft size={14} /> Previous
                </button>

                <button
                  type="button"
                  className="ad-button ad-button-quiet ad-button-xs"
                  disabled={
                    auditLoading ||
                    !auditPagination?.hasNextPage
                  }
                  onClick={() => loadAudit(auditPage + 1)}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}

        <p className="ad-footnote">
          Last settings update: {formatTimestamp(updatedAt)}.
          {updatedBy ? ` Updated by user ${updatedBy}.` : ""}
        </p>
      </section>
    </>
  );
}