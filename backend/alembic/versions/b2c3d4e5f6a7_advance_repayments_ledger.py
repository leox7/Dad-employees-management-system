"""add advance_repayments ledger

Records each advance draw-down (mirror of loan_repayments) so that deleting an
approved payroll run can reverse its advance deductions exactly.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "advance_repayments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("advance_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column("payroll_run_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["advance_id"], ["salary_advances.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["payroll_run_id"], ["payroll_runs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_advance_repayments_advance", "advance_repayments", ["advance_id"]
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_advance_repayments_advance", table_name="advance_repayments")
    op.drop_table("advance_repayments")
