import { useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import { adminApi } from "../../../services/adminApi.js";
import { Field, Modal } from "../common/AdminUI";

export default function ManagerAssignmentModal({
  outlet,
  onClose,
  onAssigned,
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [expiresAt, setExpiresAt] = useState(null);
  const [step, setStep] = useState("details");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const sendCode = async (event) => {
    event.preventDefault();
    setError("");
    setDevOtp("");

    if (outlet.manager) {
      setError(
        "This outlet already has a manager. The registered backend OTP assignment operation only assigns to an unassigned outlet; it does not replace an existing manager.",
      );
      return;
    }

    setBusy(true);

    try {
      const result = await adminApi.sendManagerOtp({
        outletId: outlet.id,
        name: name.trim(),
        phone,
      });

      /*
       * Display a development OTP only when the backend actually
       * returned devOtp. Never insert or assume a demo OTP.
       */
      setDevOtp(result.devOtp || "");
      setExpiresAt(result.expiresAt || null);
      setStep("verify");
    } catch (err) {
      setError(err.message || "Unable to request manager OTP.");
    } finally {
      setBusy(false);
    }
  };

  const verifyAndAssign = async (event) => {
    event.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the six-digit OTP returned by the backend.");
      return;
    }

    setBusy(true);

    try {
      /*
       * One backend transaction verifies the OTP, creates the
       * manager account and assigns it to this outlet.
       */
      const result = await adminApi.verifyManagerOtpAndAssign({
        outletId: outlet.id,
        name: name.trim(),
        phone,
        otp,
      });

      await onAssigned?.(result);
      onClose();
    } catch (err) {
      setError(
        err.message ||
          "OTP verification or manager assignment failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Assign Outlet Manager"
    >
      {outlet.manager ? (
        <div className="ad-form-grid">
          <div className="ad-inline-warning ad-span-2">
            This outlet already has a manager. The registered backend
            OTP assignment endpoint rejects another assignment while
            `managerId` is set. No replacement or removal endpoint is
            registered in the current admin routes.
          </div>

          <div className="ad-detail-block ad-span-2">
            <span>Current manager</span>
            <strong>{outlet.manager.name}</strong>
            <small>{outlet.manager.phone}</small>
          </div>

          <div className="ad-form-actions ad-span-2">
            <button
              type="button"
              className="ad-button ad-button-quiet"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <>
          {step === "details" && (
            <form
              className="ad-form-grid"
              onSubmit={sendCode}
            >
              <p className="ad-modal-copy ad-span-2">
                Enter the manager's full name and mobile number.
                The backend checks the outlet, phone uniqueness,
                OTP request limits and OTP expiry.
              </p>

              <Field
                label="Manager full name"
                className="ad-span-2"
              >
                <input
                  className="ad-input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  minLength={2}
                  maxLength={120}
                  required
                />
              </Field>

              <Field
                label="Mobile number (+91)"
                className="ad-span-2"
              >
                <div className="ad-phone-field">
                  <span>+91</span>
                  <input
                    className="ad-input"
                    value={phone}
                    onChange={(event) =>
                      setPhone(
                        event.target.value
                          .replace(/\D/g, "")
                          .slice(0, 10),
                      )
                    }
                    maxLength={10}
                    inputMode="numeric"
                    placeholder="10-digit mobile number"
                    required
                  />
                </div>
              </Field>

              <div className="ad-demo-note ad-span-2">
                <ShieldCheck size={15} />
                The backend returns a development OTP only when
                running in development. Production OTP delivery
                requires an SMS provider.
              </div>

              {error && (
                <div className="ad-inline-error ad-span-2">
                  {error}
                </div>
              )}

              <div className="ad-form-actions ad-span-2">
                <button
                  type="button"
                  className="ad-button ad-button-quiet"
                  onClick={onClose}
                >
                  Cancel
                </button>

                <button
                  className="ad-button ad-button-primary"
                  type="submit"
                  disabled={busy}
                >
                  {busy ? "Requesting…" : "Send OTP"}
                </button>
              </div>
            </form>
          )}

          {step === "verify" && (
            <form
              className="ad-form-grid"
              onSubmit={verifyAndAssign}
            >
              <div className="ad-inline-success ad-span-2">
                <CheckCircle2 size={16} />
                OTP challenge created by the backend. No manager
                account has been created yet.
              </div>

              {devOtp && (
                <div className="ad-demo-note ad-span-2">
                  Development OTP returned by backend:{" "}
                  <strong>{devOtp}</strong>
                </div>
              )}

              {expiresAt && (
                <p className="ad-modal-copy ad-span-2">
                  OTP expiry:{" "}
                  {new Date(expiresAt).toLocaleString("en-IN")}
                </p>
              )}

              <Field
                label="Enter 6-digit OTP"
                className="ad-span-2"
              >
                <input
                  className="ad-input ad-otp-wide"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(event) =>
                    setOtp(
                      event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6),
                    )
                  }
                  placeholder="Enter OTP"
                  required
                />
              </Field>

              <p className="ad-modal-copy ad-span-2">
                Selecting Verify sends the OTP to the backend.
                Only a successful response creates and assigns
                the manager.
              </p>

              {error && (
                <div className="ad-inline-error ad-span-2">
                  {error}
                </div>
              )}

              <div className="ad-form-actions ad-span-2">
                <button
                  type="button"
                  className="ad-button ad-button-quiet"
                  onClick={() => {
                    setStep("details");
                    setOtp("");
                    setDevOtp("");
                    setError("");
                  }}
                  disabled={busy}
                >
                  Back
                </button>

                <button
                  type="submit"
                  className="ad-button ad-button-primary"
                  disabled={busy || otp.length !== 6}
                >
                  {busy ? "Verifying and assigning…" : "Verify and assign"}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </Modal>
  );
}