"""Advance balance service (mirror of loan_service).

`salary_advances.outstanding_amount` is a CACHED, STORED balance (the amount still
to be deducted), not derived on read. `apply_deduction` is the SINGLE writer that
decrements it — payroll approval draws advances down here, FIFO by date — and it
records each draw-down in the advance_repayments ledger. `reverse_run` is the only
other writer: it adds a deleted run's draw-downs back and removes their ledger rows.

Transaction ownership: both functions flush but do NOT commit. The caller owns the
transaction boundary — payroll approval / deletion calls them and commits once, so
the operation stays all-or-nothing.
"""
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AdvanceRepayment, SalaryAdvance
from app.money import to_money


class AdvanceDeductionError(ValueError):
    """Raised when a deduction is invalid (non-positive, or exceeds the balance)."""


def apply_deduction(
    db: Session,
    advance_id: int,
    amount: Decimal,
    payment_date: date,
    payroll_run_id: int | None = None,
) -> AdvanceRepayment:
    """Draw one advance down by `amount` in the caller's transaction.

    Insert an advance_repayments row, decrement the cached outstanding_amount; never
    let it go negative (the caller caps each allocation at what is owed, exactly as
    the loan FIFO split does).
    """
    advance = db.get(SalaryAdvance, advance_id)
    if advance is None:
        raise AdvanceDeductionError(f"Advance {advance_id} not found")

    amount = to_money(amount)
    if amount <= 0:
        raise AdvanceDeductionError("Deduction amount must be greater than 0")
    if amount > advance.outstanding_amount:
        raise AdvanceDeductionError(
            "Deduction amount exceeds the advance's outstanding balance"
        )

    repayment = AdvanceRepayment(
        advance_id=advance.id,
        amount=amount,
        payment_date=payment_date,
        payroll_run_id=payroll_run_id,
    )
    db.add(repayment)

    advance.outstanding_amount = to_money(advance.outstanding_amount - amount)
    db.flush()
    return repayment


def reverse_run(db: Session, run_id: int) -> None:
    """Undo every advance draw-down a run made, in the caller's transaction.

    For each advance this run drew from, add the drawn amount back to the cached
    outstanding_amount and delete the ledger row. Restoring only what was taken keeps
    the balance from ever exceeding the original `amount`.
    """
    repayments = db.execute(
        select(AdvanceRepayment).where(AdvanceRepayment.payroll_run_id == run_id)
    ).scalars().all()
    for repayment in repayments:
        advance = db.get(SalaryAdvance, repayment.advance_id)
        if advance is not None:
            advance.outstanding_amount = to_money(
                advance.outstanding_amount + repayment.amount
            )
        db.delete(repayment)
    db.flush()


def get_outstanding_balance(db: Session, employee_id: int) -> Decimal:
    """Total advance balance still to be deducted across all of an employee's advances.

    Cheap SUM of the stored outstanding_amount column (fully-deducted advances
    contribute 0), not a ledger scan.
    """
    total = db.execute(
        select(func.coalesce(func.sum(SalaryAdvance.outstanding_amount), 0)).where(
            SalaryAdvance.employee_id == employee_id
        )
    ).scalar_one()
    return to_money(total)
