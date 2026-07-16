"""Payroll run / line request & response schemas.

`PayrollLineOut.warnings` carries the live, non-blocking flags the draft-save path
computes — negative net pay, and loan_deduction exceeding the employee's
outstanding balance. The same flags come back from GET so a reload/history-nav
renders identically to the last draft save.
"""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.payroll import PayrollRunStatus


class PayrollRunCreate(BaseModel):
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2100)


class PayrollLineDraftUpdate(BaseModel):
    id: int  # payroll_lines.id
    loan_deduction: Decimal = Field(ge=0)


class PayrollDraftUpdate(BaseModel):
    """Autosave payload. Only `loan_deduction` is editable; gross_salary and
    advance_deduction are system-generated and read-only."""

    lines: list[PayrollLineDraftUpdate]


class PayrollLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    employee_name: str | None = None
    gross_salary: Decimal
    loan_deduction: Decimal
    advance_deduction: Decimal
    net_salary: Decimal
    warnings: list[str] = []


class PayrollRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    month: int
    year: int
    status: PayrollRunStatus
    created_at: datetime | None
    approved_at: datetime | None


class PayrollRunDetail(PayrollRunOut):
    lines: list[PayrollLineOut] = []


class PayrollHistoryItem(PayrollRunOut):
    employee_count: int
    total_gross: Decimal
    total_loan_deduction: Decimal
    total_advance_deduction: Decimal
    total_net: Decimal
