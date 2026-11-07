import { Minus, Plus } from "lucide-react";
export default function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 20,
}) {
  return (
    <div className="cu-quantity">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="Decrease quantity"
      >
        <Minus size={13} />
      </button>
      <strong>{value}</strong>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label="Increase quantity"
        disabled={value >= max}
      >
        <Plus size={13} />
      </button>
    </div>
  );
}
