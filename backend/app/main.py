from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import app.database as _db
import app.models  # noqa: F401

Base = _db.Base

from app.routers import (
    companies, products, orders, catalog,
    ai_parse, share_links, settings, inventory,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup (for dev; prod uses Alembic)
    Base.metadata.create_all(bind=_db.engine)
    yield


app = FastAPI(
    title="LiquorStore Pro API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://smartorders.vercel.app",        # ← replace with your actual Vercel URL
        "https://*.vercel.app",                  # all Vercel preview deploys
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router_module in [
    companies, products, orders, catalog,
    ai_parse, share_links, settings, inventory,
]:
    app.include_router(router_module.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "LiquorStore Pro"}
