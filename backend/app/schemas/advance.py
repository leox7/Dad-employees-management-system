"""Salary advance request/response schemas."""
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class AdvanceCreate(BaseModel):
    employee_id: int
    amount: Decimal = Field(gt=0)
    advance_date: date
    month: int = Field(ge=1, le=12)  # payroll month this advance applies to
    year: int = Field(ge=2000, le=2100)


class AdvanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    amount: Decimal
    advance_date: date
    month: int
    year: int
    payroll_run_id: int | None
