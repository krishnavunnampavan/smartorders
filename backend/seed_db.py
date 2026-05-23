"""
Seed script: reads seed/items_seed.json and bulk-inserts all 4,930 products
if the products table is empty. Safe to re-run — it is a no-op if rows exist.

Usage:
    python seed_db.py
or it runs automatically from the docker-compose startup command.
"""
import json
import os
import sys
import uuid
from pathlib import Path

# Allow running from project root or backend/
sys.path.insert(0, str(Path(__file__).parent))

from app.database import SessionLocal, engine
import app.models  # noqa: F401 — registers all models
from app.database import Base

SEED_FILE = Path(__file__).parent / "seed" / "items_seed.json"
BATCH = 500


def seed():
    Base.metadata.create_all(bind=engine)

    from app.models.product import Product
    from app.models.company import Company

    db = SessionLocal()
    try:
        count = db.query(Product).count()
        if count > 0:
            print(f"[seed] Products table already has {count} rows — skipping seed.")
            return

        if not SEED_FILE.exists():
            print(f"[seed] Seed file not found: {SEED_FILE}")
            return

        with open(SEED_FILE) as f:
            items = json.load(f)

        print(f"[seed] Loading {len(items)} products…")
        total = 0
        batch = []
        for item in items:
            batch.append(
                Product(
                    id=uuid.uuid4(),
                    name=item["name"],
                    sku=str(item.get("upc", "") or ""),
                    barcode=str(item.get("upc", "") or ""),
                    unit_size=item.get("size", ""),
                    pack=item.get("pack", ""),
                    unit_price=float(item.get("price", 0) or 0),
                    category=item.get("category", "Spirits & Other"),
                    aliases=[item["name"].lower()],
                    reorder_level=2,
                    current_stock=0,
                    is_active=True,
                )
            )
            total += 1
            if len(batch) >= BATCH:
                db.bulk_save_objects(batch)
                db.commit()
                print(f"[seed] Inserted {total}/{len(items)}…")
                batch = []

        if batch:
            db.bulk_save_objects(batch)
            db.commit()

        # Seed 5 default companies/distributors if none exist
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
            print(f"[seed] Seeded {len(defaults)} default companies.")

        print(f"[seed] Done — {total} products inserted.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
