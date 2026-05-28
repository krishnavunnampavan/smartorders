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
    ai_parse, share_links, settings, inventory, scraper, analytics,
)
from app.routers import cart as cart_router
from app.routers import ws_cart as ws_cart_router

# ALLOWED_ORIGINS env var: comma-separated list of allowed origins.
_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS = (
    ["*"] if _origins_env == "*"
    else [o.strip() for o in _origins_env.split(",") if o.strip()]
)


def _run_migrations():
    """Run alembic upgrade head, handling pre-alembic databases gracefully.

    If the DB has tables (created by create_all before alembic was introduced)
    but no alembic_version tracking table, stamp it to the last migration that
    create_all() would have applied (002), then run upgrade to add newer ones.
    """
    try:
        from alembic.config import Config
        from alembic import command
        from sqlalchemy import inspect as sa_inspect

        backend_dir = Path(__file__).parent.parent
        alembic_ini = backend_dir / "alembic.ini"
        if not alembic_ini.exists():
            alembic_ini = backend_dir.parent / "backend" / "alembic.ini"

        cfg = Config(str(alembic_ini))
        cfg.set_main_option("sqlalchemy.url", str(_db.engine.url))
        cfg.set_main_option("script_location", str(backend_dir / "alembic"))

        # Detect DBs that were bootstrapped via create_all() before alembic was wired up:
        # they have the app tables but no alembic_version table.
        insp = sa_inspect(_db.engine)
        existing_tables = set(insp.get_table_names())
        if "alembic_version" not in existing_tables and "products" in existing_tables:
            # Stamp to migration 002 (the last one create_all would cover) so that
            # alembic upgrade head only runs migration 003+ (the missing columns).
            print("[migrations] Pre-alembic DB detected — stamping to 002 before upgrade.")
            command.stamp(cfg, "002")

        command.upgrade(cfg, "head")
        print("[migrations] OK — at head.")
    except Exception as exc:
        print(f"[migrations] warning: {exc}")


def _ensure_columns():
    """Direct SQL fallback: add new columns if they somehow still don't exist.

    Uses ADD COLUMN IF NOT EXISTS (PG 9.6+) so it is always safe to run.
    """
    try:
        from sqlalchemy import text
        with _db.engine.connect() as conn:
            # products columns
            conn.execute(text(
                "ALTER TABLE products ADD COLUMN IF NOT EXISTS pack VARCHAR(50)"
            ))
            conn.execute(text(
                "ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2) DEFAULT 0"
            ))
            conn.execute(text(
                "ALTER TABLE products ADD COLUMN IF NOT EXISTS case_price NUMERIC(10, 2)"
            ))
            # order_items columns added in migration 004 — guard for pre-migration DBs
            conn.execute(text(
                "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selected_size VARCHAR(20)"
            ))
            conn.execute(text(
                "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selected_unit VARCHAR(30)"
            ))
            conn.execute(text(
                "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS bottles_per_unit INTEGER DEFAULT 1"
            ))
            conn.execute(text(
                "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_bottles INTEGER"
            ))
            conn.execute(text(
                "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_note TEXT"
            ))
            conn.execute(text(
                "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_name_override VARCHAR(200)"
            ))
            conn.execute(text(
                "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_struck BOOLEAN DEFAULT FALSE"
            ))
            conn.commit()
        print("[ensure_columns] OK.")
    except Exception as exc:
        print(f"[ensure_columns] warning: {exc}")


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
    import asyncio
    _run_migrations()    # alembic upgrade head (stamps pre-alembic DBs first)
    _ensure_columns()    # ADD COLUMN IF NOT EXISTS failsafe for pack/unit_price/case_price
    _seed_products()     # upsert 5,083 products from seed JSON
    # Start optional Redis listener (no-op when REDIS_URL is unset)
    try:
        asyncio.create_task(ws_cart_router.redis_listener())
    except Exception:
        pass
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
    ai_parse, share_links, settings, inventory, scraper, analytics,
]:
    app.include_router(router_module.router)

app.include_router(cart_router.router)
app.include_router(ws_cart_router.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "LiquorStore Pro"}
