"""Loan routes.

- POST /loans                 log a new loan (outstanding = loan_amount, active)
- POST /loans/{id}/repay      manual repayment (goes through loan_service)
- GET  /loans/employee/{id}   per-employee loan ledger (loans + their repayments)

All routes require authentication.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db import get_db
from app.models import Employee, Loan, LoanRepayment, LoanStatus
from app.money import to_money
from app.schemas.loan import (
    LoanCreate,
    LoanOut,
    LoanRepaymentOut,
    LoanWithRepayments,
    RepaymentCreate,
)
from app.services import loan_service

router = APIRouter(
    prefix="/loans", tags=["loans"], dependencies=[Depends(get_current_user)]
)


def _loan_with_repayments(loan: Loan, repayments: list[LoanRepayment]) -> LoanWithRepayments:
    return LoanWithRepayments(
        id=loan.id,
        employee_id=loan.employee_id,
        loan_amount=loan.loan_amount,
        outstanding_amount=loan.outstanding_amount,
        date_taken=loan.date_taken,
        status=loan.status,
        created_at=loan.created_at,
        repayments=[LoanRepaymentOut.model_validate(r) for r in repayments],
    )


def _repayments_for(db: Session, loan_id: int) -> list[LoanRepayment]:
    return list(
        db.execute(
            select(LoanRepayment)
            .where(LoanRepayment.loan_id == loan_id)
            .order_by(LoanRepayment.payment_date, LoanRepayment.id)
        )
        .scalars()
        .all()
    )


@router.post("", response_model=LoanOut, status_code=status.HTTP_201_CREATED)
def create_loan(payload: LoanCreate, db: Session = Depends(get_db)) -> Loan:
    if db.get(Employee, payload.employee_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found"
        )
    amount = to_money(payload.loan_amount)
    loan = Loan(
        employee_id=payload.employee_id,
        loan_amount=amount,
        outstanding_amount=amount,
        date_taken=payload.date_taken,
        status=LoanStatus.active,
    )
    db.add(loan)
    db.commit()
    db.refresh(loan)
    return loan


@router.post("/{loan_id}/repay", response_model=LoanWithRepayments)
def repay_loan(
    loan_id: int, payload: RepaymentCreate, db: Session = Depends(get_db)
) -> LoanWithRepayments:
    if db.get(Loan, loan_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found"
        )
    try:
        loan_service.apply_repayment(
            db,
            loan_id=loan_id,
            amount=payload.amount,
            payment_date=payload.payment_date or date.today(),
            payroll_run_id=None,
        )
    except loan_service.RepaymentError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    db.commit()
    loan = db.get(Loan, loan_id)
    return _loan_with_repayments(loan, _repayments_for(db, loan_id))


@router.get("/employee/{employee_id}", response_model=list[LoanWithRepayments])
def loans_for_employee(
    employee_id: int, db: Session = Depends(get_db)
) -> list[LoanWithRepayments]:
    if db.get(Employee, employee_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found"
        )
    loans = list(
        db.execute(
            select(Loan)
            .where(Loan.employee_id == employee_id)
            .order_by(Loan.date_taken, Loan.id)
        )
        .scalars()
        .all()
    )
    return [_loan_with_repayments(loan, _repayments_for(db, loan.id)) for loan in loans]
