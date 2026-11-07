import { ShoppingBag, UtensilsCrossed } from "lucide-react";
export default function EmptyState({
  title,
  description,
  action,
  onAction,
  icon = "food",
}) {
  const Icon = icon === "cart" ? ShoppingBag : UtensilsCrossed;
  return (
    <div className="cu-empty">
      <span>
        <Icon size={28} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && (
        <button className="cu-button" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}
