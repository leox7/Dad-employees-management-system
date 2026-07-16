"""Money rounding discipline. Every value persisted to a Numeric(12,2) column is
run through `to_money` so rounding is consistent (ROUND_HALF_UP, 2 dp) at every
write point — draft save, loan creation, repayment split, etc."""
from decimal import ROUND_HALF_UP, Decimal

_TWO_PLACES = Decimal("0.01")


def to_money(value: Decimal | int | str) -> Decimal:
    """Quantize to 2 decimal places using ROUND_HALF_UP."""
    return Decimal(value).quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)
