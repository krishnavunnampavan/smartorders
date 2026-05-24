"""Cart REST API — all endpoints under /api/cart."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from app.database import get_db
import app.services.cart_service as svc

router = APIRouter(prefix="/api/cart", tags=["cart"])


# ── Request schemas ───────────────────────────────────────────────────────────

class AddItemBody(BaseModel):
    product_id: str
    selected_size: str = "750ml"
    selected_unit: str = "Case"
    bottles_per_unit: int = 12
    quantity: int = 1
    unit_price: float = 0.0
    case_price: float = 0.0
    effective_price: float = 0.0
    price_status: str = "STABLE"
    price_change: float = 0.0
    source: str = "manual"
    added_by: str = "manager"


class UpdateItemBody(BaseModel):
    quantity: Optional[int] = None
    selected_size: Optional[str] = None
    selected_unit: Optional[str] = None
    bottles_per_unit: Optional[int] = None
    unit_price: Optional[float] = None
    case_price: Optional[float] = None
    effective_price: Optional[float] = None
    price_status: Optional[str] = None
    price_change: Optional[float] = None
    updated_by: str = "manager"


class ClearBody(BaseModel):
    cleared_by: str = "manager"


class SubmitBody(BaseModel):
    submitted_by: str = "manager"


class RemoveBody(BaseModel):
    removed_by: str = "manager"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
def get_cart(db: Session = Depends(get_db)):
    return svc.get_active_cart_full(db)


@router.post("/items")
async def add_item(body: AddItemBody, db: Session = Depends(get_db)):
    try:
        item = await svc.add_item_to_cart(
            db=db,
            product_id=body.product_id,
            selected_size=body.selected_size,
            selected_unit=body.selected_unit,
            bottles_per_unit=body.bottles_per_unit,
            quantity=body.quantity,
            unit_price=body.unit_price,
            case_price=body.case_price,
            effective_price=body.effective_price,
            price_status=body.price_status,
            price_change=body.price_change,
            source=body.source,
            added_by=body.added_by,
        )
        return item
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/items/{item_id}")
async def update_item(item_id: str, body: UpdateItemBody, db: Session = Depends(get_db)):
    updates = body.model_dump(exclude_none=True, exclude={"updated_by"})
    try:
        item = await svc.update_cart_item(db, item_id, updates, body.updated_by)
        return item
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/items/{item_id}")
async def remove_item(item_id: str, removed_by: str = "manager", db: Session = Depends(get_db)):
    await svc.remove_cart_item(db, item_id, removed_by)
    return {"ok": True}


@router.delete("")
async def clear_cart(body: ClearBody = ClearBody(), db: Session = Depends(get_db)):
    await svc.clear_cart(db, body.cleared_by)
    return {"ok": True}


@router.post("/submit")
async def submit_cart(body: SubmitBody = SubmitBody(), db: Session = Depends(get_db)):
    try:
        result = await svc.submit_cart_to_order(db, body.submitted_by)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/activity")
def get_activity(limit: int = 50, db: Session = Depends(get_db)):
    from app.models.cart import CartActivityLog, ActiveCart
    cart = svc.get_or_create_active_cart(db)
    logs = (
        db.query(CartActivityLog)
        .filter_by(cart_id=cart.id)
        .order_by(CartActivityLog.done_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id":           str(l.id),
            "action":       l.action,
            "product_name": l.product_name,
            "old_qty":      l.old_qty,
            "new_qty":      l.new_qty,
            "old_size":     l.old_size,
            "new_size":     l.new_size,
            "done_by":      l.done_by,
            "done_at":      l.done_at.isoformat() if l.done_at else None,
        }
        for l in logs
    ]
