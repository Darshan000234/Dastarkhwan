import { useState } from "react";
import { Field, Modal, money } from "../common/AdminUI";
import { mockApi } from "../../../services/mockApi";

export default function OutletAssignmentModal({
  item,
  outlets,
  onClose,
  onSaved,
}) {
  const existing = (outletId) =>
    outlets
      .find((outlet) => outlet.id === outletId)
      ?.menu.find((mapping) => mapping.itemId === item.id);
  const [selected, setSelected] = useState(
    outlets.filter((outlet) => !existing(outlet.id)).map((outlet) => outlet.id),
  );
  const [available, setAvailable] = useState(true);
  const [priceOverride, setPriceOverride] = useState("");
  const [timeMenu, setTimeMenu] = useState(item.defaultTimeMenu || "All Day");
  const [error, setError] = useState("");
  const toggle = (id) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  const save = async (event) => {
    event.preventDefault();
    setError("");
    if (!selected.length) {
      setError("Select at least one outlet.");
      return;
    }
    if (
      priceOverride !== "" &&
      (!Number.isFinite(Number(priceOverride)) || Number(priceOverride) <= 0)
    ) {
      setError("Outlet price override must be a positive number or blank.");
      return;
    }
    try {
      await mockApi.assignMenuItemToOutlet({
        itemId: item.id,
        outletIds: selected,
        available,
        priceOverride: priceOverride === "" ? null : Number(priceOverride),
        timeMenu,
      });
      await onSaved(selected.length);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Assign ${item.name}`}>
      <form className="ad-form-grid" onSubmit={save}>
        <div className="ad-detail-block ad-span-2">
          <span>Central default price</span>
          <strong>{money(item.basePrice)}</strong>
          <small>
            City pricing and outlet overrides determine the final selling price.
          </small>
        </div>
        <div className="ad-span-2">
          <strong className="ad-form-label">Select outlets</strong>
          <div className="ad-check-list ad-assignment-checklist">
            {outlets.map((outlet) => {
              const mapped = existing(outlet.id);
              return (
                <label key={outlet.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(outlet.id)}
                    onChange={() => toggle(outlet.id)}
                  />{" "}
                  <span>
                    <strong>{outlet.name}</strong>
                    <small>
                      {outlet.city} ·{" "}
                      {mapped
                        ? "Already mapped (will update mapping)"
                        : "Not mapped"}
                    </small>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        <Field
          label="Outlet price override (optional, same for selected outlets)"
          className="ad-span-2"
        >
          <input
            className="ad-input"
            type="number"
            min="1"
            value={priceOverride}
            onChange={(e) => setPriceOverride(e.target.value)}
            placeholder="Blank = inherit city/default price"
          />
        </Field>
        <Field label="Time-based menu" className="ad-span-2">
          <select
            className="ad-input"
            value={timeMenu}
            onChange={(e) => setTimeMenu(e.target.value)}
          >
            {["All Day", "Breakfast", "Lunch", "Dinner", "Late Night"].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
        </Field>
        <label className="ad-check-label ad-span-2">
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
          />{" "}
          Mark available at selected outlets
        </label>
        {error && <div className="ad-inline-error ad-span-2">{error}</div>}
        <div className="ad-form-actions ad-span-2">
          <button
            type="button"
            className="ad-button ad-button-quiet"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="ad-button ad-button-primary">
            Save outlet mappings
          </button>
        </div>
      </form>
    </Modal>
  );
}
