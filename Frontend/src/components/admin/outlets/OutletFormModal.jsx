import { useEffect, useState } from "react";
import { Modal, Field } from "../common/AdminUI";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const blank = {
  name: "",
  code: "",
  type: "Restaurant",
  city: "Hyderabad",
  address: "",
  phone: "",
  primaryPincode: "",
  pincodesText: "",
  radius: "5",
  openTime: "11:00",
  closeTime: "23:00",
  days: [...WEEKDAYS],
  prepTime: "25",
  active: true,
  fssai: "DEMO-FSSAI-PENDING",
  veg: true,
  nonVeg: true,
};

export default function OutletFormModal({ open, outlet, onClose, onSave }) {
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (outlet)
      setForm({
        ...blank,
        ...outlet,
        pincodesText: (outlet.pincodes || [])
          .filter((pin) => pin !== outlet.primaryPincode)
          .join(", "),
      });
    else setForm(blank);
    setError("");
    setSaving(false);
  }, [outlet, open]);

  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const toggleDay = (day) =>
    update(
      "days",
      form.days.includes(day)
        ? form.days.filter((value) => value !== day)
        : [...form.days, day],
    );

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (
      !form.name.trim() ||
      !/^[A-Za-z0-9-]{3,20}$/.test(form.code.trim()) ||
      !form.address.trim()
    ) {
      setError(
        "Enter an outlet name, a unique code (3–20 letters/numbers) and a complete address.",
      );
      return;
    }
    if (!/^[1-9]\d{5}$/.test(form.primaryPincode)) {
      setError("Enter a valid 6-digit primary service pincode.");
      return;
    }
    if (form.phone && !/^[6-9]\d{9}$/.test(form.phone)) {
      setError("Enter a valid 10-digit Indian outlet contact mobile.");
      return;
    }
    const additionalPins = form.pincodesText
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (additionalPins.some((pin) => !/^[1-9]\d{5}$/.test(pin))) {
      setError(
        "Each additional serviceable pincode must contain exactly 6 valid digits.",
      );
      return;
    }
    if (!form.days.length) {
      setError("Select at least one operating day.");
      return;
    }
    if (form.openTime === form.closeTime) {
      setError("Opening and closing times cannot be identical.");
      return;
    }
    const pincodes = [...new Set([form.primaryPincode, ...additionalPins])];
    const payload = {
      ...form,
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      city: form.city.trim(),
      radius: Number(form.radius),
      prepTime: Number(form.prepTime),
      pincodes,
    };
    delete payload.pincodesText;
    setSaving(true);
    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err.message || "Unable to save outlet.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={outlet ? `Edit ${outlet.name}` : "Create outlet"}
      wide
    >
      <form className="ad-form-grid" onSubmit={submit}>
        <section className="ad-form-section ad-span-2">
          <h3>01 · Basic information</h3>
          <div className="ad-form-grid-inner">
            <Field label="Outlet name">
              <input
                className="ad-input"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Banjara Hills"
                required
              />
            </Field>
            <Field label="Unique outlet code">
              <input
                className="ad-input"
                value={form.code}
                onChange={(e) => update("code", e.target.value.toUpperCase())}
                placeholder="HYD-BAN-04"
                required
              />
            </Field>
            <Field label="Outlet type">
              <select
                className="ad-input"
                value={form.type}
                onChange={(e) => update("type", e.target.value)}
              >
                <option>Restaurant</option>
                <option>Cloud Kitchen</option>
              </select>
            </Field>
            <Field label="City">
              <input
                className="ad-input"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                required
              />
            </Field>
            <Field label="Complete address" className="ad-span-2">
              <input
                className="ad-input"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                required
              />
            </Field>
            <Field label="Contact mobile (+91)">
              <input
                className="ad-input"
                inputMode="numeric"
                maxLength={10}
                value={form.phone}
                onChange={(e) =>
                  update(
                    "phone",
                    e.target.value.replace(/\D/g, "").slice(0, 10),
                  )
                }
                placeholder="10-digit number"
              />
            </Field>
          </div>
        </section>

        <section className="ad-form-section ad-span-2">
          <h3>02 · Delivery and service area</h3>
          <div className="ad-form-grid-inner">
            <Field label="Primary delivery pincode">
              <input
                className="ad-input"
                inputMode="numeric"
                maxLength={6}
                value={form.primaryPincode}
                onChange={(e) =>
                  update(
                    "primaryPincode",
                    e.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
                required
              />
            </Field>
            <Field
              label="Additional serviceable pincodes"
              hint="Comma-separated, six digits each"
            >
              <input
                className="ad-input"
                value={form.pincodesText}
                onChange={(e) => update("pincodesText", e.target.value)}
                placeholder="500081, 500032"
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
          </div>
          <p className="ad-help">
            Prototype serviceability uses a pincode-to-outlet mapping. If
            multiple active outlets match, the configured selection rule in
            Settings is the planned tie-breaker.
          </p>
        </section>

        <section className="ad-form-section ad-span-2">
          <h3>03 · Outlet operations</h3>
          <div className="ad-form-grid-inner">
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
                {WEEKDAYS.map((day) => (
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
          </div>
        </section>

        <section className="ad-form-section ad-span-2">
          <h3>04 · Food and compliance</h3>
          <div className="ad-form-grid-inner">
            <Field label="FSSAI record / demo placeholder">
              <input
                className="ad-input"
                value={form.fssai}
                onChange={(e) => update("fssai", e.target.value)}
              />
            </Field>
            <div className="ad-check-list">
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
          </div>
          <p className="ad-help">
            Any value prefixed with DEMO is a placeholder, not a verified FSSAI
            licence.
          </p>
        </section>
        {error && <div className="ad-inline-error ad-span-2">{error}</div>}
        <div className="ad-form-actions ad-span-2">
          <button
            type="button"
            className="ad-button ad-button-quiet"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="ad-button ad-button-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : outlet ? "Save outlet" : "Create outlet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
