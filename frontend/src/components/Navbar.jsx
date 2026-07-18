import { NavLink } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import Icon from "./icons";

/* Five destinations, same order in both layouts (design.md §4): a persistent
   left sidebar on desktop, a bottom tab bar on mobile. No hamburger, no nesting
   — nothing is ever hidden behind a tap. */
const LINKS = [
  { to: "/", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/employees", label: "Employees", icon: "employees" },
  { to: "/loans", label: "Loans", icon: "loans" },
  { to: "/advances", label: "Advances", icon: "advances" },
  { to: "/payroll", label: "Payroll", icon: "payroll" },
];

export function Sidebar() {
  const { user, signOut } = useAuth();

  return (
    <nav className="sidebar" aria-label="Main">
      <div className="sidebar__brand">
        <div className="section-header">Payroll</div>
        <div className="caption" style={{ marginTop: 2 }}>
          Ledger
        </div>
      </div>

      <div className="sidebar__nav">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `nav-item${isActive ? " nav-item--active" : ""}`
            }
          >
            <Icon name={link.icon} size={18} />
            {link.label}
          </NavLink>
        ))}
      </div>

      <div className="sidebar__foot">
        <div className="caption">Signed in</div>
        <div style={{ marginBottom: 12 }}>{user?.username ?? "—"}</div>
        <button type="button" className="btn btn--secondary btn--small" onClick={signOut}>
          Sign out
        </button>
      </div>
    </nav>
  );
}

export function BottomBar() {
  return (
    <nav className="bottom-bar" aria-label="Main">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) =>
            `bottom-bar__item${isActive ? " bottom-bar__item--active" : ""}`
          }
        >
          <Icon name={link.icon} size={20} />
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
