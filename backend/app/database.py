from __future__ import annotations
import ssl
import re
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import NullPool
from app.config import get_settings

settings = get_settings()


def _build_engine_args(raw_url: str):
    """
    Return (engine_url, connect_args) ready for create_engine().

    pg8000 is a pure-Python PostgreSQL driver — no C extensions, no
    pg_config, works on any Python version.  SQLAlchemy needs the
    'postgresql+pg8000://' prefix, and SSL is passed as ssl_context
    rather than a URL parameter.
    """
    url = raw_url

    # Normalize Heroku/Render/Railway style 'postgres://' → 'postgresql://'
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]

    connect_args: dict = {}

    if url.startswith("postgresql://") or url.startswith("postgresql+"):
        # Strip sslmode from query string — pg8000 ignores it and it
        # causes an "unexpected keyword argument" error at connect time.
        url = re.sub(r"[?&]sslmode=[^&]*", "", url).rstrip("?&")

        # Add SSL for any non-local database (Neon, Supabase, Railway…)
        is_local = any(h in url for h in ("localhost", "127.0.0.1", "db:5432", "@db/"))
        if not is_local:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_REQUIRED
            connect_args["ssl_context"] = ctx

        # Force the pg8000 driver prefix
        if url.startswith("postgresql://"):
            url = "postgresql+pg8000://" + url[len("postgresql://"):]

    return url, connect_args


_engine_url, _connect_args = _build_engine_args(settings.database_url)

# NullPool: required for serverless — each invocation gets its own connection.
engine = create_engine(
    _engine_url,
    poolclass=NullPool,
    pool_pre_ping=True,
    connect_args=_connect_args,
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
