import { useEffect, useState } from "react";
import { MapPin, X, Check, Store } from "lucide-react";

import { useCustomer } from "../../../context/CustomerContext";

export default function LocationModal({ open, onClose }) {
  const {
    selectedPincode,
    selectedOutletId,
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
    if (!open) return;

    setPincode(
      pendingLocation?.pincode || selectedPincode || "",
    );

    setError("");

    setHasChecked(
      Boolean(
        pendingLocation?.outlets?.length ||
          locationChoices?.length,
      ),
    );
  }, [
    open,
    selectedPincode,
    pendingLocation,
    locationChoices,
  ]);

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

      if (!result.serviceable) {
        setError(
          result.reason ||
            "No active outlet currently serves this pincode.",
        );
        return;
      }

      /*
       * A single eligible outlet may be selected automatically
       * by CustomerContext. Do not close when the context has
       * requested confirmation to clear an existing cart.
       */
      if (
        !result.requiresCartConfirmation &&
        result.outlets?.length === 1
      ) {
        onClose();
      }
    } catch (err) {
      setError(
        err.message || "Could not check this pincode.",
      );
    } finally {
      setBusy(false);
    }
  };

  const choices =
    pendingLocation?.outlets ||
    (hasChecked ? locationChoices : []);

  const selectOutlet = async (outletId) => {
    setError("");
    setBusy(true);

    try {
      const selected = await chooseOutlet(outletId);

      /*
       * chooseOutlet returns false when a cart-switch
       * confirmation is pending. Keep the modal open in
       * that case; CustomerLayout displays the confirmation.
       */
      if (selected === false) return;

      onClose();
    } catch (err) {
      setError(
        err.message || "Could not select this outlet.",
      );
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
        className="cu-modal cu-location-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cu-location-title"
      >
        <button
          className="cu-modal-close"
          onClick={onClose}
          aria-label="Close"
          type="button"
        >
          <X size={18} />
        </button>

        <div className="cu-modal-icon">
          <MapPin size={22} />
        </div>

        <span className="cu-eyebrow">DELIVERY LOCATION</span>

        <h2 id="cu-location-title">
          Where should we deliver?
        </h2>

        <p>
          Enter your pincode to find an active Dastarkhwan kitchen
          serving your area.
        </p>

        <form
          className="cu-pincode-form"
          onSubmit={check}
        >
          <label htmlFor="cu-pincode">
            6-digit delivery pincode
          </label>

          <div>
            <input
              id="cu-pincode"
              value={pincode}
              maxLength={6}
              inputMode="numeric"
              onChange={(event) => {
                setPincode(
                  event.target.value.replace(/\D/g, ""),
                );
                setHasChecked(false);
                setError("");
              }}
              placeholder="Enter pincode"
              autoFocus
            />

            <button
              className="cu-button"
              disabled={busy}
              type="submit"
            >
              {busy ? "Checking…" : "Check availability"}
            </button>
          </div>
        </form>

        {error && (
          <p className="cu-form-error">{error}</p>
        )}

        {choices.length > 0 && (
          <div className="cu-outlet-choices">
            <strong>
              {choices.length > 1
                ? "Choose an eligible outlet"
                : "Eligible outlet"}
            </strong>

            {choices.map((outlet) => (
              <button
                key={outlet.id}
                type="button"
                disabled={busy}
                className={
                  selectedOutletId === outlet.id
                    ? "is-selected"
                    : ""
                }
                onClick={() => selectOutlet(outlet.id)}
              >
                <span className="cu-choice-icon">
                  <Store size={17} />
                </span>

                <span>
                  <strong>{outlet.name}</strong>

                  <small>
                    {outlet.type || "Dastarkhwan outlet"}
                    {outlet.prepTime
                      ? ` · ${outlet.prepTime} min preparation`
                      : ""}
                  </small>
                </span>

                {selectedOutletId === outlet.id ? (
                  <Check size={17} />
                ) : null}
              </button>
            ))}
          </div>
        )}

        {hasChecked && !choices.length && !error && (
          <p className="cu-muted">
            No eligible outlet was returned for this pincode.
          </p>
        )}

        <div className="cu-demo-note">
          Outlet availability is checked against the current backend
          serviceability configuration.
        </div>
      </section>
    </div>
  );
}