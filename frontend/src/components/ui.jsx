/* Small shared primitives used across every page. Kept in one file because each
   is a handful of lines and they always travel together. */

import { useAuth } from "../context/AuthContext";
import Icon from "./icons";

/* Page header: welcome line + title, closed by a ledger line (design.md §4). */
export function PageHead({ title, actions }) {
  const { user } = useAuth();
  return (
    <header className="page-head">
      <div className="row-between">
        <div>
          <div className="caption page-head__welcome">
            Welcome, {user?.username ?? "—"}
          </div>
          <h1 className="page-title">{title}</h1>
        </div>
        {actions}
      </div>
    </header>
  );
}

/* design.md §5: status badges reuse the palette tokens rather than inventing
   new colors. Draft = Graphite, Approved = Ledger Green. */
export function StatusBadge({ status }) {
  const known = ["draft", "approved", "active", "inactive"];
  const variant = known.includes(status) ? status : "draft";
  return <span className={`badge badge--${variant}`}>{status}</span>;
}

/* Color is never the only signal (design.md §8) — the badge always carries text
   alongside the mark. */
export function WarningBadge({ children }) {
  return (
    <span className="badge badge--warning">
      <Icon name="warning" size={12} strokeWidth={1.75} />
      {children}
    </span>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <div className="alert alert--error" role="alert">
      {children}
    </div>
  );
}

/* An invitation rather than a dead end (design.md §5) — the action sits right
   beneath the message. */
export function EmptyState({ message, action }) {
  return (
    <div className="empty-state">
      <p>{message}</p>
      {action}
    </div>
  );
}

export function Loading({ label = "Loading…" }) {
  return <div className="loading">{label}</div>;
}

export function Field({ label, error, children, hint }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && !error ? <span className="field__error muted">{hint}</span> : null}
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}

/* Destructive and irreversible actions are never a single tap (design.md §5). */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  confirmVariant = "btn--primary",
  busy = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="dialog__title">{title}</h2>
        <p className="dialog__body">{body}</p>
        <div className="dialog__actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${confirmVariant}`}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* The employee picker shared by the Loans and Advances pages. */
export function EmployeeSelect({ employees, value, onChange, id }) {
  return (
    <select
      id={id}
      className="field__input"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">Select an employee…</option>
      {employees.map((emp) => (
        <option key={emp.id} value={emp.id}>
          {emp.name}
          {emp.status === "inactive" ? " (inactive)" : ""}
        </option>
      ))}
    </select>
  );
}
