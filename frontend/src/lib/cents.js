/* Client-side money arithmetic exists for exactly one reason: the draft table's
   live net-salary preview, which must update the instant dad types rather than
   waiting on the autosave round-trip (design.md §5).

   Every figure here is provisional. The server recomputes net on every draft
   save and its response overwrites whatever this produced — `_recompute_net` in
   payroll_service.py is the only authority on what a net salary actually is.

   The math runs in integer cents, never in floats: 0.1 + 0.2 !== 0.3 in
   JavaScript, and a payroll table is the last place to discover that. */

export function toCents(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

export const fromCents = (cents) => cents / 100;

export const sumCents = (values) =>
  values.reduce((total, value) => total + toCents(value), 0);

/* Mirrors the server's formula: advances and loans are both deductions. */
export const netCents = (gross, loanDeduction, advanceDeduction) =>
  toCents(gross) - toCents(loanDeduction) - toCents(advanceDeduction);
