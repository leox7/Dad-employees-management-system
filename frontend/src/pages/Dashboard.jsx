import { useEffect, useState } from "react";

import { errorMessage } from "../api/client";
import * as dashboardApi from "../api/dashboard";
import MonthlyTrendChart from "../components/MonthlyTrendChart";
import { ErrorNote, Loading, PageHead } from "../components/ui";
import { money, monthName } from "../lib/format";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [s, t] = await Promise.all([
          dashboardApi.summary(),
          dashboardApi.monthlyTrend(),
        ]);
        if (!cancelled) {
          setSummary(s);
          setTrend(t);
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, "Could not load the dashboard."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHead title="Dashboard" />

      <div className="stack">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {loading ? (
          <Loading />
        ) : !summary ? null : (
          <>
            <div className="stat-grid">
              <StatTile
                label="Active Employees"
                value={String(summary.active_employee_count)}
              />
              <StatTile
                label={`${monthName(summary.current_month)} Payroll`}
                value={money(summary.current_month_payroll_total)}
                /* The backend sends `current_month_has_approved_run` precisely so
                   a genuine 0 can be told apart from "no run yet" — without this
                   note the tile would quietly imply nobody was paid. */
                note={
                  summary.current_month_has_approved_run
                    ? "Approved and final"
                    : `No approved run for ${monthName(summary.current_month)} yet`
                }
              />
              <StatTile
                label="Outstanding Loans"
                value={money(summary.total_outstanding_loans)}
                note="Across all employees"
              />
              <StatTile
                label="Advances Pending"
                value={money(summary.total_unconsumed_advances)}
                note="Not yet deducted from a payroll run"
              />
            </div>

            <section>
              <h2 className="section-header" style={{ marginBottom: 16 }}>
                Monthly Analysis
              </h2>
              <MonthlyTrendChart trend={trend} />
            </section>
          </>
        )}
      </div>
    </>
  );
}

function StatTile({ label, value, note }) {
  return (
    <div className="stat-tile">
      <div className="caption stat-tile__label">{label}</div>
      <div className="stat-tile__value">{value}</div>
      {note ? <div className="stat-tile__note">{note}</div> : null}
    </div>
  );
}
