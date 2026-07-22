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
     "Advance deduction exceeds remaining advance balance (12000.00)"
*/

import { money } from "./format";
import { fromCents } from "./cents";

const NEGATIVE_NET = "Net pay is negative";
const LOAN_EXCEEDS_PREFIX = "Loan deduction exceeds outstanding balance";
const ADVANCE_EXCEEDS_PREFIX = "Advance deduction exceeds remaining advance balance";

/* The negative-net case is the exception noted above: it is recomputed locally
   rather than read off the server's list. It is exactly derivable from the line
   in front of us (net < 0), and dad needs it the keystroke it becomes true, not
   one autosave later. The server raises the identical flag on save — this only
   moves it earlier. */
export function negativeNetWarning(netCentsValue, loanDeduction, advanceDeduction) {
  if (netCentsValue >= 0) return null;
  const shortfall = money(fromCents(Math.abs(netCentsValue)));
  // Name the actual cause when only one kind of deduction is in play; otherwise
  // both are pushing net under zero, so speak of deductions in general.
  const hasLoan = Number(loanDeduction) > 0;
  const hasAdvance = Number(advanceDeduction) > 0;
  if (hasAdvance && !hasLoan) return `Advance exceeds salary by ${shortfall}`;
  if (hasLoan && !hasAdvance) return `Loan deduction exceeds salary by ${shortfall}`;
  return `Deductions exceed salary by ${shortfall}`;
}

/* The outstanding balances are not on the payroll line, so these warnings can only
   come from the server, which puts the real balance in a parenthetical. Pull it out
   and restate it in the design's voice; if the string ever stops matching, fall
   through to showing the server's own words rather than dropping a money warning on
   the floor. */
function balanceWarning(serverWarnings, prefix, restate) {
  const raw = serverWarnings.find((w) => w.startsWith(prefix));
  if (!raw) return null;

  const match = /\(([\d.]+)\)/.exec(raw);
  if (!match) return raw;
  return restate(money(match[1]));
}

export function loanExceedsWarning(serverWarnings = []) {
  return balanceWarning(
    serverWarnings,
    LOAN_EXCEEDS_PREFIX,
    (bal) => `Loan deduction exceeds outstanding balance of ${bal}`
  );
}

export function advanceExceedsWarning(serverWarnings = []) {
  return balanceWarning(
    serverWarnings,
    ADVANCE_EXCEEDS_PREFIX,
    (bal) => `Advance deduction exceeds remaining balance of ${bal}`
  );
}

/* The full list for one row: locally-derived negative net (instant) plus the
   server's loan-balance flag (refreshed on each autosave). The server's own
   negative-net string is dropped — negativeNetWarning already covers it, with
   the shortfall spelled out.

   `effectiveLoanDeduction`/`effectiveAdvanceDeduction` are what's in the inputs
   right now, which during the autosave window are ahead of the saved line. */
export function lineWarnings(
  line,
  netCentsValue,
  effectiveLoanDeduction,
  effectiveAdvanceDeduction
) {
  const server = (line.warnings ?? []).filter((w) => w !== NEGATIVE_NET);
  return [
    negativeNetWarning(
      netCentsValue,
      effectiveLoanDeduction,
      effectiveAdvanceDeduction
    ),
    loanExceedsWarning(server),
    advanceExceedsWarning(server),
  ].filter(Boolean);
}
