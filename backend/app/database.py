from __future__ import annotations
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import NullPool
from app.config import get_settings

settings = get_settings()


def _resolve_db_url(url: str) -> str:
    """
    Normalize the database URL to use the correct SQLAlchemy driver prefix.

    Neon / Supabase / Railway all issue URLs starting with 'postgresql://' or
    'postgres://' which SQLAlchemy maps to psycopg2 by default.  We want to
    use psycopg3 (psycopg[binary]) on Vercel because psycopg2-binary has no
    pre-built wheel for Python 3.12+.  If psycopg3 is importable we rewrite
    the prefix; if only psycopg2 is available we leave the URL alone.
    """
    # Normalize Heroku-style 'postgres://' → 'postgresql://'
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]

    if not url.startswith("postgresql://"):
        return url  # sqlite or already prefixed

    try:
        import psycopg  # noqa: F401  psycopg3
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    except ImportError:
        pass

    return url  # fall back to psycopg2 default


_db_url = _resolve_db_url(settings.database_url)

_connect_args = (
    {"sslmode": "require"}
    if _db_url.startswith("postgresql") and "localhost" not in _db_url and "127.0.0.1" not in _db_url
    else {}
)

# NullPool: each serverless invocation opens/closes its own connection.
engine = create_engine(_db_url, poolclass=NullPool, pool_pre_ping=True, connect_args=_connect_args)
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
