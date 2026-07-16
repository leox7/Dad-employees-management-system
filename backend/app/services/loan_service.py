"""Loan balance service.

`loans.outstanding_amount` is a CACHED, STORED balance (not derived from the
loan_repayments ledger). `apply_repayment` is the SINGLE writer that mutates it:
every repayment — manual (Module 4) or payroll-approval FIFO split (Module 5) —
goes through here. Nothing else may touch `outstanding_amount`. Keeping one code
path is what prevents cached-balance drift.

Transaction ownership: `apply_repayment` flushes but does NOT commit. The caller
owns the transaction boundary — the manual repay endpoint commits after one call;
payroll approval calls it many times and commits once, so approval stays
all-or-nothing.
"""
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Loan, LoanRepayment, LoanStatus
from app.money import to_money


class RepaymentError(ValueError):
    """Raised when a repayment is invalid (non-positive, or exceeds the balance)."""


def apply_repayment(
    db: Session,
    loan_id: int,
    amount: Decimal,
    payment_date: date,
    payroll_run_id: int | None = None,
) -> LoanRepayment:
    """Record one repayment against a single loan.

    In the caller's transaction: insert a loan_repayments row, decrement the
    loan's cached outstanding_amount, and flip status to 'paid' at zero.
    """
    loan = db.get(Loan, loan_id)
    if loan is None:
        raise RepaymentError(f"Loan {loan_id} not found")

    amount = to_money(amount)
    if amount <= 0:
        raise RepaymentError("Repayment amount must be greater than 0")
    if amount > loan.outstanding_amount:
        raise RepaymentError(
            "Repayment amount exceeds the loan's outstanding balance"
        )

    repayment = LoanRepayment(
        loan_id=loan.id,
        amount=amount,
        payment_date=payment_date,
        payroll_run_id=payroll_run_id,
    )
    db.add(repayment)

    loan.outstanding_amount = to_money(loan.outstanding_amount - amount)
    if loan.outstanding_amount == 0:
        loan.status = LoanStatus.paid

    db.flush()
    return repayment


def get_outstanding_balance(db: Session, employee_id: int) -> Decimal:
    """Total outstanding across all of an employee's loans.

    Cheap SUM of the stored outstanding_amount column (paid loans contribute 0),
    not a ledger scan.
    """
    total = db.execute(
        select(func.coalesce(func.sum(Loan.outstanding_amount), 0)).where(
            Loan.employee_id == employee_id
        )
    ).scalar_one()
    return to_money(total)
