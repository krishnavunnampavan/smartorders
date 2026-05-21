from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import InventoryLog, Product

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.post("/update")
def update_inventory(body: dict, db: Session = Depends(get_db)):
    product_id = body.get("product_id")
    new_stock = body.get("new_stock")
    product = db.get(Product, product_id)
    if not product:
        from fastapi import HTTPException
        raise HTTPException(404, "Product not found")
    log = InventoryLog(
        product_id=product_id,
        previous_stock=product.current_stock,
        new_stock=new_stock,
        change_reason=body.get("change_reason", "adjustment"),
        updated_by=body.get("updated_by", "manager"),
    )
    product.current_stock = new_stock
    db.add(log)
    db.commit()
    return {"ok": True}


@router.get("/log")
def inventory_log(product_id: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(InventoryLog).order_by(InventoryLog.created_at.desc())
    if product_id:
        q = q.filter_by(product_id=product_id)
    rows = q.limit(200).all()
    return [
        {
            "id": str(r.id),
            "product_id": str(r.product_id),
            "previous_stock": r.previous_stock,
            "new_stock": r.new_stock,
            "change_reason": r.change_reason,
            "updated_by": r.updated_by,
            "created_at": str(r.created_at),
        }
        for r in rows
    ]


@router.get("/alerts")
def inventory_alerts(db: Session = Depends(get_db)):
    products = db.query(Product).filter(
        Product.is_active == True,
        Product.current_stock < Product.reorder_level,
    ).all()
    return [
        {
            "product_id": str(p.id),
            "name": p.name,
            "current_stock": p.current_stock,
            "reorder_level": p.reorder_level,
            "company_id": str(p.company_id) if p.company_id else None,
        }
        for p in products
    ]
