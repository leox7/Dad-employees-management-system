"""Database engine, session factory, declarative Base and the FastAPI DB dependency."""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


def get_connect_args() -> dict:
    """PyMySQL's flat `ssl_ca` kwarg (not the nested mysqlclient-style `ssl={...}`
    dict) is what enables TLS for managed providers like Aiven that require it.
    Empty when DB_SSL_CA is unset, so local dev (no TLS) is unaffected. Shared
    with alembic/env.py so there is one place this logic lives."""
    return {"ssl_ca": settings.DB_SSL_CA} if settings.DB_SSL_CA else {}


# pool_pre_ping avoids handing out stale MySQL connections after idle timeouts.
# pool_size/max_overflow are capped low: a managed free-tier MySQL plan (e.g.
# Aiven) has a small max_connections ceiling, and SQLAlchemy's default pool
# (5 + 10 overflow) can exhaust it from a single process.
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    future=True,
    pool_size=3,
    max_overflow=2,
    connect_args=get_connect_args(),
)

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
