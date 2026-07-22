"""add outstanding_amount to salary_advances

Advances now carry a running balance (like loans): the payroll draft pre-fills the
deduction with this balance and the remainder carries over to a later payroll.

Backfill for rows created under the old auto-deduct design:
  - already consumed (payroll_run_id NOT NULL)  -> fully deducted, balance 0
  - not yet consumed (payroll_run_id IS NULL)   -> nothing deducted, balance = amount

Revision ID: a1b2c3d4e5f6
Revises: 6f40d9520068
Create Date: 2026-07-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "6f40d9520068"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add nullable first so the ALTER succeeds against a populated table, then
    # backfill, then enforce NOT NULL to match the model.
    op.add_column(
        "salary_advances",
        sa.Column("outstanding_amount", sa.Numeric(12, 2), nullable=True),
    )
    op.execute(
        "UPDATE salary_advances "
        "SET outstanding_amount = CASE "
        "WHEN payroll_run_id IS NULL THEN amount ELSE 0 END"
    )
    op.alter_column(
        "salary_advances",
        "outstanding_amount",
        existing_type=sa.Numeric(12, 2),
        nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("salary_advances", "outstanding_amount")
