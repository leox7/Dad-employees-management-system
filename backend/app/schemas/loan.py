"""Loan & repayment request/response schemas."""
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.loan import LoanStatus


class LoanCreate(BaseModel):
    employee_id: int
    loan_amount: Decimal = Field(gt=0)
    date_taken: date


class RepaymentCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    payment_date: date | None = None  # defaults to today when omitted


class LoanRepaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    loan_id: int
    amount: Decimal
    payment_date: date
    payroll_run_id: int | None


class LoanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    loan_amount: Decimal
    outstanding_amount: Decimal
    date_taken: date
    status: LoanStatus
    created_at: datetime | None


class LoanWithRepayments(LoanOut):
    """Loan plus its full repayment ledger — the view dad eyeballs against the book."""

    repayments: list[LoanRepaymentOut] = []
