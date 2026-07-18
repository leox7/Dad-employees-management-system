"""Application configuration loaded from `backend/.env` via pydantic-settings."""
from functools import cached_property

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # SQLAlchemy URL, e.g. mysql+pymysql://user:pass@host:3306/payroll_db
    DATABASE_URL: str

    # JWT signing (used from Module 2 onward)
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Comma-separated list of allowed CORS origins
    CORS_ORIGINS: str = "http://localhost:5173"

    # Path to a CA cert file, required by managed MySQL providers that enforce
    # TLS (e.g. Aiven). Unset for local dev, where MySQL has no TLS at all.
    DB_SSL_CA: str | None = None

    @cached_property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
