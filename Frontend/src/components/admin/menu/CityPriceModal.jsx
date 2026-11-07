import { useEffect, useState } from "react";
import { Field, Modal, money } from "../common/AdminUI";
import { mockApi } from "../../../services/mockApi";

export default function CityPriceModal({ item, outlets, onClose, onSaved }) {
  const cities = [...new Set(outlets.map((outlet) => outlet.city))];
  const [city, setCity] = useState(cities[0] || "Hyderabad");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setPrice(String(item.cityPrices?.[cities[0]] ?? item.basePrice));
  }, [item]);
  const save = async (event) => {
    event.preventDefault();
    setError("");
    if (!Number.isFinite(Number(price)) || Number(price) <= 0) {
      setError("Enter a valid positive city price.");
      return;
    }
    try {
      await mockApi.updateMenuItem(item.id, {
        cityPrices: { ...item.cityPrices, [city]: Number(price) },
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Modal open onClose={onClose} title={`City pricing · ${item.name}`}>
      <form className="ad-form-grid" onSubmit={save}>
        <div className="ad-detail-block ad-span-2">
          <span>Central default price</span>
          <strong>{money(item.basePrice)}</strong>
          <small>Outlet override takes precedence over the city price.</small>
        </div>
        <Field label="City" className="ad-span-2">
          <select
            className="ad-input"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setPrice(
                String(item.cityPrices?.[e.target.value] ?? item.basePrice),
              );
            }}
          >
            {cities.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <Field label={`${city} selling price (₹)`} className="ad-span-2">
          <input
            className="ad-input"
            type="number"
            min="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
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
          <button className="ad-button ad-button-primary">
            Save city price
          </button>
        </div>
      </form>
    </Modal>
  );
}
