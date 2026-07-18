import { useCallback, useEffect, useMemo, useState } from "react";

import { errorMessage } from "../api/client";
import * as employeesApi from "../api/employees";
import * as loansApi from "../api/loans";
import {
  EmployeeSelect,
  EmptyState,
  ErrorNote,
  Field,
  Loading,
  PageHead,
  StatusBadge,
} from "../components/ui";
import { amount, money, shortDate, todayISO } from "../lib/format";

export default function Loans() {
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState(null);
  const [loans, setLoans] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [error, setError] = useState("");

  const [logOpen, setLogOpen] = useState(false);
  const [logForm, setLogForm] = useState({ loan_amount: "", date_taken: todayISO() });
  const [logError, setLogError] = useState("");
  const [saving, setSaving] = useState(false);

  // Which loan's repay form is open, keyed by loan id.
  const [repayFor, setRepayFor] = useState(null);
  const [repayForm, setRepayForm] = useState({ amount: "", payment_date: todayISO() });
  const [repayError, setRepayError] = useState("");
  const [repaying, setRepaying] = useState(false);

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

  const loadLoans = useCallback(async (id) => {
    if (!id) {
      setLoans([]);
      return;
    }
    setLoadingLoans(true);
    setError("");
    try {
      setLoans(await loansApi.loansForEmployee(id));
    } catch (err) {
      setError(errorMessage(err, "Could not load loans."));
    } finally {
      setLoadingLoans(false);
    }
  }, []);

  useEffect(() => {
    loadLoans(employeeId);
  }, [employeeId, loadLoans]);

  /* Display-only roll-up of a column the server already computed per loan — the
     same figure the backend's get_outstanding_balance() returns, not a
     re-derivation of any balance. */
  const totalOutstanding = useMemo(
    () => loans.reduce((sum, loan) => sum + Number(loan.outstanding_amount), 0),
    [loans]
  );

  const selectedEmployee = employees.find((e) => e.id === employeeId);

  async function handleLogLoan(event) {
    event.preventDefault();
    setLogError("");
    setSaving(true);
    try {
      await loansApi.createLoan({
        employee_id: employeeId,
        loan_amount: logForm.loan_amount,
        date_taken: logForm.date_taken,
      });
      setLogOpen(false);
      setLogForm({ loan_amount: "", date_taken: todayISO() });
      await loadLoans(employeeId);
    } catch (err) {
      setLogError(errorMessage(err, "Could not log this loan."));
    } finally {
      setSaving(false);
    }
  }

  async function handleRepay(event, loan) {
    event.preventDefault();
    setRepayError("");
    setRepaying(true);
    try {
      await loansApi.repayLoan(loan.id, {
        amount: repayForm.amount,
        payment_date: repayForm.payment_date,
      });
      setRepayFor(null);
      setRepayForm({ amount: "", payment_date: todayISO() });
      await loadLoans(employeeId);
    } catch (err) {
      // The backend rejects an overpayment outright rather than capping it, and
      // its message already names the real balance — show it verbatim.
      setRepayError(errorMessage(err, "Could not record this repayment."));
    } finally {
      setRepaying(false);
    }
  }

  function openRepay(loan) {
    setRepayFor(loan.id);
    setRepayForm({ amount: "", payment_date: todayISO() });
    setRepayError("");
  }

  return (
    <>
      <PageHead title="Loans" />

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
                  setRepayFor(null);
                }}
              />
            )}
          </Field>
        </section>

        {!employeeId ? (
          <EmptyState message="Select an employee to see their loan ledger." />
        ) : loadingLoans ? (
          <Loading />
        ) : (
          <>
            {/* The number dad needs at a glance gets its own tile, above the detail. */}
            <section className="stat-tile" style={{ maxWidth: 320 }}>
              <div className="caption stat-tile__label">Total Outstanding</div>
              <div className="stat-tile__value">{money(totalOutstanding)}</div>
              <div className="stat-tile__note">
                {selectedEmployee?.name} · {loans.length}{" "}
                {loans.length === 1 ? "loan" : "loans"} on record
              </div>
            </section>

            <div className="row-between">
              <h2 className="section-header">Loan Ledger</h2>
              {!logOpen ? (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    setLogOpen(true);
                    setLogError("");
                  }}
                >
                  Log Loan
                </button>
              ) : null}
            </div>

            {logOpen ? (
              <section className="card">
                <h3 className="section-header" style={{ marginBottom: 24 }}>
                  Log Loan — {selectedEmployee?.name}
                </h3>
                <form className="form" onSubmit={handleLogLoan}>
                  {logError ? <ErrorNote>{logError}</ErrorNote> : null}

                  <Field label="Loan Amount (KES)">
                    <input
                      className="field__input field__input--money"
                      type="number"
                      step="0.01"
                      min="0.01"
                      inputMode="decimal"
                      value={logForm.loan_amount}
                      onChange={(e) =>
                        setLogForm({ ...logForm, loan_amount: e.target.value })
                      }
                      required
                      autoFocus
                    />
                  </Field>

                  <Field
                    label="Date Taken"
                    hint="Repayments at payroll are applied to the oldest loan first."
                  >
                    <input
                      className="field__input"
                      type="date"
                      value={logForm.date_taken}
                      onChange={(e) =>
                        setLogForm({ ...logForm, date_taken: e.target.value })
                      }
                      required
                    />
                  </Field>

                  <div className="form-actions">
                    <button type="submit" className="btn btn--primary" disabled={saving}>
                      {saving ? "Saving…" : "Log Loan"}
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

            {loans.length === 0 ? (
              <EmptyState
                message={`No loans recorded yet for ${selectedEmployee?.name}.`}
                action={
                  !logOpen ? (
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => setLogOpen(true)}
                    >
                      Log Loan
                    </button>
                  ) : null
                }
              />
            ) : (
              <div className="stack" style={{ gap: 16 }}>
                {loans.map((loan) => (
                  <LoanCard
                    key={loan.id}
                    loan={loan}
                    repayOpen={repayFor === loan.id}
                    repayForm={repayForm}
                    repayError={repayError}
                    repaying={repaying}
                    onOpenRepay={() => openRepay(loan)}
                    onCancelRepay={() => setRepayFor(null)}
                    onChangeRepay={setRepayForm}
                    onSubmitRepay={(e) => handleRepay(e, loan)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function LoanCard({
  loan,
  repayOpen,
  repayForm,
  repayError,
  repaying,
  onOpenRepay,
  onCancelRepay,
  onChangeRepay,
  onSubmitRepay,
}) {
  return (
    <section className="card">
      <div className="row-between" style={{ marginBottom: 16 }}>
        <div>
          <div className="caption">Loan of {money(loan.loan_amount)}</div>
          <div style={{ marginTop: 4 }}>
            <span className="money" style={{ fontSize: 20 }}>
              {money(loan.outstanding_amount)}
            </span>{" "}
            <span className="muted" style={{ fontSize: 13 }}>
              outstanding
            </span>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Taken {shortDate(loan.date_taken)}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <StatusBadge status={loan.status} />
          {loan.status === "active" && !repayOpen ? (
            <button type="button" className="btn btn--secondary btn--small" onClick={onOpenRepay}>
              Record Repayment
            </button>
          ) : null}
        </div>
      </div>

      {repayOpen ? (
        <form
          className="form"
          onSubmit={onSubmitRepay}
          style={{ marginBottom: 24, maxWidth: 360 }}
        >
          {repayError ? <ErrorNote>{repayError}</ErrorNote> : null}

          <Field
            label="Repayment Amount (KES)"
            hint={`Cannot exceed the outstanding ${money(loan.outstanding_amount)}.`}
          >
            <input
              className="field__input field__input--money"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={repayForm.amount}
              onChange={(e) => onChangeRepay({ ...repayForm, amount: e.target.value })}
              required
              autoFocus
            />
          </Field>

          <Field label="Payment Date">
            <input
              className="field__input"
              type="date"
              value={repayForm.payment_date}
              onChange={(e) =>
                onChangeRepay({ ...repayForm, payment_date: e.target.value })
              }
              required
            />
          </Field>

          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={repaying}>
              {repaying ? "Recording…" : "Record Repayment"}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onCancelRepay}
              disabled={repaying}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {loan.repayments.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>
          No repayments recorded against this loan yet.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Repayment Date</th>
                <th>Source</th>
                <th className="num">Amount (KES)</th>
              </tr>
            </thead>
            <tbody>
              {loan.repayments.map((repayment) => (
                <tr key={repayment.id}>
                  <td>{shortDate(repayment.payment_date)}</td>
                  <td className="muted">
                    {repayment.payroll_run_id
                      ? `Payroll run #${repayment.payroll_run_id}`
                      : "Manual entry"}
                  </td>
                  <td className="num">{amount(repayment.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
