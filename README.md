# Payroll

A small payroll tool that replaces a handwritten ledger book: track employees,
loans, salary advances, and run monthly payroll with an approval gate and a
bank-ready Excel export. Two users — an operator (dad) and an admin.

## Stack

- **Backend:** FastAPI + SQLAlchemy 2 + MySQL (PyMySQL), Alembic, JWT auth (bcrypt + python-jose), openpyxl
- **Frontend:** React (Vite), React Router, Recharts, Axios

## Prerequisites

- Python 3.12+ (developed on 3.14)
- Node.js 20+
- MySQL 8 running locally, reachable at `127.0.0.1:3306`

## First-time setup

### 1. Database

```bash
mysql -u root -p < Database/payroll-db.sql
```

This creates the `payroll_db` database and all seven tables. It's safe to run
more than once — the script uses `CREATE DATABASE IF NOT EXISTS`, so it will
never drop or touch an existing database. From this point forward, any schema
*changes* go through Alembic migrations, not by re-editing this file.

### 2. Backend

```bash
cd backend
python -m venv venv
./venv/Scripts/activate        # Windows; use `source venv/bin/activate` on macOS/Linux
pip install -r requirements.txt

cp .env.example .env
```

Edit `backend/.env`:
- `DATABASE_URL` — your MySQL connection string. **URL-encode special characters
  in the password** (e.g. `#` → `%23`), or SQLAlchemy will fail to parse it.
- `SECRET_KEY` — generate one: `python -c "import secrets; print(secrets.token_urlsafe(48))"`
- `DAD_EMAIL` / `DAD_PASSWORD` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` — the two
  login accounts that get created below.

Stamp the schema as the Alembic baseline (the tables already exist from step 1,
so this records the current state rather than trying to recreate it):

```bash
alembic stamp head
```

Seed the two users (safe to re-run — it skips any email that already exists):

```bash
python -m app.seed
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
```

`frontend/.env` only needs `VITE_API_BASE_URL` — the default
(`http://127.0.0.1:8000`) matches the backend's default port, so you likely
don't need to change it.

## Running

Two terminals, backend first:

```bash
# Terminal 1 — backend
cd backend
./venv/Scripts/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
# Terminal 2 — frontend
cd frontend
npm run dev
```

Open **http://localhost:5173** and log in with the seeded credentials.

> The frontend must run on port 5173 exactly — the backend's `CORS_ORIGINS`
> allowlists that origin specifically. If Vite reports the port is taken and
> picks 5174 instead, API calls will fail with CORS errors; free up 5173
> instead of letting it fall back.

API docs (interactive): http://127.0.0.1:8000/docs

## How it works

- **Employees** have a soft-delete (`status: active/inactive`) — history is
  never lost, and a salary edit only affects *future* payroll runs. Past runs
  keep a frozen snapshot of gross salary at the time they were created.
- **Loans** are manual and long-lived. `outstanding_amount` is a cached,
  server-maintained balance — every repayment (manual or via payroll) goes
  through one function that keeps it correct.
- **Advances** carry a running `outstanding_amount` balance, just like loans. The
  balance is only drawn down by the payroll deduction (oldest advance first) on
  approve — there is no manual repay screen — and whatever dad doesn't take stays
  outstanding for a later month.
- **Payroll runs** have exactly two real states: `draft → approved`. A draft
  can be freely edited or scrapped; both the loan and advance deductions are
  pre-filled with the employee's outstanding balances and dad edits them down before
  approving. Approving is the one irreversible action — it draws down loans and
  advances (oldest first) and unlocks the Excel export. Nothing financial happens
  until that moment.
- **Currency is KES throughout** — API, UI, and the Excel export all agree on
  the label (`KES`, not the locale's `Ksh` symbol).
- **Excel export** mirrors the bank's bulk-upload template (`excel/payroll_export.xlsx`):
  a Total row and two audit "Check" rows (deductions total, and a
  gross − deductions = net reconciliation) ship alongside the per-employee data,
  followed by a **Salary Disbursement Summary** table — the bank's actual upload
  payload: one row per employee with Phone Number, Amount (a stored value equal to
  that employee's Net Salary above, plain number with no "KES" — the bank reads the
  raw cells and doesn't recalculate formulas), and a fixed "salary" comment.

## Project structure

```
backend/
  app/
    models/        SQLAlchemy models (mirror the DB schema exactly)
    schemas/        Pydantic request/response shapes
    routers/        API endpoints
    services/        Business logic (payroll engine, loan ledger, Excel export)
    auth/           JWT + password hashing
  alembic/          Schema migrations (used after the initial payroll-db.sql)
frontend/
  src/
    api/            One module per backend resource
    pages/          One screen per route
    components/      Shared UI (draft table, nav, dialogs, icons)
    lib/            Formatting, warning text, cents-safe math
Database/
  payroll-db.sql    Initial schema (run once per environment; safe to re-run)
excel/
  payroll_export.xlsx   Reference bank bulk-upload template
```

## Notes

- Never commit `backend/.env` or `frontend/.env` — both are git-ignored.
  `.env.example` in each directory documents the required keys.
- `.claude/` (planning notes) is intentionally git-ignored and not part of the
  shipped project.
