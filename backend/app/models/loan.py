"""loans + loan_repayments.

IMPORTANT: `loans.outstanding_amount` is a CACHED, STORED balance — it is NOT
computed from the loan_repayments ledger on read. Correctness depends on every
repayment going through `services.loan_service.apply_repayment`, which is the
single writer that decrements this column (and flips status to 'paid' at zero)
in the same transaction it inserts the repayment. Never update it elsewhere,
and never assume it is derived and recompute it from repayments.
"""
import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Date,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Numeric,
    TIMESTAMP,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class LoanStatus(str, enum.Enum):
    active = "active"
    paid = "paid"


class Loan(Base):
    __tablename__ = "loans"
    __table_args__ = (Index("idx_loans_employee", "employee_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False
    )
    loan_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    # Cached running balance — see module docstring above.
    outstanding_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    date_taken: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[LoanStatus] = mapped_column(
        SAEnum(LoanStatus, values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        server_default=text("'active'"),
    )
    # Nullable to match the live DDL (MySQL TIMESTAMP DEFAULT CURRENT_TIMESTAMP).
    created_at: Mapped[datetime | None] = mapped_column(TIMESTAMP, server_default=func.now())


class LoanRepayment(Base):
    __tablename__ = "loan_repayments"
    __table_args__ = (Index("idx_loan_repayments_loan", "loan_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    loan_id: Mapped[int] = mapped_column(
        ForeignKey("loans.id", ondelete="CASCADE"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    # NULL when the repayment was manual (outside a payroll run).
    payroll_run_id: Mapped[int | None] = mapped_column(
        ForeignKey("payroll_runs.id", ondelete="SET NULL"), nullable=True
    )
