import { useState } from "react";
import { Utensils } from "lucide-react";

export default function FoodImage({
  src,
  alt,
  className = "",
  loading = "lazy",
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed)
    return (
      <div
        className={`cu-food-fallback ${className}`}
        aria-label={alt || "Food image unavailable"}
      >
        <Utensils size={25} />
        <span>{alt || "Dastarkhwan special"}</span>
      </div>
    );
  return (
    <img
      className={className}
      src={src}
      alt={alt || "Dastarkhwan dish"}
      loading={loading}
      onError={() => setFailed(true)}
    />
  );
}
