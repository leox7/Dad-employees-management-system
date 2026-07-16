"""Employee routes.

- GET    /employees            list (optional active_only filter)
- POST   /employees            create
- GET    /employees/{id}       fetch one
- PUT    /employees/{id}        partial update (salary edits allowed)
- DELETE /employees/{id}        soft delete -> status='inactive' (never a hard row delete)

All routes require authentication.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db import get_db
from app.models import Employee, EmployeeStatus, User
from app.money import to_money
from app.schemas.employee import EmployeeCreate, EmployeeOut, EmployeeUpdate

router = APIRouter(
    prefix="/employees", tags=["employees"], dependencies=[Depends(get_current_user)]
)


def _get_or_404(db: Session, employee_id: int) -> Employee:
    employee = db.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found"
        )
    return employee


@router.get("", response_model=list[EmployeeOut])
def list_employees(
    active_only: bool = False, db: Session = Depends(get_db)
) -> list[Employee]:
    stmt = select(Employee)
    if active_only:
        stmt = stmt.where(Employee.status == EmployeeStatus.active)
    stmt = stmt.order_by(Employee.name, Employee.id)
    return list(db.execute(stmt).scalars().all())


@router.post("", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db)) -> Employee:
    employee = Employee(
        name=payload.name,
        phone=payload.phone,
        salary=to_money(payload.salary),
        status=EmployeeStatus.active,
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


@router.get("/{employee_id}", response_model=EmployeeOut)
def get_employee(employee_id: int, db: Session = Depends(get_db)) -> Employee:
    return _get_or_404(db, employee_id)


@router.put("/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: int, payload: EmployeeUpdate, db: Session = Depends(get_db)
) -> Employee:
    employee = _get_or_404(db, employee_id)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        employee.name = data["name"]
    if "phone" in data:
        employee.phone = data["phone"]
    if "salary" in data:
        employee.salary = to_money(data["salary"])
    if "status" in data:
        employee.status = data["status"]
    db.commit()
    db.refresh(employee)
    return employee


@router.delete("/{employee_id}", response_model=EmployeeOut)
def deactivate_employee(employee_id: int, db: Session = Depends(get_db)) -> Employee:
    """Soft delete: set status='inactive'. History (loans/advances/payroll lines)
    is preserved; ON DELETE RESTRICT blocks any hard delete of an employee with
    history as a second line of defense."""
    employee = _get_or_404(db, employee_id)
    employee.status = EmployeeStatus.inactive
    db.commit()
    db.refresh(employee)
    return employee
