import { useEffect, useState } from "react";
import {
  Bell,
  Building2,
  IndianRupee,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { mockApi } from "../../../services/mockApi";
import { Field, PageHeader } from "../common/AdminUI";

export default function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let mounted = true;
    mockApi.getSettings().then((value) => {
      if (mounted) setSettings(value);
    });
    return () => {
      mounted = false;
    };
  }, []);
  if (!settings)
    return <div className="ad-loading">Loading platform settings…</div>;

  const update = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };
  const save = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await mockApi.updateSettings(settings);
      setSettings(result);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const resetDemo = async () => {
    if (
      !window.confirm(
        "Reset all Central Admin demo data? This restores the original sample outlets, orders, catalog, mappings and settings.",
      )
    )
      return;
    await mockApi.resetDemoData();
    window.location.reload();
  };
  const signOut = () => {
    try {
      sessionStorage.removeItem("demo_auth_session");
    } catch {
      /* ignore */
    }
    navigate("/auth?mode=login", { replace: true });
  };

  return (
    <>
      <PageHeader
        eyebrow="PLATFORM CONFIGURATION"
        title="Settings"
        description="Configure chain-wide business defaults, inclusive tax display, notification preferences and the demo admin profile."
      />
      <form onSubmit={save} className="ad-settings-layout">
        <section className="ad-panel">
          <div className="ad-settings-section-title">
            <span>
              <Building2 size={18} />
            </span>
            <div>
              <h2>General settings</h2>
              <p>Brand and business contact details</p>
            </div>
          </div>
          <div className="ad-form-grid">
            <Field label="Restaurant brand name">
              <input
                className="ad-input"
                value={settings.brandName}
                onChange={(e) => update("brandName", e.target.value)}
                required
              />
            </Field>
            <Field label="Default city">
              <input
                className="ad-input"
                value={settings.defaultCity}
                onChange={(e) => update("defaultCity", e.target.value)}
                required
              />
            </Field>
            <Field label="Support email">
              <input
                className="ad-input"
                type="email"
                value={settings.supportEmail}
                onChange={(e) => update("supportEmail", e.target.value)}
              />
            </Field>
            <Field label="Support phone">
              <input
                className="ad-input"
                value={settings.supportPhone}
                onChange={(e) => update("supportPhone", e.target.value)}
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
              <p>Customer-facing prices and checkout display rules</p>
            </div>
          </div>
          <div className="ad-setting-line">
            <div>
              <strong>Prices include GST</strong>
              <small>
                Menu and order amounts already include GST. Do not add tax on
                top during checkout.
              </small>
            </div>
            <label className="ad-switch">
              <input
                type="checkbox"
                checked={settings.gstInclusive}
                onChange={(e) => update("gstInclusive", e.target.checked)}
              />
              <i />
            </label>
          </div>
          <Field label="GST rate (%)">
            <input
              className="ad-input ad-setting-number"
              type="number"
              min="0"
              max="28"
              value={settings.gstRate}
              onChange={(e) => update("gstRate", Number(e.target.value))}
            />
          </Field>
          <p className="ad-help">
            Prototype display uses the specified 5% inclusive-GST assumption.
            Confirm applicable tax treatment with your finance/compliance team
            before production.
          </p>
        </section>

        <section className="ad-panel">
          <div className="ad-settings-section-title">
            <span>
              <Bell size={18} />
            </span>
            <div>
              <h2>Service and notifications</h2>
              <p>Default order routing and alert preferences</p>
            </div>
          </div>
          <div className="ad-form-grid">
            <Field label="Default preparation time (minutes)">
              <input
                className="ad-input"
                type="number"
                min="5"
                max="180"
                value={settings.defaultPrepTime}
                onChange={(e) =>
                  update("defaultPrepTime", Number(e.target.value))
                }
              />
            </Field>
            <Field label="Outlet selection rule">
              <select
                className="ad-input"
                value={settings.outletSelection}
                onChange={(e) => update("outletSelection", e.target.value)}
              >
                <option>Nearest eligible outlet</option>
                <option>Configured outlet priority</option>
              </select>
            </Field>
          </div>
          <div className="ad-setting-line">
            <div>
              <strong>Order-delay notifications</strong>
              <small>
                Flag orders that pass their promised preparation time.
              </small>
            </div>
            <label className="ad-switch">
              <input
                type="checkbox"
                checked={settings.delayAlerts}
                onChange={(e) => update("delayAlerts", e.target.checked)}
              />
              <i />
            </label>
          </div>
          <div className="ad-setting-line">
            <div>
              <strong>Manager assignment alerts</strong>
              <small>Flag outlets without a designated manager.</small>
            </div>
            <label className="ad-switch">
              <input
                type="checkbox"
                checked={settings.managerAlerts}
                onChange={(e) => update("managerAlerts", e.target.checked)}
              />
              <i />
            </label>
          </div>
        </section>

        <section className="ad-panel">
          <div className="ad-settings-section-title">
            <span>
              <ShieldCheck size={18} />
            </span>
            <div>
              <h2>Account and security</h2>
              <p>Current Central Admin prototype identity</p>
            </div>
          </div>
          <div className="ad-form-grid">
            <Field label="Admin name">
              <input
                className="ad-input"
                value={settings.adminName}
                onChange={(e) => update("adminName", e.target.value)}
              />
            </Field>
            <Field label="Admin mobile">
              <input
                className="ad-input"
                value={settings.adminPhone}
                onChange={(e) => update("adminPhone", e.target.value)}
              />
            </Field>
          </div>
          <div className="ad-account-note">
            This is a frontend prototype. Authentication, role verification and
            protected admin API access must be enforced by the backend. These
            settings do not change a real login account.
          </div>
          <div className="ad-setting-actions">
            <button
              type="button"
              className="ad-button ad-button-quiet"
              onClick={signOut}
            >
              Sign out of demo admin
            </button>
          </div>
        </section>

        {error && <div className="ad-inline-error">{error}</div>}
        {saved && (
          <div className="ad-inline-success">
            <Save size={15} /> Settings saved to this browser's demo storage.
          </div>
        )}
        <div className="ad-form-actions">
          <button
            type="button"
            className="ad-button ad-button-danger-ghost"
            onClick={resetDemo}
          >
            <RotateCcw size={14} /> Reset demo data
          </button>
          <button
            type="submit"
            className="ad-button ad-button-primary"
            disabled={busy}
          >
            <Save size={14} /> {busy ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>
    </>
  );
}
