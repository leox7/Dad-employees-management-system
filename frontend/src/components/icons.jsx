/* Inline stroke icons.

   Emoji were the wrong tool here: they render as someone else's artwork in
   someone else's palette, they can't take the Ledger Green accent on an active
   nav item, and they look different on every OS. These are drawn on the same
   1.5px hairline logic as the rest of the system and inherit `currentColor`, so
   an icon is always exactly the color of the text beside it.

   Design.md §1 asks for restraint — "strong quiet typographic hierarchy instead
   of icons-and-gradients everywhere" — so these stay thin, outline-only, and
   simple enough to survive being drawn at 16px. */

const PATHS = {
  // Home
  dashboard: (
    <>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  // Two people
  employees: (
    <>
      <path d="M15.5 20.5v-1.75a3.5 3.5 0 0 0-3.5-3.5H6a3.5 3.5 0 0 0-3.5 3.5v1.75" />
      <circle cx="9" cy="8" r="3.5" />
      <path d="M21.5 20.5v-1.75a3.5 3.5 0 0 0-2.6-3.39" />
      <path d="M16 4.63a3.5 3.5 0 0 1 0 6.74" />
    </>
  ),
  /* A stack of coins — money owed, building up over time. Deliberately carries
     no currency glyph: a "$" would put a US symbol in a KES-only app, the same
     label disagreement the Ksh/KES fix in format.js exists to prevent. */
  loans: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v5c0 1.66 3.13 3 7 3s7-1.34 7-3V6" />
      <path d="M5 11v5c0 1.66 3.13 3 7 3s7-1.34 7-3v-5" />
    </>
  ),
  // A banknote — cash handed over early
  advances: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="1.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 10v4M18 10v4" />
    </>
  ),
  // A clipboard of ruled lines — the paper book this replaces
  payroll: (
    <>
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
      <path d="M8.5 12h7M8.5 16h4.5" />
    </>
  ),
  warning: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4.5" />
      <path d="M12 17.2h.01" />
    </>
  ),
};

export default function Icon({ name, size = 18, strokeWidth = 1.5 }) {
  const path = PATHS[name];
  if (!path) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      /* The label always sits beside the icon, so the icon itself is decorative
         — never the only carrier of meaning (design.md §8). */
      style={{ flexShrink: 0, display: "block" }}
    >
      {path}
    </svg>
  );
}
