"""Dashboard routes (read-only aggregates).

- GET /dashboard/summary        four headline numbers
- GET /dashboard/monthly-trend  per-month totals across approved runs

All routes require authentication.
"""
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db import get_db
from app.models import (
    Employee,
    EmployeeStatus,
    Loan,
    PayrollLine,
    PayrollRun,
    PayrollRunStatus,
    SalaryAdvance,
)
from app.money import to_money
from app.schemas.dashboard import DashboardSummary, MonthlyTrendItem

router = APIRouter(
    prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(get_current_user)]
)

_ZERO = Decimal("0.00")


@router.get("/summary", response_model=DashboardSummary)
def summary(db: Session = Depends(get_db)) -> DashboardSummary:
    active_employee_count = db.execute(
        select(func.count(Employee.id)).where(Employee.status == EmployeeStatus.active)
    ).scalar_one()

    today = date.today()
    current_run = db.execute(
        select(PayrollRun).where(
            PayrollRun.month == today.month,
            PayrollRun.year == today.year,
            PayrollRun.status == PayrollRunStatus.approved,
        )
    ).scalar_one_or_none()

    # Defaults to 0 when the current month has no approved run yet.
    current_month_total = _ZERO
    if current_run is not None:
        current_month_total = to_money(
            db.execute(
                select(func.coalesce(func.sum(PayrollLine.net_salary), 0)).where(
                    PayrollLine.payroll_run_id == current_run.id
                )
            ).scalar_one()
        )

    total_outstanding_loans = to_money(
        db.execute(
            select(func.coalesce(func.sum(Loan.outstanding_amount), 0))
        ).scalar_one()
    )

    total_unconsumed_advances = to_money(
        db.execute(
            select(func.coalesce(func.sum(SalaryAdvance.amount), 0)).where(
                SalaryAdvance.payroll_run_id.is_(None)
            )
        ).scalar_one()
    )

    return DashboardSummary(
        active_employee_count=active_employee_count,
        current_month=today.month,
        current_year=today.year,
        current_month_payroll_total=current_month_total,
        current_month_has_approved_run=current_run is not None,
        total_outstanding_loans=total_outstanding_loans,
        total_unconsumed_advances=total_unconsumed_advances,
    )


@router.get("/monthly-trend", response_model=list[MonthlyTrendItem])
def monthly_trend(db: Session = Depends(get_db)) -> list[MonthlyTrendItem]:
    """Approved runs only — drafts must not skew the trend. Chronological order.

    `total_deductions` is `total_salary - net_paid` by construction; both are
    summed independently here so the three numbers can be reconciled.
    """
    rows = db.execute(
        select(
            PayrollRun.year,
            PayrollRun.month,
            func.coalesce(func.sum(PayrollLine.gross_salary), 0),
            func.coalesce(
                func.sum(PayrollLine.loan_deduction + PayrollLine.advance_deduction), 0
            ),
            func.coalesce(func.sum(PayrollLine.net_salary), 0),
        )
        .select_from(PayrollRun)
        .join(PayrollLine, PayrollLine.payroll_run_id == PayrollRun.id)
        .where(PayrollRun.status == PayrollRunStatus.approved)
        .group_by(PayrollRun.year, PayrollRun.month)
        .order_by(PayrollRun.year.asc(), PayrollRun.month.asc())
    ).all()

    return [
        MonthlyTrendItem(
            month=month,
            year=year,
            total_salary=to_money(total_salary),
            total_deductions=to_money(total_deductions),
            net_paid=to_money(net_paid),
        )
        for year, month, total_salary, total_deductions, net_paid in rows
    ]
