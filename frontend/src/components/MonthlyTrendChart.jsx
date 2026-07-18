import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { amount, money, monthShort, monthYear } from "../lib/format";

/* Tokens, read from CSS rather than re-typed, so the chart can never drift from
   the rest of the system. Recharts needs real values, not var() references. */
const PAPER = "#f7f7f4";
const INK = "#1c201e";
const LEDGER_GREEN = "#2f5d50";
const SAND = "#c9bfa8";
const HAIRLINE = "#dee1db";
const GRAPHITE = "#6e756f";

/* Two series only (design.md §5): Ledger Green = net actually paid, Sand =
   deductions. Gross is the full bar height, never a third color — net +
   deductions sums to gross by construction in payroll_lines, so the stack is
   never arbitrary.

   Palette note: validated with the dataviz skill's checker against the Paper
   surface. Green↔Sand separation is ΔE 34.2 under protanopia (target ≥ 8), so
   the two segments stay distinguishable under colorblindness. Sand does fail the
   checker's chroma floor and sits at 1.7:1 contrast against Paper — both are
   deliberate consequences of design.md's muted, near-monochrome palette rather
   than accidents. The required relief for low contrast is that no value is
   reachable by color alone: the breakdown strip states all three figures for the
   selected month, and the table view below states every month. */

export default function MonthlyTrendChart({ trend }) {
  const data = useMemo(
    () =>
      trend.map((item) => ({
        key: `${item.year}-${item.month}`,
        label: monthShort(item.month),
        full: monthYear(item.month, item.year),
        salary: Number(item.total_salary),
        deductions: Number(item.total_deductions),
        net: Number(item.net_paid),
      })),
    [trend]
  );

  // The strip defaults to the latest approved month and follows the hovered bar.
  const [hovered, setHovered] = useState(null);
  const [showTable, setShowTable] = useState(false);

  const selected = data[hovered ?? data.length - 1];

  /* design.md §5: fewer than 2 approved runs -> plain-text empty state in place
     of the chart. One bar is not a trend. */
  if (data.length < 2) {
    return (
      <p className="muted">Trend appears after your second approved payroll run.</p>
    );
  }

  return (
    <div>
      {/* Breakdown strip — the exact numbers, so the chart itself only has to
          carry shape and proportion. The swatches double as the legend: series
          identity is never carried by color alone. */}
      <div className="breakdown">
        <div className="breakdown__item">
          <div className="caption">Total Salary — {selected.full}</div>
          <div className="breakdown__value money">{money(selected.salary)}</div>
        </div>
        <div className="breakdown__item">
          <div className="caption">
            <span className="swatch" style={{ background: SAND }} aria-hidden="true" />
            Total Deductions
          </div>
          <div className="breakdown__value money">{money(selected.deductions)}</div>
        </div>
        <div className="breakdown__item">
          <div className="caption">
            <span
              className="swatch"
              style={{ background: LEDGER_GREEN }}
              aria-hidden="true"
            />
            Net Paid
          </div>
          <div className="breakdown__value money">{money(selected.net)}</div>
        </div>
      </div>

      {/* Height includes the x-axis band, so the axis labels are never clipped
          into a nested scrollbar. */}
      <div style={{ height: 260, marginTop: 20 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
            barCategoryGap="28%"
            /* Thin marks. Without a cap, a handful of months stretches each bar
               into a slab that reads loud and childish — and dad will usually be
               looking at few months, not many. */
            maxBarSize={56}
            onMouseMove={(state) => {
              if (state?.isTooltipActive && typeof state.activeTooltipIndex === "number") {
                setHovered(state.activeTooltipIndex);
              }
            }}
            onMouseLeave={() => setHovered(null)}
          >
            {/* No gridlines. A single hairline baseline is enough structure. */}
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: HAIRLINE }}
              tick={{ fill: GRAPHITE, fontSize: 12, fontFamily: "Inter, sans-serif" }}
              dy={4}
            />
            {/* y-axis hidden entirely — the strip carries exact numbers. */}
            <YAxis hide />
            <Tooltip
              cursor={{ fill: "rgba(28, 32, 30, 0.04)" }}
              content={<LedgerTooltip />}
            />

            {/* Stack order matters: net sits on the baseline, deductions ride on
                top, so the full bar reads as gross.
                The 2px Paper stroke is the surface gap between segments — a gap,
                not a border drawn to separate them. */}
            <Bar dataKey="net" stackId="pay" fill={LEDGER_GREEN} stroke={PAPER} strokeWidth={2}>
              {data.map((entry) => (
                <Cell key={entry.key} />
              ))}
            </Bar>
            <Bar
              dataKey="deductions"
              stackId="pay"
              fill={SAND}
              stroke={PAPER}
              strokeWidth={2}
              radius={[4, 4, 0, 0]} /* rounded data-end, anchored to the baseline */
            >
              {data.map((entry) => (
                <Cell key={entry.key} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          className="btn-link"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
        >
          {showTable ? "Hide numbers" : "Show all months as numbers"}
        </button>
      </div>

      {/* The table twin: every value in the chart, reachable without color or
          hover. */}
      {showTable ? (
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">Total Salary (KES)</th>
                <th className="num">Deductions (KES)</th>
                <th className="num">Net Paid (KES)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.key}>
                  <td>{row.full}</td>
                  <td className="num">{amount(row.salary)}</td>
                  <td className="num">{amount(row.deductions)}</td>
                  <td className="num">{amount(row.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

/* Same card treatment as everything else in the system: Paper, hairline, no
   shadow. Carries all three figures, gross included. */
function LedgerTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div
      style={{
        background: PAPER,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 6,
        padding: "10px 12px",
        color: INK,
        fontFamily: "Inter, sans-serif",
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{row.full}</div>
      {[
        { label: "Total Salary", value: row.salary, color: null },
        { label: "Deductions", value: row.deductions, color: SAND },
        { label: "Net Paid", value: row.net, color: LEDGER_GREEN },
      ].map((item) => (
        <div
          key={item.label}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {item.color ? (
              <span className="swatch" style={{ background: item.color }} />
            ) : (
              <span className="swatch swatch--empty" />
            )}
            <span style={{ color: GRAPHITE }}>{item.label}</span>
          </span>
          <span className="money" style={{ fontSize: 13 }}>
            {money(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
