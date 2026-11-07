import { useEffect, useState } from "react";
import { MapPin, X, Check, Store } from "lucide-react";
import { useCustomer } from "../../../context/CustomerContext";

export default function LocationModal({ open, onClose }) {
  const {
    selectedPincode,
    selectedOutletId,
    outlets,
    requestLocation,
    chooseOutlet,
    locationChoices,
    pendingLocation,
  } = useCustomer();
  const [pincode, setPincode] = useState(selectedPincode || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  useEffect(() => {
    if (open) {
      setPincode(pendingLocation?.pincode || selectedPincode || "");
      setHasChecked(
        Boolean(pendingLocation?.outlets?.length || locationChoices?.length),
      );
    }
  }, [open, selectedPincode, pendingLocation, locationChoices]);
  if (!open) return null;
  const check = async (event) => {
    event.preventDefault();
    setError("");
    if (!/^[1-9]\d{5}$/.test(pincode)) {
      setError("Enter a valid six-digit Indian pincode.");
      return;
    }
    setBusy(true);
    setHasChecked(true);
    try {
      const result = await requestLocation(pincode);
      if (!result.serviceable) setError(result.reason);
      else if (!result.requiresCartConfirmation && result.outlets.length === 1)
        onClose();
    } catch (err) {
      setError(err.message || "Could not check this pincode.");
    } finally {
      setBusy(false);
    }
  };
  const choices =
    pendingLocation?.outlets || (hasChecked ? locationChoices : []);
  return (
    <div
      className="cu-overlay"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="cu-modal cu-location-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cu-location-title"
      >
        <button className="cu-modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <div className="cu-modal-icon">
          <MapPin size={22} />
        </div>
        <span className="cu-eyebrow">DELIVERY LOCATION</span>
        <h2 id="cu-location-title">Where should we deliver?</h2>
        <p>
          Enter your pincode to find an active Dastarkhwan kitchen serving your
          area.
        </p>
        <form className="cu-pincode-form" onSubmit={check}>
          <label htmlFor="cu-pincode">6-digit delivery pincode</label>
          <div>
            <input
              id="cu-pincode"
              value={pincode}
              maxLength={6}
              inputMode="numeric"
              onChange={(event) => {
                setPincode(event.target.value.replace(/\D/g, ""));
                setHasChecked(false);
              }}
              placeholder="e.g. 500084"
              autoFocus
            />
            <button className="cu-button" disabled={busy}>
              {busy ? "Checking…" : "Check availability"}
            </button>
          </div>
        </form>
        {error && <p className="cu-form-error">{error}</p>}
        {choices.length > 1 && (
          <div className="cu-outlet-choices">
            <strong>Choose an eligible outlet</strong>
            {choices.map((outlet) => (
              <button
                key={outlet.id}
                className={selectedOutletId === outlet.id ? "is-selected" : ""}
                onClick={async () => {
                  await chooseOutlet(outlet.id);
                  onClose();
                }}
              >
                <span className="cu-choice-icon">
                  <Store size={17} />
                </span>
                <span>
                  <strong>{outlet.name}</strong>
                  <small>
                    {outlet.type} · {outlet.prepTime} min preparation
                  </small>
                </span>
                {selectedOutletId === outlet.id ? <Check size={17} /> : null}
              </button>
            ))}
          </div>
        )}
        <div className="cu-demo-note">
          Demo service areas: 500084 Kondapur · 500032 Gachibowli · 500072
          Kukatpally. Coverage is illustrative and depends on outlet activation
          in the Central Admin Dashboard.
        </div>
        {outlets.some(
          (outlet) => !outlet.active && outlet.pincodes?.includes(pincode),
        ) && (
          <small className="cu-inactive-note">
            An outlet is configured for this pincode but is currently inactive.
            It cannot accept online orders.
          </small>
        )}
      </section>
    </div>
  );
}
