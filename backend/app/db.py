"""Database engine, session factory, declarative Base and the FastAPI DB dependency."""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# pool_pre_ping avoids handing out stale MySQL connections after idle timeouts.
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, future=True)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    """Declarative base; all ORM models inherit from this and register on Base.metadata."""


def get_db() -> Generator[Session, None, None]:
    """Yield a request-scoped SQLAlchemy session, always closing it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
