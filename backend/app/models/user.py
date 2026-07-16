"""users: login (by email) + display name. Mirrors payroll-db.sql exactly."""
from datetime import datetime

from sqlalchemy import String, TIMESTAMP, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(150), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # Nullable to match the live DDL (MySQL TIMESTAMP DEFAULT CURRENT_TIMESTAMP).
    created_at: Mapped[datetime | None] = mapped_column(TIMESTAMP, server_default=func.now())
