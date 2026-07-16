"""ORM models. Importing this package registers every table on Base.metadata,
which Alembic's env.py relies on for autogenerate."""
from app.models.user import User
from app.models.employee import Employee, EmployeeStatus
from app.models.loan import Loan, LoanRepayment, LoanStatus
from app.models.advance import SalaryAdvance
from app.models.payroll import PayrollLine, PayrollRun, PayrollRunStatus

__all__ = [
    "User",
    "Employee",
    "EmployeeStatus",
    "Loan",
    "LoanRepayment",
    "LoanStatus",
    "SalaryAdvance",
    "PayrollLine",
    "PayrollRun",
    "PayrollRunStatus",
]
