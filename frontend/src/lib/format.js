/* Display formatting only — every amount is computed server-side and arrives as
   a Decimal-backed string. These helpers never do money math; they only render.
   (plan.md Module 9: "all math stays server-side".) */

/* `currencyDisplay: "code"` is load-bearing, not a preference. The en-KE default
   renders KES as the localized symbol "Ksh" ("Ksh 27,000.00"), but the Excel
   export's number format is '#,##0.00 "KES"' and design.md writes "KES 27,000"
   throughout. Without "code" the screen and the file dad hands the bank would
   disagree on the label. */
const KES = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  currencyDisplay: "code",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/* Renders "KES 27,000.00". Amounts come off the API as strings ("27000.00") to
   preserve Decimal precision; Number() is applied only here, at the render edge. */
export function money(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return KES.format(n);
}

/* Same as `money` but without the currency prefix — for tables whose column
   header already carries "(KES)", where repeating it on every row is noise. */
export function amount(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function isNegative(value) {
  return Number(value) < 0;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const monthName = (month) => MONTHS[month - 1] ?? String(month);
export const monthShort = (month) => (MONTHS[month - 1] ?? "").slice(0, 3);
export const monthYear = (month, year) => `${monthName(month)} ${year}`;

/* ISO date (YYYY-MM-DD) -> "12 Jul 2026". Parsed manually rather than via
   `new Date(str)` so a date-only value is never shifted a day by the local
   timezone — a real risk for payment_date/date_taken, which are dates, not
   instants. */
export function shortDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return String(iso);
  return `${d} ${monthShort(m)} ${y}`;
}

export const todayISO = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};
