"""Employee request & response schemas."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.employee import EmployeeStatus


class EmployeeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    phone: str = Field(min_length=1, max_length=20)
    salary: Decimal = Field(gt=0)


class EmployeeUpdate(BaseModel):
    """Partial update. Salary edits are allowed freely — history immutability lives
    at the payroll-line snapshot level, not on the employee record."""

    name: str | None = Field(default=None, min_length=1, max_length=150)
    phone: str | None = Field(default=None, min_length=1, max_length=20)
    salary: Decimal | None = Field(default=None, gt=0)
    # Allows reactivating a previously deactivated employee.
    status: EmployeeStatus | None = None


class EmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: str
    salary: Decimal
    status: EmployeeStatus
    created_at: datetime | None
