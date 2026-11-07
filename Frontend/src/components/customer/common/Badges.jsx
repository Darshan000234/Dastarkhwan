export function FoodTypeBadge({ veg }) {
  return (
    <span
      className={`cu-food-type ${veg ? "is-veg" : "is-nonveg"}`}
      title={veg ? "Vegetarian" : "Non-vegetarian"}
    >
      <i />
      {veg ? "Veg" : "Non-veg"}
    </span>
  );
}
export function SpiceBadge({ level }) {
  if (!level || level === "None") return null;
  return (
    <span className="cu-spice">
      {level === "Hot" ? "🌶🌶" : level === "Medium" ? "🌶" : "Mild"}{" "}
      <small>{level}</small>
    </span>
  );
}
export function OrderStatusBadge({ status }) {
  const key = String(status || "Placed")
    .toLowerCase()
    .replaceAll(" ", "-");
  return <span className={`cu-status cu-status-${key}`}>{status}</span>;
}
