import { useEffect } from "react";
import { AlertTriangle, ChevronDown, Search, X } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  breadcrumb,
}) {
  return (
    <div className="ad-page-header">
      <div>
        {breadcrumb && <div className="ad-breadcrumb">{breadcrumb}</div>}
        {eyebrow && <div className="ad-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="ad-header-actions">{actions}</div>}
    </div>
  );
}

export function MetricCard({ label, value, note, icon: Icon, tone = "rust" }) {
  return (
    <article className="ad-metric-card">
      <div className="ad-metric-top">
        <span>{label}</span>
        <span className={`ad-metric-icon ad-tone-${tone}`}>
          {Icon && <Icon size={18} />}
        </span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

export function StatusBadge({ children, tone = "neutral" }) {
  return (
    <span className={`ad-badge ad-badge-${tone}`}>
      <i />
      {children}
    </span>
  );
}

export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="ad-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className={`ad-modal ${wide ? "ad-modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </header>
        <div className="ad-modal-body">{children}</div>
      </section>
    </div>
  );
}

export function Field({ label, hint, error, children, className = "" }) {
  return (
    <label className={`ad-field ${className}`}>
      <span>{label}</span>
      {children}
      {error ? (
        <small className="ad-error-text">{error}</small>
      ) : hint ? (
        <small>{hint}</small>
      ) : null}
    </label>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search..." }) {
  return (
    <label className="ad-search">
      <Search size={16} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function Select({ value, onChange, children, ...props }) {
  return (
    <label className="ad-select-wrap">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown size={15} />
    </label>
  );
}

export function EmptyState({ title, description }) {
  return (
    <div className="ad-empty">
      <AlertTriangle size={22} />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  danger = false,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="ad-modal-copy">{description}</p>
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
          className={`ad-button ${danger ? "ad-button-danger" : "ad-button-primary"}`}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function statusTone(value) {
  if (
    ["Succeeded", "Ready", "Handed Off", "Active", "Verified"].includes(value)
  )
    return "success";
  if (["Failed", "Cancelled", "Late"].includes(value)) return "danger";
  if (
    [
      "Pending",
      "Placed",
      "Accepted",
      "Preparing",
      "Inactive",
      "Unavailable",
    ].includes(value)
  )
    return "warning";
  return "neutral";
}
