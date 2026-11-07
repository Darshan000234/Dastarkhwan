import { useMemo, useState } from "react";
import { X, Clock3, AlertCircle, Plus, Minus, ShoppingBag } from "lucide-react";
import FoodImage from "../common/FoodImage";
import { FoodTypeBadge, SpiceBadge } from "../common/Badges";
import { useCustomer } from "../../../context/CustomerContext";
import { getPortionPrice, currency } from "../../../utils/customerPricing";

export default function FoodDetailsModal({ item, onClose }) {
  const { addToCart, selectedOutletId } = useCustomer();
  const [portionName, setPortionName] = useState(
    item?.portions?.[0]?.name || "Regular",
  );
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const portion =
    item?.portions?.find((entry) => entry.name === portionName) ||
    item?.portions?.[0];
  const addonsTotal = selectedAddons.reduce(
    (sum, addon) => sum + Number(addon.price || 0),
    0,
  );
  const unitPrice = useMemo(
    () => getPortionPrice(item, portion, item?.effectivePrice) + addonsTotal,
    [item, portion, addonsTotal],
  );
  if (!item) return null;
  const toggleAddon = (addon) =>
    setSelectedAddons((rows) =>
      rows.some((entry) => entry.name === addon.name)
        ? rows.filter((entry) => entry.name !== addon.name)
        : [...rows, addon],
    );
  return (
    <div
      className="cu-overlay"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="cu-modal cu-food-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${item.name} details`}
      >
        <button className="cu-modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <div className="cu-food-modal-grid">
          <div className="cu-food-modal-photo">
            <FoodImage src={item.image} alt={item.name} loading="eager" />
          </div>
          <div className="cu-food-modal-content">
            <div className="cu-food-card-meta">
              <FoodTypeBadge veg={item.veg} />
              <SpiceBadge level={item.spice} />
            </div>
            <span className="cu-eyebrow">{item.category}</span>
            <h2>{item.name}</h2>
            <p>{item.description}</p>
            <div className="cu-food-info-row">
              <span>
                <Clock3 size={14} /> {item.prepTime} min prep
              </span>
              {item.allergens?.length > 0 && (
                <span>
                  <AlertCircle size={14} /> Contains {item.allergens.join(", ")}
                </span>
              )}
            </div>
            <div className="cu-customise-section">
              <strong>Choose your portion</strong>
              <div className="cu-choice-pills">
                {(item.portions || []).map((entry) => (
                  <button
                    key={entry.name}
                    className={portionName === entry.name ? "is-active" : ""}
                    onClick={() => setPortionName(entry.name)}
                  >
                    {entry.name}
                    <small>
                      {currency(
                        getPortionPrice(item, entry, item.effectivePrice),
                      )}
                    </small>
                  </button>
                ))}
              </div>
            </div>
            {item.addons?.length > 0 && (
              <div className="cu-customise-section">
                <strong>
                  Add something extra{" "}
                  <small>
                    {item.addonsRequired ? "Choose at least one" : "Optional"}
                  </small>
                </strong>
                <div className="cu-addon-list">
                  {item.addons.map((addon) => (
                    <label key={addon.name}>
                      <input
                        type="checkbox"
                        checked={selectedAddons.some(
                          (entry) => entry.name === addon.name,
                        )}
                        onChange={() => toggleAddon(addon)}
                      />
                      <span>{addon.name}</span>
                      <small>+{currency(addon.price)}</small>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {item.mapping?.available ? (
              <div className="cu-food-modal-footer">
                <div className="cu-quantity">
                  <button
                    onClick={() => setQuantity((v) => Math.max(1, v - 1))}
                    aria-label="Decrease quantity"
                  >
                    <Minus size={14} />
                  </button>
                  <strong>{quantity}</strong>
                  <button
                    onClick={() => setQuantity((v) => Math.min(20, v + 1))}
                    aria-label="Increase quantity"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <button
                  className="cu-button"
                  disabled={
                    busy ||
                    Boolean(item.addonsRequired && selectedAddons.length === 0)
                  }
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const ok = await addToCart({
                        itemId: item.id,
                        outletId: selectedOutletId,
                        name: item.name,
                        image: item.image,
                        category: item.category,
                        portion: portion.name,
                        addons: selectedAddons.map((entry) => ({
                          name: entry.name,
                          price: Number(entry.price),
                        })),
                        quantity,
                        unitPrice,
                        veg: item.veg,
                      });
                      if (ok) {
                        onClose();
                        window.dispatchEvent(
                          new Event("dastarkhwan:open-cart"),
                        );
                      }
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <ShoppingBag size={16} /> Add ·{" "}
                  {currency(unitPrice * quantity)}
                </button>
              </div>
            ) : (
              <div className="cu-unavailable-box">
                Currently unavailable at this outlet
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
