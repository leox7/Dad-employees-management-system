"""payroll_runs + payroll_lines.

Lifecycle note: the DB ENUM defines 'draft', 'approved' AND 'locked', but the
application only ever writes/checks 'draft' and 'approved'. 'locked' is inert —
never produced, never a valid transition target — kept only to match the live
column. Activating it later is one column + one endpoint, not built now.

Immutability lives at the line level: `gross_salary` is a snapshot frozen at run
creation, so a later edit to `employees.salary` never leaks into a past run.
`loan_deduction` is a single number per employee per run (not one per loan).
`net_salary = gross_salary - loan_deduction - advance_deduction` and may go
negative (warning handled in app logic, not a DB constraint).
"""
import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Enum as SAEnum,
    ForeignKey,
    Index,
    Numeric,
    SmallInteger,
    TIMESTAMP,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PayrollRunStatus(str, enum.Enum):
    draft = "draft"
    approved = "approved"
    locked = "locked"  # defined in the DB but inert; never written/checked by the app


class PayrollRun(Base):
    __tablename__ = "payroll_runs"
    __table_args__ = (UniqueConstraint("month", "year", name="uq_month_year"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    month: Mapped[int] = mapped_column(TINYINT, nullable=False)  # 1-12
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    status: Mapped[PayrollRunStatus] = mapped_column(
        SAEnum(PayrollRunStatus, values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        server_default=text("'draft'"),
    )
    # Nullable to match the live DDL (MySQL TIMESTAMP DEFAULT CURRENT_TIMESTAMP).
    created_at: Mapped[datetime | None] = mapped_column(TIMESTAMP, server_default=func.now())
    approved_at: Mapped[datetime | None] = mapped_column(TIMESTAMP, nullable=True)


class PayrollLine(Base):
    __tablename__ = "payroll_lines"
    __table_args__ = (
        UniqueConstraint("payroll_run_id", "employee_id", name="uq_run_employee"),
        Index("idx_payroll_lines_run", "payroll_run_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    payroll_run_id: Mapped[int] = mapped_column(
        ForeignKey("payroll_runs.id", ondelete="CASCADE"), nullable=False
    )
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False
    )
    gross_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    loan_deduction: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default=text("0")
    )
    advance_deduction: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default=text("0")
    )
    net_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
