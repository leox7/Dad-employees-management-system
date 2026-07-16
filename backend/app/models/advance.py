"""salary_advances: recorded real-time, auto-deducted in full at payroll.
Explicit month/year columns make "which draft owns this" a plain equality filter."""
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Index, Numeric, SmallInteger, text
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
    advance_date: Mapped[date] = mapped_column(Date, nullable=False)
    month: Mapped[int] = mapped_column(TINYINT, nullable=False)  # payroll month this applies to
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    # Set once consumed by a payroll run; NULL means "not yet deducted".
    payroll_run_id: Mapped[int | None] = mapped_column(
        ForeignKey("payroll_runs.id", ondelete="SET NULL"), nullable=True
    )
