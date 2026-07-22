import { useCallback, useEffect, useMemo, useState } from "react";

import * as advancesApi from "../api/advances";
import { errorMessage } from "../api/client";
import * as employeesApi from "../api/employees";
import {
  EmployeeSelect,
  EmptyState,
  ErrorNote,
  Field,
  Loading,
  PageHead,
} from "../components/ui";
import { amount, money, monthYear, shortDate, todayISO } from "../lib/format";

const now = new Date();

function blankForm() {
  return {
    amount: "",
    advance_date: todayISO(),
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

export default function Advances() {
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState(null);
  const [advances, setAdvances] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingAdvances, setLoadingAdvances] = useState(false);
  const [error, setError] = useState("");

  const [logOpen, setLogOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setEmployees(await employeesApi.listEmployees());
      } catch (err) {
        setError(errorMessage(err, "Could not load employees."));
      } finally {
        setLoadingEmployees(false);
      }
    })();
  }, []);

  const loadAdvances = useCallback(async (id) => {
    if (!id) {
      setAdvances([]);
      return;
    }
    setLoadingAdvances(true);
    setError("");
    try {
      setAdvances(await advancesApi.advancesForEmployee(id));
    } catch (err) {
      setError(errorMessage(err, "Could not load advances."));
    } finally {
      setLoadingAdvances(false);
    }
  }, []);

  useEffect(() => {
    loadAdvances(employeeId);
  }, [employeeId, loadAdvances]);

  /* Display-only roll-up of the balance the server already tracks per advance — the
     total still to be deducted from this employee, not a re-derivation. Mirrors the
     Loans page's Total Outstanding tile. */
  const outstandingTotal = useMemo(
    () =>
      advances.reduce((sum, adv) => sum + Number(adv.outstanding_amount), 0),
    [advances]
  );

  const selectedEmployee = employees.find((e) => e.id === employeeId);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await advancesApi.createAdvance({
        employee_id: employeeId,
        amount: form.amount,
        advance_date: form.advance_date,
        month: Number(form.month),
        year: Number(form.year),
      });
      setLogOpen(false);
      setForm(blankForm());
      await loadAdvances(employeeId);
    } catch (err) {
      setFormError(errorMessage(err, "Could not log this advance."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHead title="Advances" />

      <div className="stack">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <section style={{ maxWidth: 420 }}>
          <Field label="Employee">
            {loadingEmployees ? (
              <Loading />
            ) : (
              <EmployeeSelect
                employees={employees}
                value={employeeId}
                onChange={(id) => {
                  setEmployeeId(id);
                  setLogOpen(false);
                }}
              />
            )}
          </Field>
        </section>

        {!employeeId ? (
          <EmptyState message="Select an employee to see their advance history." />
        ) : loadingAdvances ? (
          <Loading />
        ) : (
          <>
            <section className="stat-tile" style={{ maxWidth: 320 }}>
              <div className="caption stat-tile__label">Outstanding Advance</div>
              <div className="stat-tile__value">{money(outstandingTotal)}</div>
              <div className="stat-tile__note">
                {selectedEmployee?.name} · pre-fills the payroll deduction, edit as needed
              </div>
            </section>

            <div className="row-between">
              <h2 className="section-header">Advance History</h2>
              {!logOpen ? (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    setLogOpen(true);
                    setFormError("");
                  }}
                >
                  Log Advance
                </button>
              ) : null}
            </div>

            {logOpen ? (
              <section className="card">
                <h3 className="section-header" style={{ marginBottom: 24 }}>
                  Log Advance — {selectedEmployee?.name}
                </h3>
                <form className="form" onSubmit={handleSubmit}>
                  {formError ? <ErrorNote>{formError}</ErrorNote> : null}

                  <Field label="Advance Amount (KES)">
                    <input
                      className="field__input field__input--money"
                      type="number"
                      step="0.01"
                      min="0.01"
                      inputMode="decimal"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      required
                      autoFocus
                    />
                  </Field>

                  <Field label="Date Given">
                    <input
                      className="field__input"
                      type="date"
                      value={form.advance_date}
                      onChange={(e) =>
                        setForm({ ...form, advance_date: e.target.value })
                      }
                      required
                    />
                  </Field>

                  {/* month/year are separate from advance_date on purpose: they
                      note which payroll this advance relates to, which is not
                      always the month it was handed over. */}
                  <Field
                    label="Applies To Payroll Month"
                    hint="Just a note of which payroll this relates to — you enter the deduction manually on that payroll run."
                  >
                    <select
                      className="field__input"
                      value={form.month}
                      onChange={(e) => setForm({ ...form, month: e.target.value })}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          {monthYear(m, form.year)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Payroll Year">
                    <input
                      className="field__input field__input--money"
                      type="number"
                      min="2000"
                      max="2100"
                      step="1"
                      value={form.year}
                      onChange={(e) => setForm({ ...form, year: e.target.value })}
                      required
                    />
                  </Field>

                  <div className="form-actions">
                    <button type="submit" className="btn btn--primary" disabled={saving}>
                      {saving ? "Saving…" : "Log Advance"}
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => setLogOpen(false)}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </section>
            ) : null}

            {advances.length === 0 ? (
              <EmptyState
                message={`No advances recorded yet for ${selectedEmployee?.name}.`}
                action={
                  !logOpen ? (
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => setLogOpen(true)}
                    >
                      Log Advance
                    </button>
                  ) : null
                }
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date Given</th>
                      <th>Applies To</th>
                      <th className="num">Amount (KES)</th>
                      <th className="num">Remaining (KES)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advances.map((advance) => (
                      <tr key={advance.id}>
                        <td>{shortDate(advance.advance_date)}</td>
                        <td className="muted">
                          {monthYear(advance.month, advance.year)}
                        </td>
                        <td className="num">{amount(advance.amount)}</td>
                        <td className="num">{amount(advance.outstanding_amount)}</td>
                        <td>{advanceStatusBadge(advance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* Derived from the balance the server tracks — no separate status column is stored.
   Fully deducted (nothing left) · Not deducted (untouched) · Partly deducted. */
function advanceStatusBadge(advance) {
  const remaining = Number(advance.outstanding_amount);
  const original = Number(advance.amount);
  if (remaining <= 0) {
    return <span className="badge badge--approved">Fully deducted</span>;
  }
  if (remaining >= original) {
    return <span className="badge badge--draft">Not deducted</span>;
  }
  return <span className="badge badge--warning">Partly deducted</span>;
}
