from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Order, OrderItem, Product, PriceHistory
from app.schemas.order import (
    OrderCreate, OrderUpdate, OrderOut,
    OrderItemCreate, OrderItemUpdate, OrderItemOut, OrderSplitOut,
)
from app.services.order_splitter import split_order_by_company
from app.services.price_engine import build_smart_order

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.get("", response_model=list[OrderOut])
def list_orders(db: Session = Depends(get_db)):
    return db.query(Order).order_by(Order.created_at.desc()).all()


@router.post("", response_model=OrderOut, status_code=201)
def create_order(body: OrderCreate, db: Session = Depends(get_db)):
    order = Order(**body.model_dump())
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.get("/smart-build")
def smart_build(month: date = Query(...), db: Session = Depends(get_db)):
    return build_smart_order(db, month)


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: UUID, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    return order


@router.put("/{order_id}", response_model=OrderOut)
def update_order(order_id: UUID, body: OrderUpdate, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(order, k, v)
    db.commit()
    db.refresh(order)
    return order


# --- Items ---

@router.get("/{order_id}/items")
def list_items(order_id: UUID, db: Session = Depends(get_db)):
    from app.models import Company
    items = db.query(OrderItem).filter_by(order_id=order_id).all()
    result = []
    for item in items:
        product = db.get(Product, item.product_id)
        company = db.get(Company, item.company_id) if item.company_id else None
        result.append({
            "id": str(item.id),
            "product_id": str(item.product_id),
            "company_id": str(item.company_id) if item.company_id else None,
            "quantity": item.quantity,
            "unit_price": float(item.unit_price) if item.unit_price else None,
            "line_total": float(item.line_total) if item.line_total else None,
            "price_status": item.price_status,
            "price_change": float(item.price_change) if item.price_change else None,
            "source": item.source,
            "was_held": item.was_held,
            "product_name": product.name if product else "Unknown Product",
            "company_name": company.name if company else None,
        })
    return result


@router.post("/{order_id}/items", response_model=OrderItemOut, status_code=201)
def add_item(order_id: UUID, body: OrderItemCreate, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")

    product = db.get(Product, body.product_id)
    if not product:
        raise HTTPException(404, "Product not found")

    # Look up current price
    unit_price = body.unit_price
    price_status = "STABLE"
    price_change = None
    if not unit_price:
        ph = (
            db.query(PriceHistory)
            .filter_by(product_id=body.product_id, effective_month=order.order_month)
            .first()
        )
        if ph:
            unit_price = ph.unit_price
            price_status = ph.status or "STABLE"
            price_change = ph.price_change

    line_total = (unit_price or 0) * body.quantity
    item = OrderItem(
        order_id=order_id,
        product_id=body.product_id,
        company_id=body.company_id,
        quantity=body.quantity,
        unit_price=unit_price,
        line_total=line_total,
        price_status=price_status,
        price_change=price_change,
        source=body.source,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{order_id}/items/{item_id}", response_model=OrderItemOut)
def update_item(order_id: UUID, item_id: UUID, body: OrderItemUpdate, db: Session = Depends(get_db)):
    item = db.get(OrderItem, item_id)
    if not item or str(item.order_id) != str(order_id):
        raise HTTPException(404, "Item not found")
    item.quantity = body.quantity
    item.line_total = (item.unit_price or 0) * body.quantity
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{order_id}/items/{item_id}", status_code=204)
def delete_item(order_id: UUID, item_id: UUID, db: Session = Depends(get_db)):
    item = db.get(OrderItem, item_id)
    if not item or str(item.order_id) != str(order_id):
        raise HTTPException(404, "Item not found")
    db.delete(item)
    db.commit()


# --- Splits ---

@router.post("/{order_id}/split")
def split_order(order_id: UUID, db: Session = Depends(get_db)):
    splits = split_order_by_company(db, str(order_id))
    return {"splits": splits}


@router.get("/{order_id}/splits")
def get_splits(order_id: UUID, db: Session = Depends(get_db)):
    from app.models import OrderSplit
    from app.models.company import Company
    splits = db.query(OrderSplit).filter_by(order_id=order_id).all()
    result = []
    for s in splits:
        company = db.get(Company, s.company_id) if s.company_id else None
        result.append({
            "id": str(s.id),
            "order_id": str(s.order_id),
            "company_id": str(s.company_id) if s.company_id else None,
            "company_name": company.name if company else None,
            "company_min_order": float(company.min_order_value) if company and company.min_order_value else None,
            "item_count": s.item_count,
            "subtotal": float(s.subtotal) if s.subtotal else 0,
            "status": s.status,
            "sent_at": s.sent_at.isoformat() if s.sent_at else None,
            "confirmed_at": s.confirmed_at.isoformat() if s.confirmed_at else None,
        })
    return result


@router.get("/{order_id}/combined-pdf")
def combined_order_pdf(order_id: UUID, db: Session = Depends(get_db)):
    from fastapi.responses import Response
    from app.models.company import Company
    from app.services.pdf_generator import generate_combined_pdf

    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")

    items = db.query(OrderItem).filter_by(order_id=order_id).all()

    groups: dict[str, dict] = {}
    misc_items: list[dict] = []

    for item in items:
        product = db.get(Product, item.product_id)
        item_dict = {
            "product_name": product.name if product else "Unknown Product",
            "sku": product.sku if product else "",
            "unit_size": product.unit_size if product else "",
            "pack": product.pack if product else "",
            "quantity": item.quantity,
            "unit_price": float(item.unit_price or 0),
            "line_total": float(item.line_total or 0),
            "price_status": item.price_status or "",
        }
        if item.company_id:
            cid = str(item.company_id)
            if cid not in groups:
                company = db.get(Company, item.company_id)
                groups[cid] = {
                    "company_name": company.name if company else "Unknown",
                    "items": [],
                    "subtotal": 0.0,
                    "is_misc": False,
                }
            groups[cid]["items"].append(item_dict)
            groups[cid]["subtotal"] += item_dict["line_total"]
        else:
            misc_items.append(item_dict)

    result_groups = list(groups.values())
    if misc_items:
        result_groups.append({
            "company_name": "Misc",
            "items": misc_items,
            "subtotal": sum(i["line_total"] for i in misc_items),
            "is_misc": True,
        })

    content = generate_combined_pdf(str(order.order_month), result_groups)
    is_html = content.startswith(b"<")
    ext = "html" if is_html else "pdf"
    media_type = "text/html" if is_html else "application/pdf"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="order-{str(order_id)[:8]}.{ext}"'},
    )
