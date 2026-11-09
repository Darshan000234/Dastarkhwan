import { useEffect, useState } from "react";
import { ImagePlus } from "lucide-react";
import { Field, Modal } from "../common/AdminUI";
import { adminApi } from "../../../services/adminApi.js";

const EMPTY = {
  name: "",
  description: "",
  category: "Biryani",
  veg: false,
  spice: "Medium",
  allergensText: "",
  prepTime: "20",
  basePrice: "200",
  image: "",
  portionsText: "Regular:200",
  addonsText: "",
  addonGroupName: "Extras",
  addonsRequired: false,
  active: true,
  defaultTimeMenu: "All Day",
};

function parseNamedPrices(text) {
  return text
    .split(",")
    .map((part) => {
      const [name, amount] = part.split(":");
      if (!name?.trim()) return null;
      const price = Number(amount);
      if (!Number.isFinite(price) || price <= 0) return null;
      return { name: name.trim(), price };
    })
    .filter(Boolean);
}

export default function MenuItemModal({ open, item, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (item)
      setForm({
        ...EMPTY,
        ...item,
        allergensText: item.allergens.join(", "),
        portionsText: item.portions
          .map((part) => `${part.name}:${part.price}`)
          .join(", "),
        addonsText: item.addons
          .map((part) => `${part.name}:${part.price}`)
          .join(", "),
      });
    else setForm(EMPTY);
    setError("");
    setBusy(false);
  }, [item, open]);
  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault();
    setError("");
    if (
      form.name.trim().length < 2 ||
      !form.description.trim() ||
      Number(form.basePrice) <= 0 ||
      Number(form.prepTime) < 1
    ) {
      setError(
        "Enter a name, description, positive base price and valid preparation time.",
      );
      return;
    }
    const portions = parseNamedPrices(form.portionsText);
    if (!portions.length) {
      setError("Add at least one valid portion in Name:Price format.");
      return;
    }
    const invalidAddon =
      form.addonsText.trim() &&
      parseNamedPrices(form.addonsText).length !==
        form.addonsText.split(",").filter((part) => part.trim()).length;
    if (invalidAddon) {
      setError("Check add-ons. Use Name:Price, for example Extra Raita:30.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      veg: form.veg,
      spice: form.spice,
      allergens: form.allergensText
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      prepTime: Number(form.prepTime),
      basePrice: Number(form.basePrice),
      image: form.image.trim(),
      portions,
      addons: parseNamedPrices(form.addonsText),
      addonGroupName: form.addonGroupName.trim() || "Add-ons",
      addonsRequired: form.addonsRequired,
      active: form.active,
      defaultTimeMenu: form.defaultTimeMenu,
    };
    setBusy(true);
    try {
      if (item) await adminApi.updateMenuItem(item.id, payload);
      else await adminApi.createMenuItem(payload);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? `Edit ${item.name}` : "Create food item"}
      wide
    >
      <form className="ad-form-grid" onSubmit={save}>
        <section className="ad-form-section ad-span-2">
          <h3>01 · Basic details</h3>
          <div className="ad-form-grid-inner">
            <Field label="Food item name">
              <input
                className="ad-input"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                required
              />
            </Field>
            <Field label="Category">
              <select
                className="ad-input"
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
              >
                {[
                  "Biryani",
                  "Starters",
                  "Mains",
                  "Sides",
                  "Desserts",
                  "Specials",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <Field label="Description" className="ad-span-2">
              <textarea
                className="ad-input ad-textarea"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                required
              />
            </Field>
            <Field label="Food image URL" className="ad-span-2">
              <input
                className="ad-input"
                type="url"
                value={form.image}
                onChange={(e) => update("image", e.target.value)}
                placeholder="https://…"
              />
            </Field>
            {form.image && (
              <div className="ad-image-preview ad-span-2">
                <img
                  src={form.image}
                  alt="Food item preview"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <span>
                  <ImagePlus size={14} /> Image preview (external URL)
                </span>
              </div>
            )}
          </div>
        </section>
        <section className="ad-form-section">
          <h3>02 · Classification</h3>
          <div className="ad-form-grid-inner">
            <Field label="Food type">
              <select
                className="ad-input"
                value={String(form.veg)}
                onChange={(e) => update("veg", e.target.value === "true")}
              >
                <option value="true">Vegetarian</option>
                <option value="false">Non-vegetarian</option>
              </select>
            </Field>
            <Field label="Spice level">
              <select
                className="ad-input"
                value={form.spice}
                onChange={(e) => update("spice", e.target.value)}
              >
                {["None", "Mild", "Medium", "Hot"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <Field label="Allergens (comma separated)" className="ad-span-2">
              <input
                className="ad-input"
                value={form.allergensText}
                onChange={(e) => update("allergensText", e.target.value)}
                placeholder="Dairy, Peanuts, Gluten"
              />
            </Field>
          </div>
        </section>
        <section className="ad-form-section">
          <h3>03 · Pricing and preparation</h3>
          <div className="ad-form-grid-inner">
            <Field label="Central default price (₹)">
              <input
                className="ad-input"
                type="number"
                min="1"
                value={form.basePrice}
                onChange={(e) => update("basePrice", e.target.value)}
              />
            </Field>
            <Field label="Default prep time (minutes)">
              <input
                className="ad-input"
                type="number"
                min="1"
                max="180"
                value={form.prepTime}
                onChange={(e) => update("prepTime", e.target.value)}
              />
            </Field>
            <Field
              label="Portions (Name:Price)"
              className="ad-span-2"
              hint="Example: Regular:380, Family:1050"
            >
              <input
                className="ad-input"
                value={form.portionsText}
                onChange={(e) => update("portionsText", e.target.value)}
              />
            </Field>
          </div>
        </section>
        <section className="ad-form-section ad-span-2">
          <h3>04 · Customisation and availability</h3>
          <div className="ad-form-grid-inner">
            <Field label="Add-on group name">
              <input
                className="ad-input"
                value={form.addonGroupName}
                onChange={(e) => update("addonGroupName", e.target.value)}
                placeholder="Extras"
              />
            </Field>
            <Field label="Default time menu">
              <select
                className="ad-input"
                value={form.defaultTimeMenu}
                onChange={(e) => update("defaultTimeMenu", e.target.value)}
              >
                {["All Day", "Breakfast", "Lunch", "Dinner", "Late Night"].map(
                  (value) => (
                    <option key={value}>{value}</option>
                  ),
                )}
              </select>
            </Field>
            <Field
              label="Add-ons (Name:Price)"
              className="ad-span-2"
              hint="Example: Extra Raita:30, Boiled Egg:25"
            >
              <input
                className="ad-input"
                value={form.addonsText}
                onChange={(e) => update("addonsText", e.target.value)}
              />
            </Field>
            <label className="ad-check-label ad-span-2">
              <input
                type="checkbox"
                checked={form.addonsRequired}
                onChange={(e) => update("addonsRequired", e.target.checked)}
              />{" "}
              Customer must select at least one add-on from this group
            </label>
            <Field label="Central catalog status">
              <select
                className="ad-input"
                value={String(form.active)}
                onChange={(e) => update("active", e.target.value === "true")}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </Field>
          </div>
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
          <button className="ad-button ad-button-primary" disabled={busy}>
            {busy ? "Saving…" : "Save catalog item"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
