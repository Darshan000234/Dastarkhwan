import { useState } from "react";
import { Clock3, Edit3, Plus } from "lucide-react";
import { adminApi } from "../../../services/adminApi.js";
import { Field, StatusBadge } from "../common/AdminUI";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const blank = () => ({
  id: null,
  name: "",
  start: "11:00",
  end: "15:00",
  days: [...DAYS],
  outletIds: [],
  itemIds: [],
  active: true,
});

export default function TimeBasedMenuTab({
  timeMenus,
  outlets,
  items,
  onRefresh,
}) {
  const [form, setForm] = useState(blank());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const toggle = (key, value) =>
    update(
      key,
      form[key].includes(value)
        ? form[key].filter((entry) => entry !== value)
        : [...form[key], value],
    );
  const edit = (menu) => {
    setForm({
      ...menu,
      days: [...menu.days],
      outletIds: [...menu.outletIds],
      itemIds: [...menu.itemIds],
    });
    setError("");
  };
  const reset = () => {
    setForm(blank());
    setError("");
  };

  const save = async (event) => {
    event.preventDefault();
    setError("");
    if (
      !form.name.trim() ||
      !form.days.length ||
      !form.outletIds.length ||
      !form.itemIds.length
    ) {
      setError(
        "Enter a name and select at least one day, outlet and menu item.",
      );
      return;
    }
    if (form.start >= form.end) {
      setError(
        "End time must be later than start time. Overnight ranges are not supported.",
      );
      return;
    }
    setBusy(true);
    try {
      await adminApi.saveTimeMenu(form);
      await onRefresh();
      reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (menu) => {
    try {
      await adminApi.saveTimeMenu({ ...menu, active: !menu.active });
      await onRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="ad-time-menu-layout ad-section-gap">
      <section className="ad-panel">
        <div className="ad-panel-header">
          <div>
            <h2>Configured time menus</h2>
            <p>
              Enter schedule times in Indian Standard Time (IST, UTC+05:30). The
              prototype stores the HH:MM values without timezone conversion.
            </p>
          </div>
          <StatusBadge tone="neutral">{timeMenus.length} schedules</StatusBadge>
        </div>
        <div className="ad-time-menu-list">
          {timeMenus.map((menu) => (
            <article className="ad-time-menu-card" key={menu.id}>
              <div className="ad-time-menu-card-top">
                <span className="ad-time-icon">
                  <Clock3 size={17} />
                </span>
                <StatusBadge tone={menu.active ? "success" : "warning"}>
                  {menu.active ? "Active" : "Inactive"}
                </StatusBadge>
              </div>
              <h3>{menu.name}</h3>
              <strong>
                {menu.start} – {menu.end}
              </strong>
              <small>{menu.days.join(", ")}</small>
              <small>
                {menu.outletIds.length} outlets · {menu.itemIds.length} items
              </small>
              <div className="ad-row-actions">
                <button
                  type="button"
                  className="ad-button ad-button-quiet ad-button-xs"
                  onClick={() => edit(menu)}
                >
                  <Edit3 size={12} /> Edit
                </button>
                <button
                  type="button"
                  className="ad-button ad-button-quiet ad-button-xs"
                  onClick={() => toggleActive(menu)}
                >
                  {menu.active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </article>
          ))}
          {!timeMenus.length && (
            <div className="ad-empty-inline">No time menus configured yet.</div>
          )}
        </div>
      </section>
      <section className="ad-panel">
        <div className="ad-panel-header">
          <div>
            <h2>{form.id ? "Edit schedule" : "Create time menu"}</h2>
            <p>
              Overlapping active schedules for the same selected outlet and day
              are rejected.
            </p>
          </div>
          <button
            type="button"
            className="ad-button ad-button-quiet ad-button-xs"
            onClick={reset}
          >
            <Plus size={13} /> New
          </button>
        </div>
        <form className="ad-form-grid" onSubmit={save}>
          <Field label="Menu name" className="ad-span-2">
            <input
              className="ad-input"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Breakfast, Lunch, Dinner…"
              required
            />
          </Field>
          <Field label="Start time">
            <input
              className="ad-input"
              type="time"
              value={form.start}
              onChange={(e) => update("start", e.target.value)}
              required
            />
          </Field>
          <Field label="End time">
            <input
              className="ad-input"
              type="time"
              value={form.end}
              onChange={(e) => update("end", e.target.value)}
              required
            />
          </Field>
          <div className="ad-span-2">
            <strong className="ad-form-label">Applicable days</strong>
            <div className="ad-chip-checks">
              {DAYS.map((day) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    checked={form.days.includes(day)}
                    onChange={() => toggle("days", day)}
                  />
                  {day}
                </label>
              ))}
            </div>
          </div>
          <div className="ad-span-2">
            <strong className="ad-form-label">Assigned outlets</strong>
            <div className="ad-check-list ad-check-list-scroll">
              {outlets.map((outlet) => (
                <label key={outlet.id}>
                  <input
                    type="checkbox"
                    checked={form.outletIds.includes(outlet.id)}
                    onChange={() => toggle("outletIds", outlet.id)}
                  />
                  {outlet.name}
                </label>
              ))}
            </div>
          </div>
          <div className="ad-span-2">
            <strong className="ad-form-label">Assigned catalog items</strong>
            <div className="ad-check-list ad-check-list-scroll">
              {items.map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={form.itemIds.includes(item.id)}
                    onChange={() => toggle("itemIds", item.id)}
                  />
                  {item.name}
                </label>
              ))}
            </div>
          </div>
          <Field label="Schedule status" className="ad-span-2">
            <select
              className="ad-input"
              value={String(form.active)}
              onChange={(e) => update("active", e.target.value === "true")}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </Field>
          {error && <div className="ad-inline-error ad-span-2">{error}</div>}
          <div className="ad-form-actions ad-span-2">
            <button
              type="button"
              className="ad-button ad-button-quiet"
              onClick={reset}
            >
              Clear
            </button>
            <button className="ad-button ad-button-primary" disabled={busy}>
              {busy ? "Saving…" : form.id ? "Update schedule" : "Save schedule"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
