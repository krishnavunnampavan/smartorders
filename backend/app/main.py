import json
import os
import uuid
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


def _seed_products():
    """Upsert seed products from items_seed.json on cold start.

    Inserts items whose UPC is not yet in the DB; skips existing rows.
    Also seeds default companies if none exist.
    """
    try:
        from app.models.product import Product
        from app.models.company import Company

        backend_dir = Path(__file__).parent.parent
        seed_file = backend_dir / "seed" / "items_seed.json"
        if not seed_file.exists():
            return

        with open(seed_file) as f:
            items = json.load(f)

        db = _db.SessionLocal()
        try:
            # Collect existing UPCs to avoid duplicate inserts
            existing_upcs = {row[0] for row in db.query(Product.sku).all() if row[0]}

            batch = []
            for item in items:
                upc = str(item.get("upc", "") or "")
                if upc and upc in existing_upcs:
                    continue
                batch.append(Product(
                    id=uuid.uuid4(),
                    name=item["name"],
                    sku=upc,
                    barcode=upc,
                    unit_size=item.get("size", ""),
                    pack=item.get("pack", ""),
                    unit_price=float(item.get("price", 0) or 0),
                    category=item.get("category", "Spirits & Other"),
                    aliases=[item["name"].lower()],
                    reorder_level=2,
                    current_stock=0,
                    is_active=True,
                ))
                if len(batch) >= 500:
                    db.bulk_save_objects(batch)
                    db.commit()
                    batch = []

            if batch:
                db.bulk_save_objects(batch)
                db.commit()

            if db.query(Company).count() == 0:
                defaults = [
                    {"name": "Southern Glazers", "contact_name": "Sales Rep", "email": "orders@southernglazers.com", "delivery_days": "Mon, Wed, Fri"},
                    {"name": "RNDC", "contact_name": "Sales Rep", "email": "orders@rndc.com", "delivery_days": "Tue, Thu"},
                    {"name": "Reyes Beverage", "contact_name": "Sales Rep", "email": "orders@reyesbeverage.com", "delivery_days": "Mon, Wed"},
                    {"name": "Anheuser-Busch", "contact_name": "Sales Rep", "email": "orders@ab-inbev.com", "delivery_days": "Tue, Fri"},
                    {"name": "MillerCoors / Molson", "contact_name": "Sales Rep", "email": "orders@molsoncoors.com", "delivery_days": "Mon, Thu"},
                ]
                for d in defaults:
                    db.add(Company(**d))
                db.commit()

            print(f"[seed] Done — inserted {len(batch) if not batch else 0} products.")
        finally:
            db.close()
    except Exception as exc:
        print(f"[seed] warning: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run migrations (adds new columns, creates new tables) on every cold start.
    # Alembic tracks which migrations have already run, so this is always safe.
    _run_migrations()
    _seed_products()
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
