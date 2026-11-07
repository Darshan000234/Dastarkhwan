import { useState } from "react";
import { MapPin, Plus, Star, Trash2, Pencil, CheckCircle2 } from "lucide-react";
import { useCustomer } from "../../../context/CustomerContext";
import AddressFormModal from "./AddressFormModal";
import EmptyState from "../common/EmptyState";

export default function AddressBookPage() {
  const {
    addresses,
    setDefaultAddress,
    deleteAddress,
    selectAddress,
    selectedAddressId,
    notify,
  } = useCustomer();
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const remove = async (address) => {
    if (!window.confirm(`Remove ${address.type} address?`)) return;
    try {
      await deleteAddress(address.id);
    } catch (error) {
      notify(error.message, "error");
    }
  };
  return (
    <div className="cu-page">
      <div className="cu-page-heading">
        <div>
          <span className="cu-eyebrow">DELIVERY DESTINATIONS</span>
          <h1>Saved addresses</h1>
          <p>Your selected address determines which outlet can serve you.</p>
        </div>
        <button
          className="cu-button"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus size={16} /> Add address
        </button>
      </div>
      {addresses.length ? (
        <div className="cu-address-grid">
          {addresses.map((address) => (
            <article
              className={`cu-saved-address ${selectedAddressId === address.id ? "is-selected" : ""}`}
              key={address.id}
            >
              <div className="cu-saved-address-top">
                <span>
                  <MapPin size={18} />
                </span>
                {address.isDefault && (
                  <em>
                    <Star size={12} /> DEFAULT
                  </em>
                )}
              </div>
              <h2>{address.type}</h2>
              <strong>{address.name}</strong>
              <p>
                {address.house}, {address.street}
                {address.landmark ? `, ${address.landmark}` : ""},{" "}
                {address.city} — {address.pincode}
              </p>
              <small>{address.phone}</small>
              <div className="cu-address-actions">
                <button
                  className="cu-button-secondary"
                  onClick={() => selectAddress(address.id)}
                >
                  {selectedAddressId === address.id ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <MapPin size={14} />
                  )}
                  {selectedAddressId === address.id
                    ? "Selected"
                    : "Deliver here"}
                </button>
                <button
                  onClick={() => setDefaultAddress(address.id)}
                  aria-label="Set default"
                >
                  <Star size={15} />
                </button>
                <button
                  onClick={() => {
                    setEditing(address);
                    setOpen(true);
                  }}
                  aria-label="Edit address"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => remove(address)}
                  aria-label="Remove address"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No saved addresses"
          description="Save an address for faster checkout."
          action="Add an address"
          onAction={() => setOpen(true)}
        />
      )}
      <AddressFormModal
        open={open}
        address={editing}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
