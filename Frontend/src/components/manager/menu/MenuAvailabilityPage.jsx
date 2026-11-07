import { useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useManager } from "../../../context/ManagerContext";
import { mockOutletManagerApi } from "../../../services/mockOutletManagerApi";
import {
  Badge,
  Empty,
  ManagerPageHeader,
  Modal,
  money,
  Toast,
} from "../common/ManagerUI";
function AvailabilityModal({ item, onClose, onSave }) {
  const [reason, setReason] = useState("Out of stock");
  const [restockAt, setRestockAt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await onSave({ available: false, reason, restockAt });
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={Boolean(item)} onClose={onClose} title={`Pause ${item?.name}`}>
      <div className="om-form">
        <p className="om-form-note">
          This changes availability only. The menu mapping, central catalog and
          price remain untouched.
        </p>
        <label>
          Reason
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option>Out of stock</option>
            <option>Ingredient unavailable</option>
            <option>Temporarily paused</option>
            <option>Other</option>
          </select>
        </label>
        <label>
          Expected restock time (optional)
          <input
            type="datetime-local"
            value={restockAt}
            onChange={(e) => setRestockAt(e.target.value)}
          />
        </label>
        {error && <p className="om-form-error">{error}</p>}
        <div className="om-form-actions">
          <button type="button" className="om-button ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="om-button danger"
            disabled={busy}
            onClick={submit}
          >
            {busy ? "Updating…" : "Mark unavailable"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
export default function MenuAvailabilityPage() {
  const { menu, run } = useManager();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [type, setType] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState("");
  const [tone, setTone] = useState("success");
  const categories = [
    ...new Set(menu.map((item) => item.category).filter(Boolean)),
  ];
  const rows = useMemo(
    () =>
      menu.filter(
        (item) =>
          (!search || item.name.toLowerCase().includes(search.toLowerCase())) &&
          (category === "all" || item.category === category) &&
          (type === "all" || (type === "veg" ? item.veg : !item.veg)) &&
          (availability === "all" ||
            (availability === "available"
              ? item.mapping.available
              : !item.mapping.available)),
      ),
    [menu, search, category, type, availability],
  );
  const update = async (item, payload) => {
    await run(() => mockOutletManagerApi.updateAvailability(item.id, payload));
    setToast(
      `${item.name} marked ${payload.available ? "available" : "unavailable"}. Customer menu updated.`,
    );
    setTone("success");
  };
  return (
    <>
      <ManagerPageHeader
        eyebrow="OUTLET MENU CONTROLS"
        title="Menu availability"
        description="Temporarily pause or restore dishes mapped to your outlet. Central catalog, assignments and prices are read-only here."
      />
      <div className="om-filterbar">
        <label className="om-search">
          <Search size={16} />
          <input
            placeholder="Search dishes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          <span>Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Food type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All</option>
            <option value="veg">Vegetarian</option>
            <option value="nonveg">Non-vegetarian</option>
          </select>
        </label>
        <label>
          <span>Availability</span>
          <select
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
          >
            <option value="all">All</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </label>
        <span className="om-filter-count">
          <SlidersHorizontal size={14} />
          {rows.length} mapped items
        </span>
      </div>
      <div className="om-menu-grid">
        {rows.map((item) => (
          <article
            className={`om-menu-item ${!item.mapping.available ? "paused" : ""}`}
            key={item.id}
          >
            <div className="om-menu-image">
              {item.image ? (
                <img src={item.image} alt={item.name} loading="lazy" />
              ) : (
                <span>Dish</span>
              )}
              <Badge tone={item.mapping.available ? "success" : "danger"}>
                {item.mapping.available ? "Available" : "Unavailable"}
              </Badge>
            </div>
            <div className="om-menu-copy">
              <small>
                {item.category} · {item.veg ? "Vegetarian" : "Non-vegetarian"}
              </small>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <div className="om-menu-meta">
                <strong>{money(item.effectivePrice)}</strong>
                <span>{(item.portions || []).length || 1} portion options</span>
              </div>
              {item.mapping.availabilityReason && (
                <p className="om-paused-reason">
                  Reason: {item.mapping.availabilityReason}
                  {item.mapping.restockAt
                    ? ` · Restock ${new Date(item.mapping.restockAt).toLocaleString("en-IN")}`
                    : ""}
                </p>
              )}
              <div className="om-menu-actions">
                {item.mapping.available ? (
                  <button
                    type="button"
                    className="om-button danger-outline"
                    onClick={() => setSelected(item)}
                  >
                    <ToggleLeft size={17} /> Mark unavailable
                  </button>
                ) : (
                  <button
                    type="button"
                    className="om-button primary"
                    onClick={() => update(item, { available: true })}
                  >
                    <ToggleRight size={17} /> Mark available
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
        {rows.length === 0 && (
          <Empty
            title="No mapped dishes found"
            detail="Try a different search or filter."
          />
        )}
      </div>
      <AvailabilityModal
        item={selected}
        onClose={() => setSelected(null)}
        onSave={(payload) => update(selected, payload)}
      />
      <Toast message={toast} tone={tone} onClose={() => setToast("")} />
    </>
  );
}
