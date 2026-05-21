from __future__ import annotations
import ssl
from urllib.parse import urlparse, urlunparse
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import NullPool
from app.config import get_settings

settings = get_settings()


def _build_engine_args(raw_url: str):
    """
    Normalize any postgresql:// URL for pg8000.

    Neon, Supabase and Railway append ?sslmode=require&channel_binding=require
    (and sometimes more) to their connection strings.  pg8000 doesn't accept
    these as URL query params — it needs ssl passed via connect_args, and it
    errors out or misparses the database name if unknown params are left in
    the URL.

    Strategy: parse the URL with urlparse, drop the entire query string, then
    inject ssl_context through connect_args for any non-local host.
    """
    url = raw_url.strip()

    # Normalize Heroku/Render/Railway short form
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]

    connect_args: dict = {}

    if url.startswith("postgresql://") or url.startswith("postgresql+"):
        parsed = urlparse(url)

        # Drop ALL query params — pg8000 doesn't understand sslmode,
        # channel_binding, etc., and leaving them in corrupts the db name.
        clean = parsed._replace(query="", fragment="")
        url = urlunparse(clean)

        # SSL for any cloud host (not localhost / docker internal)
        hostname = parsed.hostname or ""
        is_local = hostname in ("localhost", "127.0.0.1", "db") or hostname.startswith("db:")
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

# NullPool: each serverless invocation gets its own connection; no idle pool.
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
