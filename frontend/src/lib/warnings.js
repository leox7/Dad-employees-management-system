/* Warning copy.

   The backend decides *whether* a line warrants a warning; this module decides
   how that reads on screen. The two are deliberately split because the server's
   strings are terse ("Net pay is negative") while design.md §7 asks for the
   plain fact and its size ("Advance exceeds salary by KES 3,000"). Nothing here
   invents a warning the server didn't raise — with one documented exception,
   below.

   Backend strings, verbatim, from payroll_service._line_warnings:
     "Net pay is negative"
     "Loan deduction exceeds outstanding balance (12000.00)"
*/

import { money } from "./format";
import { fromCents } from "./cents";

const NEGATIVE_NET = "Net pay is negative";
const EXCEEDS_PREFIX = "Loan deduction exceeds outstanding balance";

/* The negative-net case is the exception noted above: it is recomputed locally
   rather than read off the server's list. It is exactly derivable from the line
   in front of us (net < 0), and dad needs it the keystroke it becomes true, not
   one autosave later. The server raises the identical flag on save — this only
   moves it earlier. */
export function negativeNetWarning(netCentsValue, loanDeduction) {
  if (netCentsValue >= 0) return null;
  const shortfall = money(fromCents(Math.abs(netCentsValue)));
  // Name the actual cause. With no loan deduction entered, the advance is the
  // only thing that can push net under zero — that is design.md's example case.
  return Number(loanDeduction) === 0
    ? `Advance exceeds salary by ${shortfall}`
    : `Deductions exceed salary by ${shortfall}`;
}

/* The outstanding balance is not on the payroll line, so this warning can only
   come from the server, which puts the real balance in a parenthetical. Pull it
   out and restate it in the design's voice; if the string ever stops matching,
   fall through to showing the server's own words rather than dropping a money
   warning on the floor. */
export function loanExceedsWarning(serverWarnings = []) {
  const raw = serverWarnings.find((w) => w.startsWith(EXCEEDS_PREFIX));
  if (!raw) return null;

  const match = /\(([\d.]+)\)/.exec(raw);
  if (!match) return raw;
  return `Loan deduction exceeds outstanding balance of ${money(match[1])}`;
}

/* The full list for one row: locally-derived negative net (instant) plus the
   server's loan-balance flag (refreshed on each autosave). The server's own
   negative-net string is dropped — negativeNetWarning already covers it, with
   the shortfall spelled out.

   `effectiveLoanDeduction` is what's in the input right now, which during the
   autosave window is ahead of line.loan_deduction. */
export function lineWarnings(line, netCentsValue, effectiveLoanDeduction) {
  const server = line.warnings ?? [];
  return [
    negativeNetWarning(netCentsValue, effectiveLoanDeduction),
    loanExceedsWarning(server.filter((w) => w !== NEGATIVE_NET)),
  ].filter(Boolean);
}
