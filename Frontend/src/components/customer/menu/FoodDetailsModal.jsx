import { useMemo, useState } from "react";
import {
  X,
  Clock3,
  AlertCircle,
  Plus,
  Minus,
  ShoppingBag,
} from "lucide-react";

import FoodImage from "../common/FoodImage";
import { FoodTypeBadge, SpiceBadge } from "../common/Badges";

import { useCustomer } from "../../../context/CustomerContext";
import { currency } from "../../../utils/customerPricing";

export default function FoodDetailsModal({ item, onClose }) {
  const {
    addToCart,
    selectedOutletId,
    notify,
  } = useCustomer();

  const [portionId, setPortionId] = useState(
    item?.portions?.[0]?.id || "",
  );

  const [selectedAddons, setSelectedAddons] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);

  if (!item) return null;

  const portion =
    item.portions?.find((entry) => entry.id === portionId) ||
    item.portions?.[0] ||
    null;

  const addonGroups =
    item.addonGroups?.length
      ? item.addonGroups
      : item.addons?.length
        ? [
            {
              id: "default",
              name: "Add-ons",
              isRequired: Boolean(item.addonsRequired),
              minSelect: item.addonsRequired ? 1 : 0,
              maxSelect: item.addons.length,
              options: item.addons,
            },
          ]
        : [];

  const addonsTotal = selectedAddons.reduce(
    (sum, addon) => sum + Number(addon.price || 0),
    0,
  );

  /*
   * Backend portion prices already include the outlet price
   * adjustment. Do not add the outlet offset a second time.
   */
  const unitPrice = useMemo(
    () =>
      Number(portion?.price ?? item.effectivePrice ?? 0) +
      addonsTotal,
    [portion, item.effectivePrice, addonsTotal],
  );

  const requiredGroupsSatisfied = addonGroups.every((group) => {
    const count = selectedAddons.filter(
      (addon) => addon.groupId === group.id,
    ).length;

    const minimum = Math.max(
      Number(group.minSelect || 0),
      group.isRequired ? 1 : 0,
    );

    return (
      count >= minimum &&
      count <= Number(group.maxSelect ?? 20)
    );
  });

  const toggleAddon = (group, option) => {
    setSelectedAddons((current) => {
      const alreadySelected = current.some(
        (entry) => entry.id === option.id,
      );

      if (alreadySelected) {
        return current.filter(
          (entry) => entry.id !== option.id,
        );
      }

      const groupSelections = current.filter(
        (entry) => entry.groupId === group.id,
      ).length;

      const max = Number(group.maxSelect ?? 20);

      if (groupSelections >= max) {
        notify(
          `Choose at most ${max} options for ${group.name}.`,
          "error",
        );

        return current;
      }

      return [
        ...current,
        {
          id: option.id,
          name: option.name,
          price: Number(option.price || 0),
          groupId: group.id,
          groupName: group.name,
        },
      ];
    });
  };

  const submit = async () => {
    if (!portion && item.portions?.length) {
      notify("Choose a valid portion.", "error");
      return;
    }

    if (!requiredGroupsSatisfied) {
      notify("Complete the required add-on selections.", "error");
      return;
    }

    setBusy(true);

    try {
      const success = await addToCart({
        itemId: item.id,
        outletId: selectedOutletId,

        name: item.name,
        image: item.image,
        category: item.category,

        portion: portion?.name || null,
        portionId: portion?.id || null,

        addons: selectedAddons.map((addon) => ({
          id: addon.id,
          name: addon.name,
          price: addon.price,
        })),

        quantity,
        unitPrice,
        veg: item.veg,
      });

      if (success) {
        onClose();

        window.dispatchEvent(
          new Event("dastarkhwan:open-cart"),
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="cu-overlay"
      onMouseDown={(event) =>
        event.target === event.currentTarget && onClose()
      }
    >
      <section
        className="cu-modal cu-food-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${item.name} details`}
      >
        <button
          className="cu-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="cu-food-modal-grid">
          <div className="cu-food-modal-photo">
            <FoodImage
              src={item.image}
              alt={item.name}
              loading="eager"
            />
          </div>

          <div className="cu-food-modal-content">
            <div className="cu-food-card-meta">
              <FoodTypeBadge veg={item.veg} />
              <SpiceBadge level={item.spice} />
            </div>

            <span className="cu-eyebrow">
              {item.category}
            </span>

            <h2>{item.name}</h2>

            <p>{item.description}</p>

            <div className="cu-food-info-row">
              <span>
                <Clock3 size={14} />
                {item.prepTime} min prep
              </span>

              {item.allergens?.length > 0 && (
                <span>
                  <AlertCircle size={14} />
                  Contains {item.allergens.join(", ")}
                </span>
              )}
            </div>

            {item.portions?.length > 0 && (
              <div className="cu-customise-section">
                <strong>Choose your portion</strong>

                <div className="cu-choice-pills">
                  {item.portions.map((entry) => (
                    <button
                      key={entry.id}
                      className={
                        portionId === entry.id ? "is-active" : ""
                      }
                      onClick={() => setPortionId(entry.id)}
                    >
                      {entry.name}

                      <small>
                        {currency(entry.price)}
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {addonGroups.map((group) => (
              <div
                className="cu-customise-section"
                key={group.id}
              >
                <strong>
                  {group.name}{" "}
                  <small>
                    {group.isRequired || group.minSelect > 0
                      ? `Choose at least ${Math.max(
                          Number(group.minSelect || 0),
                          group.isRequired ? 1 : 0,
                        )}`
                      : "Optional"}
                  </small>
                </strong>

                <div className="cu-addon-list">
                  {(group.options || []).map((option) => (
                    <label key={option.id}>
                      <input
                        type="checkbox"
                        checked={selectedAddons.some(
                          (entry) => entry.id === option.id,
                        )}
                        onChange={() => toggleAddon(group, option)}
                      />

                      <span>{option.name}</span>

                      <small>
                        +{currency(option.price)}
                      </small>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            {item.mapping?.available ? (
              <div className="cu-food-modal-footer">
                <div className="cu-quantity">
                  <button
                    onClick={() =>
                      setQuantity((value) =>
                        Math.max(1, value - 1),
                      )
                    }
                    aria-label="Decrease quantity"
                  >
                    <Minus size={14} />
                  </button>

                  <strong>{quantity}</strong>

                  <button
                    onClick={() =>
                      setQuantity((value) =>
                        Math.min(20, value + 1),
                      )
                    }
                    aria-label="Increase quantity"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <button
                  className="cu-button"
                  disabled={busy || !requiredGroupsSatisfied}
                  onClick={submit}
                >
                  <ShoppingBag size={16} />
                  Add · {currency(unitPrice * quantity)}
                </button>
              </div>
            ) : (
              <div className="cu-unavailable-box">
                {item.availabilityReason ||
                  "Currently unavailable at this outlet."}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}