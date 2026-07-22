"""Dashboard response schemas."""
from decimal import Decimal

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    active_employee_count: int
    # The month the "current month payroll" figure refers to.
    current_month: int
    current_year: int
    # SUM(net_salary) of the current month's run when one exists AND is approved,
    # otherwise 0. `current_month_has_approved_run` lets the UI tell "0 because no
    # run yet" apart from a genuine 0.
    current_month_payroll_total: Decimal
    current_month_has_approved_run: bool
    total_outstanding_loans: Decimal
    # Sum of advance balances still to be deducted across all employees — the advance
    # parallel to total_outstanding_loans.
    total_outstanding_advances: Decimal


class MonthlyTrendItem(BaseModel):
    month: int
    year: int
    total_salary: Decimal
    total_deductions: Decimal
    net_paid: Decimal
