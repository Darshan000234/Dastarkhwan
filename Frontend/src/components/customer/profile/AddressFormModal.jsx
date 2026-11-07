import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useCustomer } from "../../../context/CustomerContext";
import {
  isPhone,
  isPincode,
  required,
} from "../../../utils/customerValidation";

const EMPTY = {
  name: "",
  phone: "",
  pincode: "",
  house: "",
  street: "",
  landmark: "",
  city: "Hyderabad",
  type: "Home",
  isDefault: false,
};
export default function AddressFormModal({ open, onClose, address = null }) {
  const {
    saveAddress,
    requestLocation,
    selectedOutletId,
    cart,
    selectedPincode,
    profile,
  } = useCustomer();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setForm(
        address
          ? { ...EMPTY, ...address }
          : {
              ...EMPTY,
              name: profile?.name || "",
              phone: profile?.phone || "",
              pincode: selectedPincode || "",
            },
      );
      setError("");
    }
  }, [open, address]);
  if (!open) return null;
  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (
      !required(form.name) ||
      !required(form.house) ||
      !required(form.street) ||
      !required(form.city)
    ) {
      setError("Complete all required address fields.");
      return;
    }
    if (!isPhone(form.phone)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (!isPincode(form.pincode)) {
      setError("Enter a valid six-digit pincode.");
      return;
    }
    setBusy(true);
    try {
      await saveAddress(form, address?.id);
      if (form.pincode && form.pincode !== selectedPincode)
        await requestLocation(form.pincode);
      onClose();
    } catch (err) {
      setError(err.message || "Could not save this address.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="cu-overlay"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="cu-modal cu-address-modal">
        <button className="cu-modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <span className="cu-eyebrow">DELIVERY DETAILS</span>
        <h2>{address ? "Edit address" : "Add a new address"}</h2>
        <form className="cu-form-grid" onSubmit={submit}>
          <label>
            Full name *
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </label>
          <label>
            Mobile number *
            <input
              value={form.phone}
              maxLength={10}
              inputMode="numeric"
              onChange={(e) => set("phone", e.target.value.replace(/\D/g, ""))}
              required
            />
          </label>
          <label className="cu-form-span">
            House / flat number *
            <input
              value={form.house}
              onChange={(e) => set("house", e.target.value)}
              required
            />
          </label>
          <label className="cu-form-span">
            Street / locality *
            <input
              value={form.street}
              onChange={(e) => set("street", e.target.value)}
              required
            />
          </label>
          <label>
            Landmark
            <input
              value={form.landmark}
              onChange={(e) => set("landmark", e.target.value)}
              placeholder="Optional"
            />
          </label>
          <label>
            Pincode *
            <input
              value={form.pincode}
              maxLength={6}
              inputMode="numeric"
              onChange={(e) =>
                set("pincode", e.target.value.replace(/\D/g, ""))
              }
              required
            />
          </label>
          <label>
            City *
            <input
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              required
            />
          </label>
          <label>
            Address type
            <select
              value={form.type}
              onChange={(e) => set("type", e.target.value)}
            >
              <option>Home</option>
              <option>Work</option>
              <option>Other</option>
            </select>
          </label>
          <label className="cu-checkbox cu-form-span">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => set("isDefault", e.target.checked)}
            />{" "}
            Set as default address
          </label>
          {error && <p className="cu-form-error cu-form-span">{error}</p>}
          <div className="cu-form-actions cu-form-span">
            <button
              type="button"
              className="cu-button-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="cu-button" disabled={busy}>
              {busy ? "Saving…" : "Save address"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
