from __future__ import annotations
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import NullPool
from app.config import get_settings

settings = get_settings()

# NullPool is required for serverless environments (Vercel/AWS Lambda).
# Each function invocation opens and closes its own connection — no pooling.
engine = create_engine(
    settings.database_url,
    poolclass=NullPool,
    pool_pre_ping=True,
    connect_args={"sslmode": "require"} if settings.database_url.startswith("postgresql") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_setting(key: str) -> str | None:
    db = SessionLocal()
    try:
        result = db.execute(
            text("SELECT value FROM app_settings WHERE key = :key"), {"key": key}
        ).fetchone()
        return result[0] if result else None
    except Exception:
        return None
    finally:
        db.close()


def set_setting(key: str, value: str, encrypted: bool = False) -> None:
    from app.models.settings import AppSetting
    from datetime import datetime
    db = SessionLocal()
    try:
        existing = db.query(AppSetting).filter_by(key=key).first()
        if existing:
            existing.value = value
            existing.is_encrypted = encrypted
            existing.updated_at = datetime.utcnow()
        else:
            db.add(AppSetting(key=key, value=value, is_encrypted=encrypted))
        db.commit()
    finally:
        db.close()
