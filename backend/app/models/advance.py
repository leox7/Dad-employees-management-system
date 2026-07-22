"""salary_advances + advance_repayments (fully symmetric with loans).

Like loans, `salary_advances.outstanding_amount` is a CACHED, STORED balance — the
amount still to be deducted — not derived on read. A payroll draft pre-fills the
advance deduction with this balance; whatever is actually deducted on approve is
subtracted here (FIFO, oldest advance first) via `services.advance_service`, the
single writer of this column, which records each draw-down as an advance_repayments
row. The remainder carries over to a later payroll — whichever month dad chooses.
`amount` stays as the original sum given.

The advance_repayments ledger is what makes deleting an approved run reversible: each
draw-down carries its payroll_run_id, so a run's effect can be added back exactly.

The month/year columns are just a note of which payroll the advance relates to; they
no longer bind the deduction to one run. `payroll_run_id` on salary_advances is a
legacy column from the old auto-deduct design and is no longer written by the app.
"""
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Index, Numeric, SmallInteger
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class SalaryAdvance(Base):
    __tablename__ = "salary_advances"
    __table_args__ = (
        Index("idx_advances_employee_month", "employee_id", "year", "month"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    # Cached running balance still to be deducted — see module docstring above.
    outstanding_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    advance_date: Mapped[date] = mapped_column(Date, nullable=False)
    month: Mapped[int] = mapped_column(TINYINT, nullable=False)  # payroll month this relates to (a note)
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    # Legacy: no longer written by the app (kept so old rows still load).
    payroll_run_id: Mapped[int | None] = mapped_column(
        ForeignKey("payroll_runs.id", ondelete="SET NULL"), nullable=True
    )


class AdvanceRepayment(Base):
    """One draw-down against a single advance — the mirror of LoanRepayment. Written
    only through advance_service, and the audit trail that makes an approved run's
    advance deductions reversible on delete."""

    __tablename__ = "advance_repayments"
    __table_args__ = (Index("idx_advance_repayments_advance", "advance_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    advance_id: Mapped[int] = mapped_column(
        ForeignKey("salary_advances.id", ondelete="CASCADE"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    # NULL if the run that made it was later deleted (kept for symmetry with loans).
    payroll_run_id: Mapped[int | None] = mapped_column(
        ForeignKey("payroll_runs.id", ondelete="SET NULL"), nullable=True
    )
