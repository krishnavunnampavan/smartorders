"""Owner-only store management + per-store inventory upload."""
from __future__ import annotations
import io
import csv
import uuid as uuid_lib
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.store import Store, StoreInventoryUpload, StoreInventoryItem
from app.models.product import Product
from app.schemas.store import StoreCreate, StoreUpdate, StoreOut, InventoryUploadOut, InventoryItemOut

router = APIRouter(prefix="/api/stores", tags=["stores"])


# ── Auth helpers ──────────────────────────────────────────────────────────────

def _get_store_from_key(key: Optional[str], db: Session) -> Store:
    if not key:
        raise HTTPException(401, "X-Store-Key header required")
    store = db.query(Store).filter_by(access_key=key, is_active=True).first()
    if not store:
        raise HTTPException(401, "Invalid or inactive access key")
    return store


def _require_owner(
    x_store_key: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Store:
    store = _get_store_from_key(x_store_key, db)
    if not store.is_owner_platform:
        raise HTTPException(403, "Owner access required")
    return store


def _require_store_or_owner(
    store_id: UUID,
    x_store_key: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Store:
    """Allow the store itself OR the owner platform."""
    store = _get_store_from_key(x_store_key, db)
    if store.is_owner_platform:
        return store
    if str(store.id) != str(store_id):
        raise HTTPException(403, "Access denied for this store")
    return store


# ── Store CRUD (owner only) ───────────────────────────────────────────────────

@router.get("", response_model=list[StoreOut])
def list_stores(owner: Store = Depends(_require_owner), db: Session = Depends(get_db)):
    return db.query(Store).filter(Store.is_owner_platform == False).order_by(Store.created_at.desc()).all()


@router.post("", response_model=StoreOut, status_code=201)
def create_store(
    body: StoreCreate,
    owner: Store = Depends(_require_owner),
    db: Session = Depends(get_db),
):
    existing = db.query(Store).filter_by(access_key=body.access_key).first()
    if existing:
        raise HTTPException(400, f"Access key {body.access_key} is already in use")
    store = Store(**body.model_dump())
    db.add(store)
    db.commit()
    db.refresh(store)
    return store


@router.put("/{store_id}", response_model=StoreOut)
def update_store(
    store_id: UUID,
    body: StoreUpdate,
    owner: Store = Depends(_require_owner),
    db: Session = Depends(get_db),
):
    store = db.get(Store, store_id)
    if not store or store.is_owner_platform:
        raise HTTPException(404, "Store not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(store, k, v)
    db.commit()
    db.refresh(store)
    return store


@router.delete("/{store_id}", status_code=204)
def deactivate_store(
    store_id: UUID,
    owner: Store = Depends(_require_owner),
    db: Session = Depends(get_db),
):
    store = db.get(Store, store_id)
    if not store or store.is_owner_platform:
        raise HTTPException(404, "Store not found")
    store.is_active = False
    db.commit()


# ── Inventory upload ──────────────────────────────────────────────────────────

def _parse_inventory_file(filename: str, content: bytes) -> list[dict]:
    """Parse CSV or Excel inventory file into list of row dicts."""
    fname = (filename or "").lower()

    if fname.endswith((".xlsx", ".xls")):
        import pandas as pd
        df = pd.read_excel(io.BytesIO(content), dtype=str)
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
        return df.fillna("").to_dict("records")

    # CSV / TSV
    text = content.decode("utf-8", errors="replace")
    dialect = csv.Sniffer().sniff(text[:2048], delimiters=",\t|")
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    rows = []
    for row in reader:
        rows.append({k.strip().lower().replace(" ", "_"): v.strip() for k, v in row.items()})
    return rows


def _extract_field(row: dict, *candidates: str) -> str:
    """Return the first non-empty value matching one of the candidate key names."""
    for key in candidates:
        val = row.get(key, "").strip()
        if val:
            return val
    return ""


def _deduplicate(rows: list[dict]) -> tuple[list[dict], int]:
    """Remove rows with duplicate (name + sku) keys. Returns (unique_rows, removed_count)."""
    seen: set[str] = set()
    unique: list[dict] = []
    for row in rows:
        name = _extract_field(row, "name", "product_name", "item", "description", "product").lower()
        sku  = _extract_field(row, "sku", "upc", "barcode", "code", "item_code")
        key = sku if sku else name
        if not key:
            continue
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
    return unique, len(rows) - len(unique)


@router.post("/{store_id}/inventory/upload")
async def upload_inventory(
    store_id: UUID,
    file: UploadFile = File(...),
    x_store_key: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    _require_store_or_owner(store_id, x_store_key, db)

    target_store = db.get(Store, store_id)
    if not target_store or target_store.is_owner_platform:
        raise HTTPException(404, "Store not found")

    content = await file.read()
    try:
        raw_rows = _parse_inventory_file(file.filename or "", content)
    except Exception as exc:
        raise HTTPException(400, f"Could not parse file: {exc}")

    unique_rows, dupes = _deduplicate(raw_rows)

    # Build inventory items and attempt to match against the product catalog
    all_products = db.query(Product).filter_by(is_active=True).all()
    sku_map  = {(p.sku or "").strip().lower(): p for p in all_products if p.sku}
    name_map = {(p.name or "").strip().lower(): p for p in all_products}

    # Delete the store's previous inventory from this upload session
    # (keep the last upload as the active inventory)
    prev_uploads = db.query(StoreInventoryUpload).filter_by(store_id=store_id).all()
    for u in prev_uploads:
        db.delete(u)
    db.commit()

    upload = StoreInventoryUpload(
        store_id=store_id,
        filename=file.filename,
        total_rows=len(raw_rows),
        duplicates_removed=dupes,
        matched_products=0,
        status="processing",
    )
    db.add(upload)
    db.flush()

    matched = 0
    items_to_add: list[StoreInventoryItem] = []
    for row in unique_rows:
        name  = _extract_field(row, "name", "product_name", "item", "description", "product")
        sku   = _extract_field(row, "sku", "upc", "barcode", "code", "item_code")
        qty_s = _extract_field(row, "quantity", "qty", "count", "stock", "on_hand", "current_stock")
        size  = _extract_field(row, "size", "unit_size", "bottle_size")
        cat   = _extract_field(row, "category", "type", "department")

        if not name:
            continue

        try:
            qty = int(float(qty_s)) if qty_s else 0
        except ValueError:
            qty = 0

        # Match product
        product: Product | None = None
        if sku:
            product = sku_map.get(sku.lower())
        if not product:
            product = name_map.get(name.lower())

        if product:
            matched += 1

        items_to_add.append(StoreInventoryItem(
            store_id=store_id,
            upload_id=upload.id,
            product_id=product.id if product else None,
            product_name=name,
            sku=sku or (product.sku if product else None),
            quantity=qty,
            unit_size=size or (product.unit_size if product else None),
            category=cat or (product.category if product else None),
        ))

    if items_to_add:
        db.bulk_save_objects(items_to_add)

    upload.matched_products = matched
    upload.status = "processed"
    db.commit()

    return {
        "upload_id": str(upload.id),
        "filename": file.filename,
        "total_rows": len(raw_rows),
        "duplicates_removed": dupes,
        "unique_items": len(unique_rows),
        "matched_products": matched,
        "status": "processed",
    }


@router.get("/{store_id}/inventory")
def get_store_inventory(
    store_id: UUID,
    x_store_key: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    _require_store_or_owner(store_id, x_store_key, db)

    # Get the latest upload
    upload = (
        db.query(StoreInventoryUpload)
        .filter_by(store_id=store_id)
        .order_by(StoreInventoryUpload.uploaded_at.desc())
        .first()
    )
    if not upload:
        return {"upload": None, "items": []}

    items = db.query(StoreInventoryItem).filter_by(upload_id=upload.id).all()
    return {
        "upload": {
            "id": str(upload.id),
            "filename": upload.filename,
            "total_rows": upload.total_rows,
            "duplicates_removed": upload.duplicates_removed,
            "matched_products": upload.matched_products,
            "uploaded_at": upload.uploaded_at.isoformat(),
            "status": upload.status,
        },
        "items": [
            {
                "id": str(i.id),
                "product_name": i.product_name,
                "sku": i.sku,
                "quantity": i.quantity,
                "unit_size": i.unit_size,
                "category": i.category,
                "product_id": str(i.product_id) if i.product_id else None,
            }
            for i in items
        ],
    }


@router.get("/{store_id}/inventory/uploads")
def list_uploads(
    store_id: UUID,
    x_store_key: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    _require_store_or_owner(store_id, x_store_key, db)
    uploads = (
        db.query(StoreInventoryUpload)
        .filter_by(store_id=store_id)
        .order_by(StoreInventoryUpload.uploaded_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": str(u.id),
            "filename": u.filename,
            "total_rows": u.total_rows,
            "duplicates_removed": u.duplicates_removed,
            "matched_products": u.matched_products,
            "status": u.status,
            "uploaded_at": u.uploaded_at.isoformat(),
        }
        for u in uploads
    ]


# ── Owner: cross-store stats ──────────────────────────────────────────────────

@router.get("/{store_id}/stats")
def store_stats(
    store_id: UUID,
    owner: Store = Depends(_require_owner),
    db: Session = Depends(get_db),
):
    from app.models.order import Order
    store = db.get(Store, store_id)
    if not store:
        raise HTTPException(404, "Store not found")

    order_count = db.query(Order).filter_by(store_id=store_id).count()
    last_upload = (
        db.query(StoreInventoryUpload)
        .filter_by(store_id=store_id)
        .order_by(StoreInventoryUpload.uploaded_at.desc())
        .first()
    )
    return {
        "store_id": str(store_id),
        "store_name": store.name,
        "order_count": order_count,
        "last_inventory_upload": last_upload.uploaded_at.isoformat() if last_upload else None,
        "inventory_items": last_upload.total_rows - last_upload.duplicates_removed if last_upload else 0,
    }
