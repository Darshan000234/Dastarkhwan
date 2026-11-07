import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

export const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
export const dateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
export const timeOnly = (value) =>
  value
    ? new Date(value).toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
export function ManagerPageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="om-page-header">
      <div>
        <span className="om-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="om-header-actions">{actions}</div>}
    </div>
  );
}
export function MetricCard({ icon: Icon, label, value, note, tone = "rust" }) {
  return (
    <article className="om-metric-card">
      <div className="om-metric-top">
        <span>{label}</span>
        <span className={`om-metric-icon ${tone}`}>
          {Icon && <Icon size={19} />}
        </span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
export function Badge({ children, tone = "neutral" }) {
  return (
    <span className={`om-badge ${tone}`}>
      <i />
      {children}
    </span>
  );
}
export function Panel({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`om-panel ${className}`}>
      <header className="om-panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
export function Empty({ title, detail }) {
  return (
    <div className="om-empty">
      <AlertTriangle size={22} />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}
export function Modal({ open, title, onClose, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      window.removeEventListener("keydown", key);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="om-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className={`om-modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
      >
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </header>
        <div className="om-modal-body">{children}</div>
      </section>
    </div>
  );
}
export function Toast({ message, tone = "success", onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(onClose, 3200);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div className={`om-toast ${tone}`} role="status">
      {message}
      <button type="button" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
