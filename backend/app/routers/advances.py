"""Salary advance routes.

- POST /advances                log a new advance (a reference record of cash given)
- GET  /advances/employee/{id}  per-employee advance history

Advances are a plain record: the deduction is entered manually on the payroll draft,
so there is no repay endpoint and no balance tracked here.

All routes require authentication.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db import get_db
from app.models import Employee, SalaryAdvance
from app.money import to_money
from app.schemas.advance import AdvanceCreate, AdvanceOut

router = APIRouter(
    prefix="/advances", tags=["advances"], dependencies=[Depends(get_current_user)]
)


@router.post("", response_model=AdvanceOut, status_code=status.HTTP_201_CREATED)
def create_advance(payload: AdvanceCreate, db: Session = Depends(get_db)) -> SalaryAdvance:
    if db.get(Employee, payload.employee_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found"
        )
    amount = to_money(payload.amount)
    advance = SalaryAdvance(
        employee_id=payload.employee_id,
        amount=amount,
        outstanding_amount=amount,  # nothing deducted yet — full amount is owed
        advance_date=payload.advance_date,
        month=payload.month,
        year=payload.year,
        payroll_run_id=None,
    )
    db.add(advance)
    db.commit()
    db.refresh(advance)
    return advance


@router.get("/employee/{employee_id}", response_model=list[AdvanceOut])
def advances_for_employee(
    employee_id: int, db: Session = Depends(get_db)
) -> list[SalaryAdvance]:
    if db.get(Employee, employee_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found"
        )
    return list(
        db.execute(
            select(SalaryAdvance)
            .where(SalaryAdvance.employee_id == employee_id)
            .order_by(SalaryAdvance.advance_date, SalaryAdvance.id)
        )
        .scalars()
        .all()
    )
