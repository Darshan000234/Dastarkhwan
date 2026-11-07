import { useEffect, useState } from "react";
import { mockApi } from "../../../services/mockApi";
import { Field } from "../common/AdminUI";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function OutletSettingsTab({ outlet, onSaved }) {
  const [form, setForm] = useState({
    ...outlet,
    pincodesText: (outlet.pincodes || [])
      .filter((pin) => pin !== outlet.primaryPincode)
      .join(", "),
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(
    () =>
      setForm({
        ...outlet,
        pincodesText: (outlet.pincodes || [])
          .filter((pin) => pin !== outlet.primaryPincode)
          .join(", "),
      }),
    [outlet],
  );
  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const toggleDay = (day) =>
    update(
      "days",
      form.days.includes(day)
        ? form.days.filter((value) => value !== day)
        : [...form.days, day],
    );
  const save = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (
      form.active !== outlet.active &&
      !window.confirm(
        `${form.active ? "Activate" : "Deactivate"} ${outlet.name}?`,
      )
    )
      return;
    if (
      !/^[1-9]\d{5}$/.test(form.primaryPincode) ||
      !form.days.length ||
      Number(form.radius) < 1 ||
      Number(form.prepTime) < 5
    ) {
      setError(
        "Check the pincode, selected operating days, delivery radius and preparation time.",
      );
      return;
    }
    setBusy(true);
    try {
      const pincodes = [
        ...new Set([
          form.primaryPincode,
          ...form.pincodesText
            .split(",")
            .map((value) => value.trim())
            .filter((value) => /^[1-9]\d{5}$/.test(value)),
        ]),
      ];
      const payload = {
        ...form,
        pincodes,
        radius: Number(form.radius),
        prepTime: Number(form.prepTime),
      };
      delete payload.pincodesText;
      await mockApi.updateOutlet(outlet.id, payload);
      setMessage("Outlet settings saved to demo storage.");
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="ad-panel ad-section-gap">
      <div className="ad-panel-header">
        <div>
          <h2>Outlet settings</h2>
          <p>Operating hours, coverage, contact and compliance information.</p>
        </div>
      </div>
      <form className="ad-form-grid" onSubmit={save}>
        <Field label="Outlet contact mobile (+91)">
          <input
            className="ad-input"
            value={form.phone || ""}
            maxLength={10}
            onChange={(e) =>
              update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))
            }
          />
        </Field>
        <Field label="Delivery radius (km)">
          <input
            className="ad-input"
            type="number"
            min="1"
            max="50"
            value={form.radius}
            onChange={(e) => update("radius", e.target.value)}
          />
        </Field>
        <Field label="Opening time">
          <input
            className="ad-input"
            type="time"
            value={form.openTime}
            onChange={(e) => update("openTime", e.target.value)}
          />
        </Field>
        <Field label="Closing time">
          <input
            className="ad-input"
            type="time"
            value={form.closeTime}
            onChange={(e) => update("closeTime", e.target.value)}
          />
        </Field>
        <Field label="Minimum preparation (minutes)">
          <input
            className="ad-input"
            type="number"
            min="5"
            max="180"
            value={form.prepTime}
            onChange={(e) => update("prepTime", e.target.value)}
          />
        </Field>
        <Field label="Primary delivery pincode">
          <input
            className="ad-input"
            maxLength={6}
            value={form.primaryPincode}
            onChange={(e) =>
              update(
                "primaryPincode",
                e.target.value.replace(/\D/g, "").slice(0, 6),
              )
            }
          />
        </Field>
        <Field label="Additional serviceable pincodes" className="ad-span-2">
          <input
            className="ad-input"
            value={form.pincodesText || ""}
            onChange={(e) => update("pincodesText", e.target.value)}
            placeholder="500081, 500032"
          />
        </Field>
        <Field label="FSSAI record / placeholder">
          <input
            className="ad-input"
            value={form.fssai || ""}
            onChange={(e) => update("fssai", e.target.value)}
          />
        </Field>
        <Field label="Operational status">
          <select
            className="ad-input"
            value={String(form.active)}
            onChange={(e) => update("active", e.target.value === "true")}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </Field>
        <div className="ad-span-2">
          <strong className="ad-form-label">Operating days</strong>
          <div className="ad-chip-checks">
            {DAYS.map((day) => (
              <label key={day}>
                <input
                  type="checkbox"
                  checked={form.days.includes(day)}
                  onChange={() => toggleDay(day)}
                />
                {day}
              </label>
            ))}
          </div>
        </div>
        <div className="ad-check-list ad-span-2">
          <label>
            <input
              type="checkbox"
              checked={form.veg}
              onChange={(e) => update("veg", e.target.checked)}
            />{" "}
            Supports vegetarian food
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.nonVeg}
              onChange={(e) => update("nonVeg", e.target.checked)}
            />{" "}
            Supports non-vegetarian food
          </label>
        </div>
        <p className="ad-footnote ad-span-2">
          Delivery coverage currently uses the configured pincode list.
          Radius-based geocoding is not implemented in this frontend prototype.
          Demo FSSAI labels are placeholders only.
        </p>
        {error && <div className="ad-inline-error ad-span-2">{error}</div>}
        {message && (
          <div className="ad-inline-success ad-span-2">{message}</div>
        )}
        <div className="ad-form-actions ad-span-2">
          <button className="ad-button ad-button-primary" disabled={busy}>
            {busy ? "Saving…" : "Save outlet settings"}
          </button>
        </div>
      </form>
    </section>
  );
}
