import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import app.database as _db
import app.models  # noqa: F401

Base = _db.Base

from app.routers import (
    companies, products, orders, catalog,
    ai_parse, share_links, settings, inventory, scraper,
)

# ALLOWED_ORIGINS env var: comma-separated list of allowed origins.
_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS = (
    ["*"] if _origins_env == "*"
    else [o.strip() for o in _origins_env.split(",") if o.strip()]
)


def _run_migrations():
    """Run alembic upgrade head programmatically.

    Works on Vercel (serverless) and Docker alike — no CLI needed.
    Resolves the alembic.ini path relative to this file so it works
    regardless of the working directory at runtime.
    """
    try:
        from alembic.config import Config
        from alembic import command

        # backend/app/main.py → backend/
        backend_dir = Path(__file__).parent.parent
        alembic_ini = backend_dir / "alembic.ini"

        if not alembic_ini.exists():
            # Fallback: try one level up (repo root layout)
            alembic_ini = backend_dir.parent / "backend" / "alembic.ini"

        cfg = Config(str(alembic_ini))
        # Override the DB URL so alembic uses the same connection as the app
        cfg.set_main_option("sqlalchemy.url", str(_db.engine.url))
        # Ensure the script location resolves correctly regardless of cwd
        cfg.set_main_option("script_location", str(backend_dir / "alembic"))
        command.upgrade(cfg, "head")
    except Exception as exc:
        # Never crash the app on migration errors — log and continue
        print(f"[migrations] warning: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run migrations (adds new columns, creates new tables) on every cold start.
    # Alembic tracks which migrations have already run, so this is always safe.
    _run_migrations()
    yield


app = FastAPI(
    title="LiquorStore Pro API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router_module in [
    companies, products, orders, catalog,
    ai_parse, share_links, settings, inventory, scraper,
]:
    app.include_router(router_module.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "LiquorStore Pro"}
