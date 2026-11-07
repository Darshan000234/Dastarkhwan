import { useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Field, Modal } from "../common/AdminUI";
import { mockApi } from "../../../services/mockApi";

export default function ManagerAssignmentModal({
  outlet,
  onClose,
  onAssigned,
}) {
  const [name, setName] = useState(outlet.manager?.name || "");
  const [phone, setPhone] = useState(outlet.manager?.phone || "");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("details");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const sendCode = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await mockApi.sendManagerOtp({ name, phone, outletId: outlet.id });
      setStep("verify");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await mockApi.verifyManagerOtp({ outletId: outlet.id, otp });
      setStep("confirm");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmAssignment = async () => {
    setError("");
    setBusy(true);
    try {
      await mockApi.verifyManagerOtpAndAssign({ outletId: outlet.id, otp });
      await onAssigned();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={
        outlet.manager ? "Replace Outlet Manager" : "Assign Outlet Manager"
      }
    >
      {step === "details" && (
        <form className="ad-form-grid" onSubmit={sendCode}>
          <p className="ad-modal-copy ad-span-2">
            Enter the manager's name and mobile number. Phone verification is
            required before the manager can be assigned to this outlet.
          </p>
          <Field label="Manager full name" className="ad-span-2">
            <input
              className="ad-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              required
            />
          </Field>
          <Field label="Mobile number (+91)" className="ad-span-2">
            <div className="ad-phone-field">
              <span>+91</span>
              <input
                className="ad-input"
                value={phone}
                onChange={(event) =>
                  setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))
                }
                maxLength={10}
                inputMode="numeric"
                placeholder="10-digit mobile number"
                required
              />
            </div>
          </Field>
          <div className="ad-demo-note ad-span-2">
            <ShieldCheck size={15} /> Development mode: the OTP is simulated. No
            SMS is sent. The demo code will be shown after you request it.
          </div>
          {error && <div className="ad-inline-error ad-span-2">{error}</div>}
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
        <form className="ad-form-grid" onSubmit={verifyCode}>
          <div className="ad-inline-success ad-span-2">
            <CheckCircle2 size={16} /> Demo OTP generated successfully. No real
            SMS was sent. Use <strong>246810</strong>.
          </div>
          <Field label="Enter 6-digit OTP" className="ad-span-2">
            <input
              className="ad-input ad-otp-wide"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="246810"
              required
            />
          </Field>
          {error && <div className="ad-inline-error ad-span-2">{error}</div>}
          <div className="ad-form-actions ad-span-2">
            <button
              type="button"
              className="ad-button ad-button-quiet"
              onClick={() => setStep("details")}
            >
              Back
            </button>
            <button
              type="submit"
              className="ad-button ad-button-primary"
              disabled={busy || otp.length !== 6}
            >
              {busy ? "Verifying…" : "Verify phone"}
            </button>
          </div>
        </form>
      )}

      {step === "confirm" && (
        <div className="ad-confirm-assignment">
          <div className="ad-inline-success">
            <CheckCircle2 size={17} /> Mobile number verified.
          </div>
          <div className="ad-confirm-person">
            <span className="ad-manager-large-avatar">
              <ShieldCheck size={22} />
            </span>
            <div>
              <strong>{name}</strong>
              <small>+91 {phone}</small>
              <small>Verified phone · {outlet.name}</small>
            </div>
          </div>
          <p className="ad-modal-copy">
            Confirm this person as the one designated Outlet Manager for{" "}
            {outlet.name}. Any existing manager assignment for this outlet will
            be replaced. Historical orders remain unchanged.
          </p>
          {error && <div className="ad-inline-error">{error}</div>}
          <div className="ad-form-actions">
            <button
              type="button"
              className="ad-button ad-button-quiet"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ad-button ad-button-primary"
              onClick={confirmAssignment}
              disabled={busy}
            >
              {busy ? "Assigning…" : "Confirm manager assignment"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
