"""Seed the two application users (dad = operator, admin = dev).

Idempotent: checks by email before inserting, so it is safe to re-run in any
environment (including production) without erroring or duplicating rows.

Credentials come from environment variables when set, otherwise fall back to the
placeholder defaults below. Set real values before running in production, e.g.
in backend/.env:  DAD_EMAIL, DAD_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD.

Run:  python -m app.seed   (from the backend/ directory)
"""
import os

from dotenv import load_dotenv
from sqlalchemy import select

from app.auth.security import hash_password
from app.db import SessionLocal
from app.models import User

# Load backend/.env into os.environ so the credential vars below are visible
# (pydantic-settings only feeds .env into Settings, not into os.environ).
load_dotenv()

SEED_USERS = [
    {
        "username": os.getenv("DAD_USERNAME", "Dad"),
        "email": os.getenv("DAD_EMAIL", "dad@payroll.local"),
        "password": os.getenv("DAD_PASSWORD", "changeme-dad"),
    },
    {
        "username": os.getenv("ADMIN_USERNAME", "Admin"),
        "email": os.getenv("ADMIN_EMAIL", "admin@payroll.local"),
        "password": os.getenv("ADMIN_PASSWORD", "changeme-admin"),
    },
]


def seed() -> None:
    db = SessionLocal()
    try:
        for entry in SEED_USERS:
            existing = db.execute(
                select(User).where(User.email == entry["email"])
            ).scalar_one_or_none()
            if existing is not None:
                print(f"skip (already exists): {entry['email']}")
                continue
            db.add(
                User(
                    username=entry["username"],
                    email=entry["email"],
                    password_hash=hash_password(entry["password"]),
                )
            )
            print(f"created: {entry['email']}")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
