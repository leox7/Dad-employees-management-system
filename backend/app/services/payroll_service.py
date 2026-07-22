"""Payroll engine.

Lifecycle: draft -> approved (two real states; 'locked' is inert). Approve is the
single point where cached balances move — loan repayments via the shared loan_service
writer and advance draw-downs via advance_service — and it is all-or-nothing: one
transaction, one commit.

Deductions are both manual and both draw down a cached balance. loan_deduction and
advance_deduction are entered on the draft; a new draft pre-fills each with the
employee's outstanding loan / advance balance (the amount still owed) as a starting
point, which dad can then edit down. On approve each deduction is applied FIFO
(oldest first) against the employee's loans / advances, and whatever is left carries
over to a future payroll.

Immutability: gross_salary is a snapshot frozen at run creation, so later salary
edits never leak into a past run. Status guards: draft-edit requires 'draft'; delete
is allowed on a draft (no financial effect) or an approved run (its loan/advance
draw-downs are rolled back first, so the month can be re-run); GET has no guard
(readable in any status).

Net recompute (`_recompute_net`) is one function reused by draft-save and approve
— the single, highest-risk money calculation.

Warning stability across approve: the "deduction exceeds outstanding balance" flags
(loan and advance) are computed against the balance *as this run saw it*. For a draft
that is just the current outstanding; for an approved run we add back what this run
drew down, so GET returns the same warning after approval as the last draft save
showed.
"""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AdvanceRepayment,
    Employee,
    EmployeeStatus,
    Loan,
    LoanRepayment,
    LoanStatus,
    PayrollLine,
    PayrollRun,
    PayrollRunStatus,
    SalaryAdvance,
)
from app.money import to_money
from app.schemas.payroll import (
    PayrollDraftUpdate,
    PayrollHistoryItem,
    PayrollLineOut,
    PayrollRunDetail,
)
from app.services import advance_service, loan_service

_ZERO = Decimal("0.00")


class PayrollError(Exception):
    """Base class for payroll service errors."""


class PayrollNotFound(PayrollError):
    """Run or line not found (maps to 404)."""


class PayrollConflict(PayrollError):
    """Invalid state transition or duplicate run (maps to 409)."""


# --------------------------------------------------------------------------- #
# Internal helpers
# --------------------------------------------------------------------------- #
def _get_run(db: Session, run_id: int) -> PayrollRun:
    run = db.get(PayrollRun, run_id)
    if run is None:
        raise PayrollNotFound(f"Payroll run {run_id} not found")
    return run


def _recompute_net(line: PayrollLine) -> Decimal:
    """The single net-pay formula. Advances and loans are both deductions."""
    return to_money(line.gross_salary - line.loan_deduction - line.advance_deduction)


def _current_outstanding(db: Session, employee_ids: list[int]) -> dict[int, Decimal]:
    if not employee_ids:
        return {}
    rows = db.execute(
        select(
            Loan.employee_id, func.coalesce(func.sum(Loan.outstanding_amount), 0)
        )
        .where(Loan.employee_id.in_(employee_ids))
        .group_by(Loan.employee_id)
    ).all()
    return {emp_id: to_money(bal) for emp_id, bal in rows}


def _repaid_by_run(db: Session, run_id: int, employee_ids: list[int]) -> dict[int, Decimal]:
    if not employee_ids:
        return {}
    rows = db.execute(
        select(Loan.employee_id, func.coalesce(func.sum(LoanRepayment.amount), 0))
        .select_from(LoanRepayment)
        .join(Loan, Loan.id == LoanRepayment.loan_id)
        .where(
            LoanRepayment.payroll_run_id == run_id,
            Loan.employee_id.in_(employee_ids),
        )
        .group_by(Loan.employee_id)
    ).all()
    return {emp_id: to_money(amt) for emp_id, amt in rows}


def _effective_outstanding(
    db: Session, run_id: int, employee_ids: list[int]
) -> dict[int, Decimal]:
    """Outstanding balance as *this run* saw it: current balance plus whatever this
    run already repaid. For a draft (no repayments yet) that equals the current
    balance; for an approved run it reconstructs the pre-approval balance."""
    current = _current_outstanding(db, employee_ids)
    repaid = _repaid_by_run(db, run_id, employee_ids)
    return {
        emp_id: to_money(current.get(emp_id, _ZERO) + repaid.get(emp_id, _ZERO))
        for emp_id in employee_ids
    }


def _current_advance_outstanding(
    db: Session, employee_ids: list[int]
) -> dict[int, Decimal]:
    if not employee_ids:
        return {}
    rows = db.execute(
        select(
            SalaryAdvance.employee_id,
            func.coalesce(func.sum(SalaryAdvance.outstanding_amount), 0),
        )
        .where(SalaryAdvance.employee_id.in_(employee_ids))
        .group_by(SalaryAdvance.employee_id)
    ).all()
    return {emp_id: to_money(bal) for emp_id, bal in rows}


def _advance_repaid_by_run(
    db: Session, run_id: int, employee_ids: list[int]
) -> dict[int, Decimal]:
    if not employee_ids:
        return {}
    rows = db.execute(
        select(SalaryAdvance.employee_id, func.coalesce(func.sum(AdvanceRepayment.amount), 0))
        .select_from(AdvanceRepayment)
        .join(SalaryAdvance, SalaryAdvance.id == AdvanceRepayment.advance_id)
        .where(
            AdvanceRepayment.payroll_run_id == run_id,
            SalaryAdvance.employee_id.in_(employee_ids),
        )
        .group_by(SalaryAdvance.employee_id)
    ).all()
    return {emp_id: to_money(amt) for emp_id, amt in rows}


def _effective_advance_outstanding(
    db: Session, run_id: int, employee_ids: list[int]
) -> dict[int, Decimal]:
    """Advance balance as *this run* saw it: current balance plus whatever this run
    drew down (from the advance_repayments ledger). For a draft (no draw-downs yet)
    that equals the current balance; for an approved run it reconstructs the
    pre-approval balance exactly — mirrors `_effective_outstanding` for loans."""
    current = _current_advance_outstanding(db, employee_ids)
    repaid = _advance_repaid_by_run(db, run_id, employee_ids)
    return {
        emp_id: to_money(current.get(emp_id, _ZERO) + repaid.get(emp_id, _ZERO))
        for emp_id in employee_ids
    }


def _line_warnings(
    line: PayrollLine, loan_outstanding: Decimal, advance_outstanding: Decimal
) -> list[str]:
    warnings: list[str] = []
    if line.net_salary < 0:
        warnings.append("Net pay is negative")
    if line.loan_deduction > loan_outstanding:
        warnings.append(
            f"Loan deduction exceeds outstanding balance ({loan_outstanding})"
        )
    if line.advance_deduction > advance_outstanding:
        warnings.append(
            f"Advance deduction exceeds remaining advance balance ({advance_outstanding})"
        )
    return warnings


def _build_detail(db: Session, run: PayrollRun) -> PayrollRunDetail:
    rows = db.execute(
        select(PayrollLine, Employee.name)
        .join(Employee, Employee.id == PayrollLine.employee_id)
        .where(PayrollLine.payroll_run_id == run.id)
        .order_by(Employee.name, PayrollLine.id)
    ).all()
    employee_ids = [line.employee_id for line, _ in rows]
    loan_outstanding = _effective_outstanding(db, run.id, employee_ids)
    advance_outstanding = _effective_advance_outstanding(db, run.id, employee_ids)

    lines = [
        PayrollLineOut(
            id=line.id,
            employee_id=line.employee_id,
            employee_name=name,
            gross_salary=line.gross_salary,
            loan_deduction=line.loan_deduction,
            advance_deduction=line.advance_deduction,
            net_salary=line.net_salary,
            warnings=_line_warnings(
                line,
                loan_outstanding.get(line.employee_id, _ZERO),
                advance_outstanding.get(line.employee_id, _ZERO),
            ),
        )
        for line, name in rows
    ]
    return PayrollRunDetail(
        id=run.id,
        month=run.month,
        year=run.year,
        status=run.status,
        created_at=run.created_at,
        approved_at=run.approved_at,
        lines=lines,
    )


# --------------------------------------------------------------------------- #
# Public operations
# --------------------------------------------------------------------------- #
def get_run(db: Session, run_id: int) -> PayrollRun:
    """Fetch the run row itself (404 if missing). Used by the export guard."""
    return _get_run(db, run_id)


def get_run_detail(db: Session, run_id: int) -> PayrollRunDetail:
    """Read a run + its lines with live warnings. No status guard."""
    return _build_detail(db, _get_run(db, run_id))


def create_run(db: Session, month: int, year: int) -> PayrollRunDetail:
    """Generate a draft run: one line per active employee, gross frozen from salary,
    and both loan_deduction and advance_deduction pre-filled with the employee's
    outstanding loan / advance balance (dad edits them down from there). 409 if a run
    for month/year exists."""
    existing = db.execute(
        select(PayrollRun).where(PayrollRun.month == month, PayrollRun.year == year)
    ).scalar_one_or_none()
    if existing is not None:
        raise PayrollConflict(f"A payroll run for {month}/{year} already exists")

    run = PayrollRun(month=month, year=year, status=PayrollRunStatus.draft)
    db.add(run)
    db.flush()  # assign run.id before creating lines

    active_employees = db.execute(
        select(Employee)
        .where(Employee.status == EmployeeStatus.active)
        .order_by(Employee.name, Employee.id)
    ).scalars().all()

    employee_ids = [emp.id for emp in active_employees]
    loan_outstanding = _current_outstanding(db, employee_ids)
    advance_outstanding = _current_advance_outstanding(db, employee_ids)

    for emp in active_employees:
        gross = to_money(emp.salary)
        loan_deduction = loan_outstanding.get(emp.id, _ZERO)
        advance_deduction = advance_outstanding.get(emp.id, _ZERO)
        line = PayrollLine(
            payroll_run_id=run.id,
            employee_id=emp.id,
            gross_salary=gross,
            loan_deduction=loan_deduction,
            advance_deduction=advance_deduction,
            net_salary=to_money(gross - loan_deduction - advance_deduction),
        )
        db.add(line)

    db.commit()
    return _build_detail(db, run)


def update_draft(db: Session, run_id: int, payload: PayrollDraftUpdate) -> PayrollRunDetail:
    """Autosave loan_deduction and advance_deduction edits and recompute net
    server-side. 409 unless draft."""
    run = _get_run(db, run_id)
    if run.status != PayrollRunStatus.draft:
        raise PayrollConflict("Only a draft run can be edited")

    lines_by_id = {
        line.id: line
        for line in db.execute(
            select(PayrollLine).where(PayrollLine.payroll_run_id == run_id)
        ).scalars().all()
    }
    for item in payload.lines:
        line = lines_by_id.get(item.id)
        if line is None:
            raise PayrollNotFound(f"Line {item.id} is not part of run {run_id}")
        line.loan_deduction = to_money(item.loan_deduction)
        line.advance_deduction = to_money(item.advance_deduction)
        line.net_salary = _recompute_net(line)

    db.commit()
    return _build_detail(db, run)


def delete_run(db: Session, run_id: int) -> None:
    """Delete a run and its lines (cascade), in one transaction.

    A draft has no financial effect, so it is simply removed. An approved run is
    rolled back first: every loan repayment and advance draw-down it made is undone
    (balances restored, ledger rows deleted) via the loan/advance services, *before*
    the run row is deleted — order matters, because deleting the run would otherwise
    SET NULL the ledger rows' payroll_run_id and lose the link. The month/year is
    then free to be generated again."""
    run = _get_run(db, run_id)
    if run.status == PayrollRunStatus.approved:
        loan_service.reverse_run(db, run_id)
        advance_service.reverse_run(db, run_id)
    db.delete(run)
    db.commit()


def approve_run(db: Session, run_id: int) -> PayrollRunDetail:
    """Approve a draft: draw down loans (FIFO by date_taken) and advances (FIFO by
    advance_date), set approved. Single transaction, all-or-nothing. 409 unless
    draft."""
    run = _get_run(db, run_id)
    if run.status != PayrollRunStatus.draft:
        raise PayrollConflict("Only a draft run can be approved")

    lines = db.execute(
        select(PayrollLine).where(PayrollLine.payroll_run_id == run_id)
    ).scalars().all()

    today = date.today()
    for line in lines:
        # Defensive: recompute net from stored values before finalizing.
        line.net_salary = _recompute_net(line)

        if line.loan_deduction > 0:
            remaining = to_money(line.loan_deduction)
            active_loans = db.execute(
                select(Loan)
                .where(
                    Loan.employee_id == line.employee_id,
                    Loan.status == LoanStatus.active,
                )
                .order_by(Loan.date_taken.asc(), Loan.id.asc())  # FIFO: oldest first
            ).scalars().all()
            for loan in active_loans:
                if remaining <= 0:
                    break
                pay = min(remaining, loan.outstanding_amount)
                if pay <= 0:
                    continue
                loan_service.apply_repayment(
                    db, loan.id, pay, today, payroll_run_id=run.id
                )
                remaining = to_money(remaining - pay)
            # If remaining > 0 the deduction exceeded total owed; the allocation is
            # capped at what was actually owed (loans never go negative). This is a
            # non-blocking judgment call already surfaced live on draft save and again
            # via GET's warning; we do not silently swallow it by editing the line.

        if line.advance_deduction > 0:
            # Same FIFO draw-down for advances: oldest first, capped at each advance's
            # balance so it never goes negative. Whatever the deduction did not cover
            # stays as outstanding, to be taken off a later payroll. The over-type
            # case (deduction > total owed) is the same non-blocking judgment call as
            # loans above, flagged by the "advance exceeds balance" warning.
            remaining = to_money(line.advance_deduction)
            open_advances = db.execute(
                select(SalaryAdvance)
                .where(
                    SalaryAdvance.employee_id == line.employee_id,
                    SalaryAdvance.outstanding_amount > 0,
                )
                .order_by(SalaryAdvance.advance_date.asc(), SalaryAdvance.id.asc())
            ).scalars().all()
            for advance in open_advances:
                if remaining <= 0:
                    break
                take = min(remaining, advance.outstanding_amount)
                if take <= 0:
                    continue
                advance_service.apply_deduction(
                    db, advance.id, take, today, payroll_run_id=run.id
                )
                remaining = to_money(remaining - take)

    run.status = PayrollRunStatus.approved
    run.approved_at = datetime.now()
    db.commit()
    return _build_detail(db, run)


def list_history(db: Session) -> list[PayrollHistoryItem]:
    """All runs (newest first) with per-run summary totals."""
    runs = db.execute(
        select(PayrollRun).order_by(PayrollRun.year.desc(), PayrollRun.month.desc())
    ).scalars().all()

    agg_rows = db.execute(
        select(
            PayrollLine.payroll_run_id,
            func.count(PayrollLine.id),
            func.coalesce(func.sum(PayrollLine.gross_salary), 0),
            func.coalesce(func.sum(PayrollLine.loan_deduction), 0),
            func.coalesce(func.sum(PayrollLine.advance_deduction), 0),
            func.coalesce(func.sum(PayrollLine.net_salary), 0),
        ).group_by(PayrollLine.payroll_run_id)
    ).all()
    agg = {row[0]: row for row in agg_rows}

    items: list[PayrollHistoryItem] = []
    for run in runs:
        row = agg.get(run.id)
        items.append(
            PayrollHistoryItem(
                id=run.id,
                month=run.month,
                year=run.year,
                status=run.status,
                created_at=run.created_at,
                approved_at=run.approved_at,
                employee_count=row[1] if row else 0,
                total_gross=to_money(row[2]) if row else _ZERO,
                total_loan_deduction=to_money(row[3]) if row else _ZERO,
                total_advance_deduction=to_money(row[4]) if row else _ZERO,
                total_net=to_money(row[5]) if row else _ZERO,
            )
        )
    return items
