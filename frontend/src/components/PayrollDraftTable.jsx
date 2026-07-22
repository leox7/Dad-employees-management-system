import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { errorMessage } from "../api/client";
import * as payrollApi from "../api/payroll";
import { fromCents, netCents, sumCents } from "../lib/cents";
import { amount } from "../lib/format";
import { lineWarnings } from "../lib/warnings";
import { ErrorNote, WarningBadge } from "./ui";

const AUTOSAVE_MS = 600;

/* Local input state is keyed by line id, each holding both editable deductions,
   seeded from the server. It is not re-seeded on every response on purpose: doing
   so would yank the digits out from under dad's cursor mid-typing when an autosave
   lands. */
const seedValues = (lines) =>
  Object.fromEntries(
    lines.map((line) => [
      line.id,
      {
        advance: String(line.advance_deduction),
        loan: String(line.loan_deduction),
      },
    ])
  );

/* Exposes flush() so the parent can force a pending autosave to land *before*
   approving. Without it, typing a deduction and immediately hitting Approve
   would approve the previous value — the one money bug this screen could
   plausibly ship with. */
const PayrollDraftTable = forwardRef(function PayrollDraftTable(
  { run, onRunUpdate },
  ref
) {
  const readOnly = run.status !== "draft";

  const [values, setValues] = useState(() => seedValues(run.lines));
  const [flashes, setFlashes] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState("");

  const timer = useRef(null);
  const pending = useRef(null); // values awaiting a save, or null when clean

  // Re-seed only when the run itself changes identity or state (navigating to
  // another run, or the table flipping read-only after approval).
  useEffect(() => {
    setValues(seedValues(run.lines));
    setError("");
    pending.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.id, run.status]);

  const save = useCallback(
    async (next) => {
      const payload = run.lines.map((line) => {
        const entry = next[line.id];
        // An empty input means zero, not "leave it alone" — the server requires
        // a value per line it's asked to update.
        return {
          id: line.id,
          advance_deduction: entry.advance === "" ? "0" : entry.advance,
          loan_deduction: entry.loan === "" ? "0" : entry.loan,
        };
      });

      setSaving(true);
      setError("");
      try {
        const updated = await payrollApi.saveDraft(run.id, payload);
        onRunUpdate(updated);
        setSavedAt(new Date());
        pending.current = null;
      } catch (err) {
        setError(errorMessage(err, "Could not save this draft."));
        // Rethrow so flush() rejects: an approve that follows a failed save must
        // abort, not proceed against stale server-side figures.
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [run.id, run.lines, onRunUpdate]
  );

  useImperativeHandle(ref, () => ({
    async flush() {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (pending.current) {
        await save(pending.current);
      }
    },
  }));

  useEffect(() => () => clearTimeout(timer.current), []);

  function handleChange(lineId, field, raw) {
    const next = { ...values, [lineId]: { ...values[lineId], [field]: raw } };
    setValues(next);
    pending.current = next;

    // Bump the flash counter for this row: the key change remounts the net cell,
    // which restarts the 200ms highlight.
    setFlashes((f) => ({ ...f, [lineId]: (f[lineId] ?? 0) + 1 }));

    clearTimeout(timer.current);
    // The rejection is swallowed here only because save() has already put the
    // message on screen; flush() is the path that needs it to propagate.
    timer.current = setTimeout(() => save(next).catch(() => {}), AUTOSAVE_MS);
  }

  // Leaving a field is a strong signal the value is final — don't make dad wait
  // out the debounce.
  function handleBlur() {
    if (!pending.current) return;
    clearTimeout(timer.current);
    const next = pending.current;
    timer.current = setTimeout(() => save(next).catch(() => {}), 0);
  }

  const rows = useMemo(
    () =>
      run.lines.map((line) => {
        const entry = values[line.id] ?? {
          advance: String(line.advance_deduction),
          loan: String(line.loan_deduction),
        };
        const advanceRaw = entry.advance;
        const loanRaw = entry.loan;
        const advanceDeduction = advanceRaw === "" ? "0" : advanceRaw;
        const loanDeduction = loanRaw === "" ? "0" : loanRaw;
        const net = netCents(line.gross_salary, loanDeduction, advanceDeduction);
        return {
          line,
          advanceRaw,
          loanRaw,
          advanceDeduction,
          loanDeduction,
          net,
          warnings: lineWarnings(line, net, loanDeduction, advanceDeduction),
        };
      }),
    [run.lines, values]
  );

  const totals = useMemo(
    () => ({
      gross: sumCents(rows.map((r) => r.line.gross_salary)),
      loan: sumCents(rows.map((r) => r.loanDeduction)),
      advance: sumCents(rows.map((r) => r.advanceDeduction)),
      net: rows.reduce((sum, r) => sum + r.net, 0),
    }),
    [rows]
  );

  if (run.lines.length === 0) {
    return (
      <p className="muted">
        This run has no lines — there were no active employees when it was
        generated.
      </p>
    );
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="payroll-scroll">
        <table className="payroll-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th className="num">Gross Salary (KES)</th>
              <th className="num">Advance Deduction (KES)</th>
              <th className="num">Loan Deduction (KES)</th>
              <th className="num">Net Salary (KES)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ line, advanceRaw, loanRaw, net, warnings }) => (
              <tr key={line.id}>
                <td>
                  {line.employee_name ?? `Employee #${line.employee_id}`}
                  {warnings.length > 0 ? (
                    <div className="row-warning">
                      <WarningBadge>Warning</WarningBadge>
                      <span>{warnings.join(" · ")}</span>
                    </div>
                  ) : null}
                </td>
                <td className="num">{amount(line.gross_salary)}</td>
                <td className="num">
                  <input
                    className="cell-input"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={advanceRaw}
                    disabled={readOnly}
                    aria-label={`Advance deduction for ${line.employee_name}`}
                    onChange={(e) => handleChange(line.id, "advance", e.target.value)}
                    onBlur={handleBlur}
                  />
                </td>
                <td className="num">
                  <input
                    className="cell-input"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={loanRaw}
                    disabled={readOnly}
                    aria-label={`Loan deduction for ${line.employee_name}`}
                    onChange={(e) => handleChange(line.id, "loan", e.target.value)}
                    onBlur={handleBlur}
                  />
                </td>
                <td
                  key={flashes[line.id] ?? 0}
                  className={`num col-net${flashes[line.id] ? " flash" : ""}${
                    net < 0 ? " money--negative" : ""
                  }`}
                >
                  {amount(fromCents(net))}
                </td>
              </tr>
            ))}
          </tbody>
          {/* Sticky totals: the running total stays visible while scrolling. */}
          <tfoot>
            <tr>
              <td>Totals</td>
              <td className="num">{amount(fromCents(totals.gross))}</td>
              <td className="num">{amount(fromCents(totals.advance))}</td>
              <td className="num">{amount(fromCents(totals.loan))}</td>
              <td className="num col-net">{amount(fromCents(totals.net))}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {!readOnly ? (
        <div className="autosave-note" aria-live="polite">
          {saving
            ? "Saving…"
            : savedAt
              ? `All changes saved ${savedAt.toLocaleTimeString("en-KE")}`
              : "Changes save automatically."}
        </div>
      ) : null}
    </div>
  );
});

export default PayrollDraftTable;
