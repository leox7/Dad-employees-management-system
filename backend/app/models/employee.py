"""employees. "Deleting" an employee is a soft delete (status='inactive');
FKs from loans/salary_advances/payroll_lines use ON DELETE RESTRICT as a backstop."""
import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Enum as SAEnum, Numeric, String, TIMESTAMP, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class EmployeeStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    salary: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[EmployeeStatus] = mapped_column(
        SAEnum(EmployeeStatus, values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        server_default=text("'active'"),
    )
    # Nullable to match the live DDL (MySQL TIMESTAMP DEFAULT CURRENT_TIMESTAMP).
    created_at: Mapped[datetime | None] = mapped_column(TIMESTAMP, server_default=func.now())
