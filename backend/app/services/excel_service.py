"""Excel export for an approved payroll run.

Layout mirrors excel/payroll_export.xlsx (the agreed bank bulk-upload template):
sheet "Payroll Export", title block in rows 1-2, headers on row 5, data from row 6.

Two deliberate differences from that template file:
- Net salary is written as the run's *stored* value, not an `=C-D-E` formula.
  An approved run is immutable financial history, so the file must carry exactly
  what was approved. It is also safer for the bank's parser: openpyxl-written
  formulas have no cached result, so a reader that does not recalculate would see
  an empty net column.
- The template's "PLACEHOLDER FORMAT" note is an internal remark and is not shipped.

Decimal -> float conversion happens only at the point of writing a cell.
"""
import calendar
from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Font
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Employee, PayrollLine, PayrollRun

MONEY_FORMAT = '#,##0.00" KES"'

HEADERS = [
    "Employee Name",
    "Phone Number",
    "Gross Salary (KES)",
    "Loan Deduction (KES)",
    "Advance Deduction (KES)",
    "Net Salary (KES)",
]
COLUMN_WIDTHS = {"A": 22, "B": 16, "C": 20, "D": 20, "E": 22, "F": 20}
HEADER_ROW = 5
FIRST_DATA_ROW = 6


def export_filename(run: PayrollRun) -> str:
    return f"payroll_{run.month:02d}_{run.year}.xlsx"


def build_payroll_export(db: Session, run: PayrollRun) -> BytesIO:
    """Build the workbook in memory and return a rewound byte stream."""
    rows = db.execute(
        select(PayrollLine, Employee.name, Employee.phone)
        .join(Employee, Employee.id == PayrollLine.employee_id)
        .where(PayrollLine.payroll_run_id == run.id)
        .order_by(Employee.name, PayrollLine.id)
    ).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Payroll Export"

    ws["A1"] = "Monthly Payroll Export"
    ws["A1"].font = Font(bold=True)
    period = f"{calendar.month_name[run.month]} {run.year}"
    approved = run.approved_at.strftime("%Y-%m-%d") if run.approved_at else "-"
    ws["A2"] = f"Payroll for {period} — approved {approved}"

    for idx, header in enumerate(HEADERS, start=1):
        cell = ws.cell(row=HEADER_ROW, column=idx, value=header)
        cell.font = Font(bold=True)

    row_num = FIRST_DATA_ROW
    for line, name, phone in rows:
        ws.cell(row=row_num, column=1, value=name)
        ws.cell(row=row_num, column=2, value=phone)
        money = (
            (3, line.gross_salary),
            (4, line.loan_deduction),
            (5, line.advance_deduction),
            (6, line.net_salary),
        )
        for col, value in money:
            cell = ws.cell(row=row_num, column=col, value=float(value))
            cell.number_format = MONEY_FORMAT
        row_num += 1

    for col, width in COLUMN_WIDTHS.items():
        ws.column_dimensions[col].width = width

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer
