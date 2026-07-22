"""Payroll routes.

- POST   /payroll/run              generate a draft for a month/year (409 if exists)
- GET    /payroll/history          list runs with summary totals
- GET    /payroll/{id}             read a run + lines (+ live warnings); no status guard
- PUT    /payroll/{id}/draft       autosave loan_deduction edits (409 unless draft)
- POST   /payroll/{id}/approve     draw down loans + advances, approve (409 unless draft)
- DELETE /payroll/{id}             delete a run; an approved run is rolled back first
- GET    /payroll/{id}/export      Excel export of an approved run (409 unless approved)

`/history` is declared before `/{run_id}` so it is not captured by the int path param.
All routes require authentication.
"""
from collections.abc import Callable

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db import get_db
from app.models import PayrollRunStatus
from app.schemas.payroll import (
    PayrollDraftUpdate,
    PayrollHistoryItem,
    PayrollRunCreate,
    PayrollRunDetail,
)
from app.services import excel_service, payroll_service
from app.services.loan_service import RepaymentError

XLSX_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)

router = APIRouter(
    prefix="/payroll", tags=["payroll"], dependencies=[Depends(get_current_user)]
)


def _call(fn: Callable, *args, **kwargs):
    """Translate service errors into HTTP responses."""
    try:
        return fn(*args, **kwargs)
    except payroll_service.PayrollNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except (payroll_service.PayrollConflict, RepaymentError) as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc


@router.post("/run", response_model=PayrollRunDetail, status_code=status.HTTP_201_CREATED)
def run_payroll(payload: PayrollRunCreate, db: Session = Depends(get_db)) -> PayrollRunDetail:
    return _call(payroll_service.create_run, db, payload.month, payload.year)


@router.get("/history", response_model=list[PayrollHistoryItem])
def payroll_history(db: Session = Depends(get_db)) -> list[PayrollHistoryItem]:
    return payroll_service.list_history(db)


@router.get("/{run_id}", response_model=PayrollRunDetail)
def get_run(run_id: int, db: Session = Depends(get_db)) -> PayrollRunDetail:
    return _call(payroll_service.get_run_detail, db, run_id)


@router.put("/{run_id}/draft", response_model=PayrollRunDetail)
def save_draft(
    run_id: int, payload: PayrollDraftUpdate, db: Session = Depends(get_db)
) -> PayrollRunDetail:
    return _call(payroll_service.update_draft, db, run_id, payload)


@router.post("/{run_id}/approve", response_model=PayrollRunDetail)
def approve(run_id: int, db: Session = Depends(get_db)) -> PayrollRunDetail:
    return _call(payroll_service.approve_run, db, run_id)


@router.delete("/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_run(run_id: int, db: Session = Depends(get_db)) -> Response:
    _call(payroll_service.delete_run, db, run_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{run_id}/export")
def export_run(run_id: int, db: Session = Depends(get_db)) -> StreamingResponse:
    """Excel export of an approved run. Guard: status must be 'approved' (409
    otherwise) — this guarantees the file always matches financially-real data,
    and it is available immediately once approved."""
    run = _call(payroll_service.get_run, db, run_id)
    if run.status != PayrollRunStatus.approved:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Only an approved run can be exported"
        )
    buffer = excel_service.build_payroll_export(db, run)
    filename = excel_service.export_filename(run)
    return StreamingResponse(
        buffer,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
