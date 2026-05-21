import os
from contextlib import asynccontextmanager
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
# Set it in Vercel Project Settings → Environment Variables.
# Defaults to allowing all origins if not set.
_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS = (
    ["*"] if _origins_env == "*"
    else [o.strip() for o in _origins_env.split(",") if o.strip()]
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-create any missing tables on cold start.
    # Safe to run on every invocation — it's a no-op if tables exist.
    try:
        Base.metadata.create_all(bind=_db.engine)
    except Exception:
        pass  # DB might not be reachable yet; Alembic handles migrations
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
