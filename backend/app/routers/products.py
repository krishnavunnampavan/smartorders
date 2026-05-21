from __future__ import annotations
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Product, InventoryLog
from app.schemas.product import ProductCreate, ProductUpdate, ProductOut, StockUpdateIn

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
def list_products(
    company_id: Optional[UUID] = None,
    category: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    q = db.query(Product)
    if active_only:
        q = q.filter_by(is_active=True)
    if company_id:
        q = q.filter_by(company_id=company_id)
    if category:
        q = q.filter_by(category=category)
    return q.order_by(Product.name).all()


@router.get("/low-stock", response_model=list[ProductOut])
def low_stock(db: Session = Depends(get_db)):
    from sqlalchemy import text
    products = db.query(Product).filter(
        Product.is_active == True,
        Product.current_stock < Product.reorder_level,
    ).all()
    return products


@router.post("", response_model=ProductOut, status_code=201)
def create_product(body: ProductCreate, db: Session = Depends(get_db)):
    product = Product(**body.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: UUID, db: Session = Depends(get_db)):
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    return p


@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: UUID, body: ProductUpdate, db: Session = Depends(get_db)):
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{product_id}", status_code=204)
def delete_product(product_id: UUID, db: Session = Depends(get_db)):
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    p.is_active = False
    db.commit()


@router.post("/{product_id}/stock")
def update_stock(product_id: UUID, body: StockUpdateIn, db: Session = Depends(get_db)):
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    log = InventoryLog(
        product_id=product_id,
        previous_stock=p.current_stock,
        new_stock=body.new_stock,
        change_reason=body.change_reason,
        updated_by=body.updated_by,
    )
    p.current_stock = body.new_stock
    db.add(log)
    db.commit()
    return {"product_id": str(product_id), "new_stock": body.new_stock}


@router.post("/{product_id}/alias")
def add_alias(product_id: UUID, alias: str, db: Session = Depends(get_db)):
    from app.utils.fuzzy_match import save_alias
    save_alias(db, str(product_id), alias)
    return {"ok": True}
