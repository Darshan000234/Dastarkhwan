import { useEffect, useState } from "react";
import { Modal } from "../common/ManagerUI";
export default function PreparationTimeOverride({
  order,
  minimum,
  onClose,
  onSave,
}) {
  const [minutes, setMinutes] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (order) {
      setMinutes(
        String(Math.max(minimum, Number(order.prepMinutes || minimum))),
      );
      setReason("");
      setError("");
    }
  }, [order, minimum]);
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({ minutes: Number(minutes), reason });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={Boolean(order)}
      onClose={onClose}
      title={`Update estimate · ${order?.id}`}
    >
      <form className="om-form" onSubmit={submit}>
        <p className="om-form-note">
          This change affects this order only. The outlet minimum is {minimum}{" "}
          minutes.
        </p>
        <label>
          New preparation estimate (minutes)
          <input
            type="number"
            min={minimum}
            max="240"
            step="1"
            required
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </label>
        <label>
          Reason for adjustment
          <textarea
            rows="3"
            maxLength="180"
            required
            placeholder="e.g. Current kitchen workload is higher than usual"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        {error && <p className="om-form-error">{error}</p>}
        <div className="om-form-actions">
          <button type="button" className="om-button ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="om-button primary" disabled={saving}>
            {saving ? "Saving…" : "Save estimate"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
