import { Plus, SlidersHorizontal } from "lucide-react";
import FoodImage from "../common/FoodImage";
import { FoodTypeBadge, SpiceBadge } from "../common/Badges";
import { currency } from "../../../utils/customerPricing";

export default function FoodCard({ item, onCustomise }) {
  return (
    <article
      className={`cu-food-card ${item.mapping?.available ? "" : "is-unavailable"}`}
    >
      <button
        className="cu-food-image-button"
        onClick={() => onCustomise(item)}
        aria-label={`View ${item.name}`}
      >
        <FoodImage src={item.image} alt={item.name} />
      </button>
      <div className="cu-food-card-body">
        <div className="cu-food-card-meta">
          <FoodTypeBadge veg={item.veg} />
          <SpiceBadge level={item.spice} />
        </div>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <div className="cu-food-card-bottom">
          <strong>{currency(item.effectivePrice)}</strong>
          {item.mapping?.available ? (
            <button className="cu-add-button" onClick={() => onCustomise(item)}>
              <Plus size={15} /> Customise
            </button>
          ) : (
            <span
              className="cu-unavailable-label"
              title={item.availabilityReason || "Unavailable at this outlet"}
            >
              Currently unavailable
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
