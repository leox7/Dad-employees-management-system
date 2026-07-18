import { useCallback, useEffect, useState } from "react";

import { errorMessage } from "../api/client";
import * as employeesApi from "../api/employees";
import {
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  Field,
  Loading,
  PageHead,
  StatusBadge,
} from "../components/ui";
import { amount } from "../lib/format";

const BLANK = { name: "", phone: "", salary: "" };

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setEmployees(await employeesApi.listEmployees());
    } catch (err) {
      setError(errorMessage(err, "Could not load employees."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setForm(BLANK);
    setEditingId(null);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(employee) {
    setForm({
      name: employee.name,
      phone: employee.phone,
      salary: String(employee.salary),
    });
    setEditingId(employee.id);
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(BLANK);
    setFormError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      // Salary is sent as a string: the backend parses it into a Decimal, so
      // routing it through a JS float here would be the one place precision
      // could be lost before it ever reaches the server.
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        salary: form.salary,
      };
      if (editingId) {
        await employeesApi.updateEmployee(editingId, payload);
      } else {
        await employeesApi.createEmployee(payload);
      }
      closeForm();
      await load();
    } catch (err) {
      setFormError(errorMessage(err, "Could not save this employee."));
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm() {
    if (!confirmTarget) return;
    setConfirmBusy(true);
    try {
      const { employee, action } = confirmTarget;
      if (action === "deactivate") {
        await employeesApi.deactivateEmployee(employee.id);
      } else {
        await employeesApi.reactivateEmployee(employee.id);
      }
      setConfirmTarget(null);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Could not update this employee."));
      setConfirmTarget(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Employees"
        actions={
          !formOpen ? (
            <button type="button" className="btn btn--primary" onClick={openCreate}>
              Add Employee
            </button>
          ) : null
        }
      />

      <div className="stack">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {formOpen ? (
          <section className="card">
            <h2 className="section-header" style={{ marginBottom: 24 }}>
              {editingId ? "Edit Employee" : "Add Employee"}
            </h2>
            <form className="form" onSubmit={handleSubmit}>
              {formError ? <ErrorNote>{formError}</ErrorNote> : null}

              <Field label="Name">
                <input
                  className="field__input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  autoFocus
                />
              </Field>

              <Field label="Phone Number">
                <input
                  className="field__input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                />
              </Field>

              <Field
                label="Monthly Salary (KES)"
                hint={
                  editingId
                    ? "Changing salary affects future runs only — past payroll keeps its own frozen figure."
                    : null
                }
              >
                <input
                  className="field__input field__input--money"
                  type="number"
                  step="0.01"
                  min="0.01"
                  inputMode="decimal"
                  value={form.salary}
                  onChange={(e) => setForm({ ...form, salary: e.target.value })}
                  required
                />
              </Field>

              <div className="form-actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? "Saving…" : "Save Employee"}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {loading ? (
          <Loading />
        ) : employees.length === 0 ? (
          <EmptyState
            message="No employees recorded yet."
            action={
              <button type="button" className="btn btn--primary" onClick={openCreate}>
                Add Employee
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th className="num">Salary (KES)</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td>{employee.name}</td>
                    <td className="muted">{employee.phone}</td>
                    <td className="num">{amount(employee.salary)}</td>
                    <td>
                      <StatusBadge status={employee.status} />
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => openEdit(employee)}
                      >
                        Edit
                      </button>
                      {employee.status === "active" ? (
                        <button
                          type="button"
                          className="btn-link btn-link--danger"
                          onClick={() =>
                            setConfirmTarget({ employee, action: "deactivate" })
                          }
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() =>
                            setConfirmTarget({ employee, action: "reactivate" })
                          }
                        >
                          Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={
          confirmTarget?.action === "deactivate"
            ? "Deactivate employee?"
            : "Reactivate employee?"
        }
        body={
          confirmTarget?.action === "deactivate"
            ? `${confirmTarget?.employee.name} will stop appearing in new payroll runs. Their loans, advances, and past payroll records are kept.`
            : `${confirmTarget?.employee.name} will appear in new payroll runs again.`
        }
        confirmLabel={
          confirmTarget?.action === "deactivate" ? "Deactivate" : "Reactivate"
        }
        confirmVariant={
          confirmTarget?.action === "deactivate" ? "btn--destructive" : "btn--primary"
        }
        busy={confirmBusy}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}
