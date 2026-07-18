import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { errorMessage } from "../api/client";
import * as payrollApi from "../api/payroll";
import PayrollDraftTable from "../components/PayrollDraftTable";
import {
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  Field,
  Loading,
  PageHead,
  StatusBadge,
} from "../components/ui";
import { amount, monthName, monthYear } from "../lib/format";

const now = new Date();
const YEARS = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

export default function Payroll() {
  const { runId } = useParams();
  const navigate = useNavigate();

  const [runs, setRuns] = useState([]);
  const [run, setRun] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingRun, setLoadingRun] = useState(false);
  const [error, setError] = useState("");

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [creating, setCreating] = useState(false);

  const [confirm, setConfirm] = useState(null); // 'approve' | 'scrap'
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false); // drives the checkmark
  const [exporting, setExporting] = useState(false);

  const tableRef = useRef(null);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      setRuns(await payrollApi.history());
    } catch (err) {
      setError(errorMessage(err, "Could not load payroll history."));
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Loading the run from the URL (rather than from whatever POST /payroll/run
  // returned) is what makes a browser reload safe: autosaved state comes back
  // from the server, never from memory.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!runId) {
        setRun(null);
        return;
      }
      setLoadingRun(true);
      setError("");
      try {
        const detail = await payrollApi.getRun(runId);
        if (!cancelled) setRun(detail);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, "Could not load this payroll run."));
      } finally {
        if (!cancelled) setLoadingRun(false);
      }
    }

    load();
    setApproved(false);
    return () => {
      cancelled = true;
    };
  }, [runId]);

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setCreating(true);
    try {
      const detail = await payrollApi.createRun(Number(month), Number(year));
      await loadHistory();
      navigate(`/payroll/${detail.id}`);
    } catch (err) {
      // 409 when the month already has a run — the backend's message names the
      // month, so show it as-is.
      setError(errorMessage(err, "Could not start this payroll run."));
    } finally {
      setCreating(false);
    }
  }

  async function handleApprove() {
    setBusy(true);
    setError("");
    try {
      // Land any in-flight edit before the irreversible step.
      await tableRef.current?.flush();
      const updated = await payrollApi.approveRun(run.id);
      setRun(updated);
      setConfirm(null);
      setApproved(true);
      await loadHistory();
    } catch (err) {
      setError(errorMessage(err, "Could not approve this payroll run."));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleScrap() {
    setBusy(true);
    setError("");
    try {
      await payrollApi.deleteRun(run.id);
      setConfirm(null);
      setRun(null);
      await loadHistory();
      navigate("/payroll");
    } catch (err) {
      setError(errorMessage(err, "Could not scrap this draft."));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setError("");
    try {
      await payrollApi.exportRun(run.id, run.month, run.year);
    } catch (err) {
      setError(errorMessage(err, "Could not export this payroll run."));
    } finally {
      setExporting(false);
    }
  }

  /* ------------------------------ run detail ------------------------------ */
  if (runId) {
    return (
      <>
        <PageHead
          title={run ? `Payroll — ${monthYear(run.month, run.year)}` : "Payroll"}
          actions={
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => navigate("/payroll")}
            >
              Back to Runs
            </button>
          }
        />

        <div className="stack">
          {error ? <ErrorNote>{error}</ErrorNote> : null}

          {loadingRun ? (
            <Loading />
          ) : !run ? (
            <EmptyState message="This payroll run could not be found." />
          ) : (
            <>
              <div className="row-between">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <StatusBadge status={run.status} />
                  {approved ? (
                    <span
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                        <path className="check-mark" d="M4 12.5l5 5L20 6.5" />
                      </svg>
                      <span style={{ color: "var(--ledger-green)", fontWeight: 500 }}>
                        Payroll approved
                      </span>
                    </span>
                  ) : run.status === "approved" ? (
                    <span className="muted" style={{ fontSize: 13 }}>
                      Approved — this run is final.
                    </span>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  {run.status === "draft" ? (
                    <>
                      <button
                        type="button"
                        className="btn btn--destructive"
                        onClick={() => setConfirm("scrap")}
                      >
                        Scrap Draft
                      </button>
                      {/* The one Primary button on this screen. */}
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() => setConfirm("approve")}
                      >
                        Approve Payroll
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={handleExport}
                      disabled={exporting}
                    >
                      {exporting ? "Preparing…" : "Export to Excel"}
                    </button>
                  )}
                </div>
              </div>

              <PayrollDraftTable ref={tableRef} run={run} onRunUpdate={setRun} />
            </>
          )}
        </div>

        <ConfirmDialog
          open={confirm === "approve"}
          title="Approve payroll?"
          body={`This will lock ${
            run ? monthName(run.month) : "this month"
          }'s payroll and cannot be undone. Loan repayments will be recorded, loan balances reduced, and this month's advances marked as deducted.`}
          confirmLabel="Approve Payroll"
          busy={busy}
          onConfirm={handleApprove}
          onCancel={() => setConfirm(null)}
        />

        <ConfirmDialog
          open={confirm === "scrap"}
          title="Scrap this draft?"
          body="The draft and all its lines are deleted. Nothing financial has happened yet, so no loans or advances are affected — you can generate this month again from scratch."
          confirmLabel="Scrap Draft"
          confirmVariant="btn--destructive"
          busy={busy}
          onConfirm={handleScrap}
          onCancel={() => setConfirm(null)}
        />
      </>
    );
  }

  /* ------------------------------- run list ------------------------------- */
  return (
    <>
      <PageHead title="Payroll" />

      <div className="stack">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <section className="card">
          <h2 className="section-header" style={{ marginBottom: 24 }}>
            Start a Payroll Run
          </h2>
          <form className="form" onSubmit={handleCreate}>
            <Field label="Month">
              <select
                className="field__input"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {monthName(m)}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Year"
              hint="A draft is created for every active employee, with this month's advances already deducted."
            >
              <select
                className="field__input"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </Field>

            <button type="submit" className="btn btn--primary" disabled={creating}>
              {creating ? "Starting…" : "Run Payroll"}
            </button>
          </form>
        </section>

        <div>
          <h2 className="section-header" style={{ marginBottom: 8 }}>
            Payroll History
          </h2>

          {loadingHistory ? (
            <Loading />
          ) : runs.length === 0 ? (
            <EmptyState message="No payroll runs yet. Start one above." />
          ) : (
            <div className="run-list">
              {runs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="run-item"
                  onClick={() => navigate(`/payroll/${item.id}`)}
                >
                  <span className="run-item__meta">
                    <span style={{ fontWeight: 500 }}>
                      {monthYear(item.month, item.year)}
                    </span>
                    <StatusBadge status={item.status} />
                    <span className="muted" style={{ fontSize: 13 }}>
                      {item.employee_count}{" "}
                      {item.employee_count === 1 ? "employee" : "employees"}
                    </span>
                  </span>
                  <span className="money">{amount(item.total_net)} KES</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
