import { useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

import { useManager } from "../../../context/ManagerContext";
import managerApi from "../../../services/managerApi";
import {
  Badge,
  Empty,
  ManagerPageHeader,
  Modal,
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
      await onSave({
        isAvailable: false,
        unavailabilityReason: reason,
        expectedRestockAt: restockAt
          ? new Date(restockAt).toISOString()
          : null,
      });

      onClose();
    } catch (err) {
      setError(err.message || "Unable to update availability.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      title={`Pause ${item?.name}`}
    >
      <div className="om-form">
        <p className="om-form-note">
          This changes availability for this outlet only. Central catalog
          details and pricing are not changed.
        </p>

        <label>
          Reason
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
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
            onChange={(event) => setRestockAt(event.target.value)}
          />
        </label>

        {error && <p className="om-form-error">{error}</p>}

        <div className="om-form-actions">
          <button
            type="button"
            className="om-button ghost"
            onClick={onClose}
          >
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
  const { menu, refreshMenu } = useManager();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [type, setType] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [selected, setSelected] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [toast, setToast] = useState("");
  const [tone, setTone] = useState("success");

  const categories = [
    ...new Set(menu.map((item) => item.category).filter(Boolean)),
  ];

  const rows = useMemo(
    () =>
      menu.filter((item) => {
        const name = String(item.name || "").toLowerCase();

        return (
          (!search || name.includes(search.toLowerCase())) &&
          (category === "all" || item.category === category) &&
          (type === "all" ||
            (type === "veg" ? item.veg : !item.veg)) &&
          (availability === "all" ||
            (availability === "available"
              ? item.mapping.available
              : !item.mapping.available))
        );
      }),
    [menu, search, category, type, availability],
  );

  const update = async (item, payload) => {
    const foodItemId = item.foodItemId || item.id;

    if (!foodItemId) {
      throw new Error("Central FoodItem ID is missing.");
    }

    setBusyId(foodItemId);

    try {
      await managerApi.updateAvailability(foodItemId, payload);
      await refreshMenu();

      setToast(
        `${item.name} marked ${
          payload.isAvailable ? "available" : "unavailable"
        }.`,
      );
      setTone("success");
    } catch (error) {
      setToast(error.message || "Unable to update menu availability.");
      setTone("error");
      throw error;
    } finally {
      setBusyId("");
    }
  };

  const enable = async (item) => {
    try {
      await update(item, {
        isAvailable: true,
      });
    } catch {
      // Error toast is already displayed.
    }
  };

  return (
    <>
      <ManagerPageHeader
        eyebrow="OUTLET MENU CONTROLS"
        title="Menu availability"
        description="Temporarily pause or restore dishes mapped to your outlet. Central catalog, assignments and prices remain read-only."
      />

      <div className="om-filterbar">
        <label className="om-search">
          <Search size={16} />
          <input
            placeholder="Search dishes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label>
          <span>Category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Food type</span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="all">All</option>
            <option value="veg">Vegetarian</option>
            <option value="nonveg">Non-vegetarian</option>
          </select>
        </label>

        <label>
          <span>Availability</span>
          <select
            value={availability}
            onChange={(event) => setAvailability(event.target.value)}
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
        {rows.map((item) => {
          const id = item.foodItemId || item.id;
          const isAvailable = item.mapping.available;

          return (
            <article
              className={`om-menu-item ${!isAvailable ? "paused" : ""}`}
              key={id}
            >
              <div className="om-menu-image">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    loading="lazy"
                  />
                ) : (
                  <span>Dish</span>
                )}

                <Badge tone={isAvailable ? "success" : "danger"}>
                  {isAvailable ? "Available" : "Unavailable"}
                </Badge>
              </div>

              <div className="om-menu-copy">
                <small>
                  {item.category} ·{" "}
                  {item.veg ? "Vegetarian" : "Non-vegetarian"}
                </small>

                <h3>{item.name}</h3>
                <p>{item.description}</p>

                <div className="om-menu-meta">
                  <span>
                    Stock: {item.mapping.stockQuantity ?? 0}
                  </span>
                  <span>
                    {item.mapping.timeMenuLabel || "No time menu label"}
                  </span>
                </div>

                {item.mapping.availabilityReason && (
                  <p className="om-paused-reason">
                    Reason: {item.mapping.availabilityReason}
                    {item.mapping.expectedRestockAt
                      ? ` · Restock ${new Date(
                          item.mapping.expectedRestockAt,
                        ).toLocaleString("en-IN")}`
                      : ""}
                  </p>
                )}

                <div className="om-menu-actions">
                  {isAvailable ? (
                    <button
                      type="button"
                      className="om-button danger-outline"
                      disabled={busyId === id}
                      onClick={() => setSelected(item)}
                    >
                      <ToggleLeft size={17} />
                      {busyId === id ? "Updating…" : "Mark unavailable"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="om-button primary"
                      disabled={busyId === id}
                      onClick={() => enable(item)}
                    >
                      <ToggleRight size={17} />
                      {busyId === id ? "Updating…" : "Mark available"}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}

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

      <Toast
        message={toast}
        tone={tone}
        onClose={() => setToast("")}
      />
    </>
  );
}