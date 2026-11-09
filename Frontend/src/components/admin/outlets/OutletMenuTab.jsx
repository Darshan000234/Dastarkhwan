import { useEffect, useState } from "react";
import { Plus, Trash2, Edit3 } from "lucide-react";
import { adminApi } from "../../../services/adminApi.js";
import { Modal, Field, SearchBox, StatusBadge, money } from "../common/AdminUI";

const ALL_DAY_MENU = "All Day";

function getCurrentIST() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function getItemAvailability(item, outletId, schedules) {
  const mapping = item.mapping || {};

  if (!(mapping.available ?? mapping.isAvailable)) {
    return {
      orderable: false,
      label: "Disabled",
      detail: "Disabled for this outlet",
    };
  }

  const stock = Number(mapping.stockQuantity ?? mapping.stockQty ?? 0);

  if (!Number.isFinite(stock) || stock <= 0) {
    return {
      orderable: false,
      label: "Out of stock",
      detail: "Stock quantity is zero",
    };
  }

  const label = String(
    mapping.timeMenuLabel ?? mapping.timeMenu ?? ALL_DAY_MENU,
  ).trim();

  if (!label || label.toLowerCase() === "all day") {
    return {
      orderable: true,
      label: "Orderable",
      detail: "Available throughout the day",
    };
  }

  const matchingSchedules = schedules.filter(
    (schedule) =>
      schedule.isActive &&
      schedule.name === label &&
      schedule.outletIds?.includes(outletId) &&
      schedule.itemIds?.includes(item.id),
  );

  if (!matchingSchedules.length) {
    return {
      orderable: false,
      label: "Schedule missing",
      detail: "No matching active schedule contains this item",
    };
  }

  const now = getCurrentIST();
  const currentMinutes = Number(now.hour) * 60 + Number(now.minute);

  const orderable = matchingSchedules.some((schedule) => {
    if (!schedule.days?.includes(now.weekday)) {
      return false;
    }

    const [startHour, startMinute] = schedule.startTime.split(":").map(Number);

    const [endHour, endMinute] = schedule.endTime.split(":").map(Number);

    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;

    return start <= end
      ? currentMinutes >= start && currentMinutes < end
      : currentMinutes >= start || currentMinutes < end;
  });

  return {
    orderable,
    label: orderable ? "Orderable" : "Outside schedule",
    detail: orderable
      ? `Available under ${label}`
      : `Not currently within ${label} service hours`,
  };
}

function AddItemsModal({
  outlet,
  catalog,
  currentIds,
  schedules,
  onClose,
  onAssigned,
  onPartialChange,
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [scheduleId, setScheduleId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const available = catalog.filter(
    (item) => item.active && !currentIds.includes(item.id),
  );

  // Only extend active schedules assigned exclusively to this outlet.
  // Extending a shared schedule could affect other outlets.
  const availableSchedules = schedules.filter(
    (schedule) =>
      schedule.isActive &&
      schedule.outletIds?.length === 1 &&
      schedule.outletIds[0] === outlet.id,
  );

  const selectedSchedule = availableSchedules.find(
    (schedule) => schedule.id === scheduleId,
  );

  const toggle = (id) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (busy) return;

    if (!selectedIds.length) {
      setError("Select at least one central catalog item.");
      return;
    }

    setBusy(true);

    const mappedIds = [];
    let stage = "mapping items";

    try {
      // Step 1: Create outlet mappings.
      // Initially assign All Day. The actual schedule is connected
      // only after the selected schedule accepts these item IDs.
      for (const id of selectedIds) {
        await adminApi.assignMenuItemToOutlet({
          itemId: id,
          outletIds: [outlet.id],
          timeMenu: ALL_DAY_MENU,
        });

        mappedIds.push(id);
      }

      if (selectedSchedule) {
        // Step 2: Add these newly mapped items to the configured
        // schedule. Backend validates that all items are mapped.
        stage = "updating the configured schedule";

        const updatedItemIds = [
          ...new Set([...(selectedSchedule.itemIds || []), ...selectedIds]),
        ];

        await adminApi.saveTimeMenu({
          ...selectedSchedule,
          itemIds: updatedItemIds,
        });

        // Step 3: Set each mapping label to the actual schedule name.
        stage = "connecting item mappings to the schedule";

        for (const id of selectedIds) {
          await adminApi.updateOutletMenuItem({
            outletId: outlet.id,
            itemId: id,
            timeMenuLabel: selectedSchedule.name,
          });
        }
      }

      await onAssigned(
        selectedIds.length,
        selectedSchedule?.name || ALL_DAY_MENU,
      );

      onClose();
    } catch (err) {
      // Some mappings may already have been saved.
      // Refresh the parent so the user sees the actual backend state.
      if (mappedIds.length) {
        try {
          await onPartialChange?.(mappedIds.length);
        } catch {
          // Preserve the original operation error.
        }
      }

      const resultMessage = mappedIds.length
        ? `${mappedIds.length} of ${selectedIds.length} item(s) were mapped, but ${stage} failed.`
        : "No items were successfully mapped.";

      setError(`${resultMessage} ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title={`Add menu items · ${outlet.name}`}
      wide
    >
      <form className="ad-form-grid" onSubmit={submit}>
        <p className="ad-modal-copy ad-span-2">
          Choose central catalog entries to map to this outlet. Unmapped items
          remain excluded from its customer menu.
        </p>

        <div className="ad-catalog-pick-list ad-span-2">
          {available.length ? (
            available.map((item) => (
              <label key={item.id} className="ad-catalog-pick">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  disabled={busy}
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

        <Field label="Configured time-based menu" className="ad-span-2">
          <select
            className="ad-input"
            value={scheduleId}
            disabled={busy}
            onChange={(e) => setScheduleId(e.target.value)}
          >
            <option value="">All Day</option>

            {availableSchedules.map((schedule) => (
              <option key={schedule.id} value={schedule.id}>
                {schedule.name} · {schedule.startTime}–{schedule.endTime}
              </option>
            ))}
          </select>
        </Field>

        <p className="ad-modal-copy ad-span-2">
          Only active schedules assigned exclusively to this outlet can be
          extended here. Shared schedules should be managed through Time Based
          Menus.
        </p>

        {error && <div className="ad-inline-error ad-span-2">{error}</div>}

        <div className="ad-form-actions ad-span-2">
          <button
            type="button"
            className="ad-button ad-button-quiet"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="ad-button ad-button-primary"
            disabled={busy || !selectedIds.length}
          >
            {busy
              ? "Mapping items..."
              : `Map ${selectedIds.length || "selected"} item(s)`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MappingEditor({ outlet, item, schedules, onClose, onSaved }) {
  const matchingSchedules = schedules.filter(
    (schedule) =>
      schedule.isActive &&
      schedule.outletIds?.includes(outlet.id) &&
      schedule.itemIds?.includes(item.id),
  );

  const currentLabel =
    item.mapping.timeMenuLabel || item.mapping.timeMenu || ALL_DAY_MENU;

  const currentSchedule = matchingSchedules.find(
    (schedule) => schedule.name === currentLabel,
  );

  const [override, setOverride] = useState(item.mapping.priceOverride ?? "");

  const [available, setAvailable] = useState(Boolean(item.mapping.available));

  const [stockQuantity, setStockQuantity] = useState(
    String(item.mapping.stockQuantity ?? item.mapping.stockQty ?? 0),
  );

  const [scheduleId, setScheduleId] = useState(currentSchedule?.id || "");

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (event) => {
    event.preventDefault();
    setError("");

    if (busy) return;

    if (
      override !== "" &&
      (!Number.isFinite(Number(override)) || Number(override) < 0)
    ) {
      setError("Enter a valid non-negative outlet price.");
      return;
    }

    const stock = Number(stockQuantity);

    if (!Number.isSafeInteger(stock) || stock < 0 || stock > 1000000) {
      setError("Stock must be a whole number between 0 and 1000000.");
      return;
    }

    const selectedSchedule = matchingSchedules.find(
      (schedule) => schedule.id === scheduleId,
    );

    setBusy(true);

    try {
      await adminApi.updateOutletMenuItem({
        outletId: outlet.id,
        itemId: item.id,
        available,
        stockQuantity: stock,
        priceOverride: override === "" ? null : Number(override),
        timeMenuLabel: selectedSchedule?.name || ALL_DAY_MENU,
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
    <Modal
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title={`Edit mapping · ${item.name}`}
    >
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
            min="0"
            step="0.01"
            value={override}
            disabled={busy}
            onChange={(e) => setOverride(e.target.value)}
            placeholder="Use inherited price"
          />
        </Field>

        <Field
          label="Stock quantity"
          className="ad-span-2"
          hint="An item with zero stock cannot be ordered."
        >
          <input
            className="ad-input"
            type="number"
            min="0"
            max="1000000"
            step="1"
            value={stockQuantity}
            disabled={busy}
            onChange={(e) => setStockQuantity(e.target.value)}
          />
        </Field>

        <Field label="Configured time-based menu" className="ad-span-2">
          <select
            className="ad-input"
            value={scheduleId}
            disabled={busy}
            onChange={(e) => setScheduleId(e.target.value)}
          >
            <option value="">All Day</option>

            {matchingSchedules.map((schedule) => (
              <option key={schedule.id} value={schedule.id}>
                {schedule.name} · {schedule.startTime}–{schedule.endTime}
              </option>
            ))}
          </select>
        </Field>

        {!currentSchedule && currentLabel.toLowerCase() !== "all day" && (
          <div className="ad-inline-error ad-span-2">
            The current mapping label does not match an active, configured
            schedule for this item and outlet. Select All Day or a valid
            configured schedule.
          </div>
        )}

        <label className="ad-check-label ad-span-2">
          <input
            type="checkbox"
            checked={available}
            disabled={busy}
            onChange={(e) => setAvailable(e.target.checked)}
          />{" "}
          Enable this item at the outlet
        </label>

        {error && <div className="ad-inline-error ad-span-2">{error}</div>}

        <div className="ad-form-actions ad-span-2">
          <button
            type="button"
            className="ad-button ad-button-quiet"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="ad-button ad-button-primary"
            disabled={busy}
          >
            {busy ? "Saving..." : "Save mapping"}
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
  const [schedules, setSchedules] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const [mapped, all, configuredSchedules] = await Promise.all([
      adminApi.getOutletMenu(outlet.id),
      adminApi.getMenuCatalog(),
      adminApi.getTimeMenus({ outletId: outlet.id }),
    ]);

    setItems(mapped);
    setCatalog(all);
    setSchedules(configuredSchedules);
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const [mapped, all, configuredSchedules] = await Promise.all([
          adminApi.getOutletMenu(outlet.id),
          adminApi.getMenuCatalog(),
          adminApi.getTimeMenus({ outletId: outlet.id }),
        ]);

        if (!mounted) return;

        setItems(mapped);
        setCatalog(all);
        setSchedules(configuredSchedules);
      } catch (err) {
        if (mounted) {
          setLoadError(err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [outlet.id]);

  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );
  const unavailableCount = items.filter(
    (item) => !getItemAvailability(item, outlet.id, schedules).orderable,
  ).length;
  const onSaved = async () => {
    await refresh();
    onNotice?.("Outlet menu mapping updated.");
  };

  const remove = async (item) => {
    if (
      !window.confirm(`Remove ${item.name} from ${outlet.name}'s menu mapping?`)
    ) {
      return;
    }

    setActionError("");

    try {
      await adminApi.removeMenuItemFromOutlet({
        outletId: outlet.id,
        itemId: item.id,
      });

      await refresh();

      onNotice?.(`${item.name} removed from this outlet mapping.`);
    } catch (err) {
      setActionError(err.message);
    }
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
          {items.length} mapped · {unavailableCount} not orderable
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
              <th>Stock</th>
              <th>Orderability</th>
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
                  <strong>
                    {Number(
                      item.mapping.stockQuantity ?? item.mapping.stockQty ?? 0,
                    )}
                  </strong>
                  <small>Units in stock</small>
                </td>
                <td>
                  {(() => {
                    const state = getItemAvailability(
                      item,
                      outlet.id,
                      schedules,
                    );

                    return (
                      <>
                        <StatusBadge
                          tone={state.orderable ? "success" : "warning"}
                        >
                          {state.label}
                        </StatusBadge>

                        <small>{state.detail}</small>
                      </>
                    );
                  })()}
                </td>
                <td>
                  {item.mapping.timeMenuLabel ||
                    item.mapping.timeMenu ||
                    ALL_DAY_MENU}
                </td>
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
    schedules={schedules}
    currentIds={items.map((item) => item.id)}
    onClose={() => setAddOpen(false)}
    onAssigned={async (count, scheduleName) => {
      await refresh();

      onNotice?.(
        `${count} item(s) mapped to ${outlet.name} using ${scheduleName}.`,
      );
    }}
    onPartialChange={async (count) => {
      await refresh();

      onNotice?.(
        `${count} item(s) were saved before the remaining operation failed. Review the menu mappings.`,
      );
    }}
  />
)}
     <MappingEditor
  outlet={outlet}
  item={editing}
  schedules={schedules}
  onClose={() => setEditing(null)}
  onSaved={onSaved}
/>
    </section>
  );
}
