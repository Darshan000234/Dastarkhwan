import { useEffect, useState } from "react";
import { Plus, Trash2, Edit3 } from "lucide-react";
import { mockApi } from "../../../services/mockApi";
import { Modal, Field, SearchBox, StatusBadge, money } from "../common/AdminUI";

function AddItemsModal({ outlet, catalog, currentIds, onClose, onAssigned }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [timeMenu, setTimeMenu] = useState("All Day");
  const [error, setError] = useState("");
  const available = catalog.filter(
    (item) => item.active && !currentIds.includes(item.id),
  );
  const toggle = (id) =>
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!selectedIds.length) {
      setError("Select at least one central catalog item.");
      return;
    }
    try {
      await mockApi.assignMenuItemToOutlet({
        itemId: selectedIds[0],
        outletIds: [outlet.id],
        timeMenu,
      });
      for (const id of selectedIds.slice(1))
        await mockApi.assignMenuItemToOutlet({
          itemId: id,
          outletIds: [outlet.id],
          timeMenu,
        });
      await onAssigned(selectedIds.length);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Add menu items · ${outlet.name}`}
      wide
    >
      <form className="ad-form-grid" onSubmit={submit}>
        <p className="ad-modal-copy ad-span-2">
          Choose central catalog entries to map to this outlet. Unmapped items
          remain excluded from the customer-facing outlet menu.
        </p>
        <div className="ad-catalog-pick-list ad-span-2">
          {available.length ? (
            available.map((item) => (
              <label key={item.id} className="ad-catalog-pick">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => toggle(item.id)}
                />
                <img src={item.image} alt="" />
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.category} ·{" "}
                    {item.veg ? "Vegetarian" : "Non-vegetarian"} ·{" "}
                    {money(item.basePrice)} base
                  </small>
                </span>
              </label>
            ))
          ) : (
            <div className="ad-empty-inline">
              All active catalog items are already mapped to this outlet.
            </div>
          )}
        </div>
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
            disabled={!available.length}
          >
            Map {selectedIds.length || "selected"} item
            {selectedIds.length === 1 ? "" : "s"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MappingEditor({ outlet, item, onClose, onSaved }) {
  const [override, setOverride] = useState(item.mapping.priceOverride ?? "");
  const [available, setAvailable] = useState(item.mapping.available);
  const [timeMenu, setTimeMenu] = useState(item.mapping.timeMenu || "All Day");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (event) => {
    event.preventDefault();
    setError("");
    if (
      override !== "" &&
      (!Number.isFinite(Number(override)) || Number(override) <= 0)
    ) {
      setError(
        "Enter a valid outlet price or clear it to inherit the city/default price.",
      );
      return;
    }
    setBusy(true);
    try {
      await mockApi.updateOutletMenuItem({
        outletId: outlet.id,
        itemId: item.id,
        available,
        priceOverride: override === "" ? null : Number(override),
        timeMenu,
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Edit mapping · ${item.name}`}>
      <form className="ad-form-grid" onSubmit={save}>
        <div className="ad-detail-block ad-span-2">
          <span>Current effective price</span>
          <strong>{money(item.effectivePrice)}</strong>
          <small>Outlet override → city price → central default</small>
        </div>
        <Field
          label="Outlet-specific price override (₹)"
          className="ad-span-2"
          hint="Leave blank to inherit the city price, then the central default."
        >
          <input
            className="ad-input"
            type="number"
            min="1"
            value={override}
            onChange={(e) => setOverride(e.target.value)}
            placeholder="Use inherited price"
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
          Available to customers at this outlet
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
          <button className="ad-button ad-button-primary" disabled={busy}>
            {busy ? "Saving…" : "Save mapping"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function OutletMenuTab({ outlet, onNotice }) {
  const [items, setItems] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const refresh = async () => {
    const [mapped, all] = await Promise.all([
      mockApi.getOutletMenu(outlet.id),
      mockApi.getMenuCatalog(),
    ]);
    setItems(mapped);
    setCatalog(all);
  };
  useEffect(() => {
    let mounted = true;
    Promise.all([
      mockApi.getOutletMenu(outlet.id),
      mockApi.getMenuCatalog(),
    ]).then(([mapped, all]) => {
      if (mounted) {
        setItems(mapped);
        setCatalog(all);
      }
    });
    return () => {
      mounted = false;
    };
  }, [outlet.id]);
  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );
  const onSaved = async () => {
    await refresh();
    onNotice?.("Outlet menu mapping updated.");
  };
  const remove = async (item) => {
    if (
      !window.confirm(`Remove ${item.name} from ${outlet.name}'s menu mapping?`)
    )
      return;
    await mockApi.removeMenuItemFromOutlet({
      outletId: outlet.id,
      itemId: item.id,
    });
    await refresh();
    onNotice?.(`${item.name} removed from this outlet mapping.`);
  };
  return (
    <section className="ad-panel ad-section-gap">
      <div className="ad-panel-header">
        <div>
          <h2>Outlet menu mapping</h2>
          <p>
            Only mapped items can be considered for this outlet's
            customer-facing menu. Unavailable mappings remain visible here.
          </p>
        </div>
        <button
          className="ad-button ad-button-primary"
          type="button"
          onClick={() => setAddOpen(true)}
        >
          <Plus size={15} /> Add menu items
        </button>
      </div>
      <div className="ad-filter-row">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Search mapped items…"
        />
        <span className="ad-panel-meta">
          {items.length} mapped ·{" "}
          {items.filter((item) => !item.mapping.available).length} unavailable
        </span>
      </div>
      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Food item</th>
              <th>Category / type</th>
              <th>Spice / allergens</th>
              <th>Portions / add-ons</th>
              <th>Effective price</th>
              <th>Availability</th>
              <th>Time menu</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="ad-menu-cell">
                    <img src={item.image} alt="" />
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.description}</small>
                    </span>
                  </div>
                </td>
                <td>
                  {item.category}
                  <small>{item.veg ? "Vegetarian" : "Non-vegetarian"}</small>
                </td>
                <td>
                  {item.spice}
                  <small>
                    {item.allergens.join(", ") || "No listed allergens"}
                  </small>
                </td>
                <td>
                  {item.portions.map((part) => part.name).join(", ")}
                  <small>
                    {item.addons.length
                      ? `${item.addonGroupName || "Add-ons"} (${item.addonsRequired ? "required" : "optional"}): ${item.addons.map((add) => add.name).join(", ")}`
                      : "No add-ons"}
                  </small>
                </td>
                <td>
                  <strong>{money(item.effectivePrice)}</strong>
                  <small>
                    {item.mapping.priceOverride == null
                      ? "Inherited price"
                      : "Outlet override"}
                  </small>
                </td>
                <td>
                  <StatusBadge
                    tone={item.mapping.available ? "success" : "warning"}
                  >
                    {item.mapping.available ? "Available" : "Unavailable"}
                  </StatusBadge>
                </td>
                <td>{item.mapping.timeMenu}</td>
                <td>
                  <div className="ad-row-actions">
                    <button
                      type="button"
                      className="ad-row-action"
                      title="Edit mapping"
                      onClick={() => setEditing(item)}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      className="ad-row-action ad-danger-action"
                      title="Remove mapping"
                      onClick={() => remove(item)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="ad-empty-inline">
            No mapped menu items match this search.
          </div>
        )}
      </div>
      <p className="ad-footnote">
        A catalog item being active centrally does not automatically map it to
        an outlet. Customer menu eligibility depends on both outlet mapping and
        availability.
      </p>
      {addOpen && (
        <AddItemsModal
          outlet={outlet}
          catalog={catalog}
          currentIds={items.map((item) => item.id)}
          onClose={() => setAddOpen(false)}
          onAssigned={async (count) => {
            await refresh();
            onNotice?.(`${count} catalog item(s) mapped to ${outlet.name}.`);
          }}
        />
      )}
      {editing && (
        <MappingEditor
          outlet={outlet}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </section>
  );
}
