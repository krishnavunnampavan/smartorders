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
from app.utils.size_prices import calculate_effective_price, get_size_options, get_unit_options

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
            "selected_size": item.selected_size or "750ml",
            "selected_unit": item.selected_unit or "Case",
            "bottles_per_unit": item.bottles_per_unit or 1,
            "total_bottles": item.total_bottles,
            "product_name": product.name if product else "Unknown Product",
            "company_name": company.name if company else None,
            "item_note": item.item_note,
            "item_name_override": item.item_name_override,
            "is_struck": bool(item.is_struck),
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
    base_unit_price = body.unit_price
    price_status = "STABLE"
    price_change = None
    if not base_unit_price:
        ph = (
            db.query(PriceHistory)
            .filter_by(product_id=body.product_id, effective_month=order.order_month)
            .first()
        )
        if ph:
            base_unit_price = ph.unit_price
            price_status = ph.status or "STABLE"
            price_change = ph.price_change

    # Calculate effective price for selected size + unit
    selected_size = body.selected_size or "750ml"
    selected_unit = body.selected_unit or "Case"
    try:
        pack_str = str(product.pack or "").strip()
        case_pack = int(pack_str.split("/")[0]) if pack_str else 12
    except (ValueError, AttributeError):
        case_pack = 12

    pricing = calculate_effective_price(
        float(base_unit_price) if base_unit_price else None,
        selected_size, selected_unit, body.quantity, case_pack,
    )

    item = OrderItem(
        order_id=order_id,
        product_id=body.product_id,
        company_id=body.company_id,
        quantity=body.quantity,
        unit_price=pricing["unit_price"],
        line_total=pricing["line_total"],
        price_status=price_status,
        price_change=price_change,
        source=body.source,
        selected_size=selected_size,
        selected_unit=selected_unit,
        bottles_per_unit=pricing["bottles_per_unit"],
        total_bottles=pricing["total_bottles"],
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

    # Handle metadata-only fields (no pricing recalc needed)
    if body.is_struck is not None:
        item.is_struck = body.is_struck
    if body.item_note is not None:
        item.item_note = body.item_note
    if body.item_name_override is not None:
        item.item_name_override = body.item_name_override or None
    if body.company_id is not None:
        item.company_id = body.company_id

    # Recalculate pricing only when qty/size/unit are being changed
    pricing_fields = (body.quantity, body.selected_size, body.selected_unit, body.bottles_per_unit)
    if any(f is not None for f in pricing_fields):
        product = db.get(Product, item.product_id)
        try:
            pack_str = str((product.pack if product else None) or "").strip()
            case_pack = int(pack_str.split("/")[0]) if pack_str else 12
        except (ValueError, AttributeError):
            case_pack = 12

        qty = body.quantity if body.quantity is not None else item.quantity
        sel_size = body.selected_size or item.selected_size or "750ml"
        sel_unit = body.selected_unit or item.selected_unit or "Case"

        base_price = float(product.unit_price) if product and product.unit_price else None
        pricing = calculate_effective_price(base_price, sel_size, sel_unit, qty, case_pack)

        item.quantity = qty
        item.selected_size = sel_size
        item.selected_unit = sel_unit
        item.bottles_per_unit = pricing["bottles_per_unit"]
        item.total_bottles = pricing["total_bottles"]
        item.unit_price = pricing["unit_price"]
        item.line_total = pricing["line_total"]

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


@router.get("/{order_id}/pdf/master")
def master_order_pdf(order_id: UUID, db: Session = Depends(get_db)):
    """All distributors combined into one PDF."""
    from fastapi.responses import Response
    from app.models.company import Company
    from app.services.pdf_generator import generate_combined_pdf

    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")

    groups = _build_order_groups(db, order_id)
    content = generate_combined_pdf(str(order.order_month), groups)
    is_html = content.startswith(b"<")
    ext = "html" if is_html else "pdf"
    media = "text/html" if is_html else "application/pdf"
    return Response(
        content=content, media_type=media,
        headers={"Content-Disposition": f'inline; filename="master-{str(order_id)[:8]}.{ext}"'},
    )


@router.get("/{order_id}/pdf/{company_id}")
def company_order_pdf(order_id: UUID, company_id: UUID, db: Session = Depends(get_db)):
    """Single distributor PDF."""
    from fastapi.responses import Response
    from app.models.company import Company
    from app.services.pdf_generator import generate_order_pdf

    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")

    items = db.query(OrderItem).filter_by(order_id=order_id, company_id=company_id).all()
    item_dicts = [_item_to_dict(db, i) for i in items]
    subtotal = sum(i["line_total"] for i in item_dicts)

    order_data = {
        "order_month": str(order.order_month),
        "company_name": company.name,
        "items": item_dicts,
        "subtotal": subtotal,
    }
    content = generate_order_pdf(order_data)
    is_html = content.startswith(b"<")
    ext = "html" if is_html else "pdf"
    media = "text/html" if is_html else "application/pdf"
    dist_slug = company.name.lower().replace(" ", "-")[:20]
    return Response(
        content=content, media_type=media,
        headers={"Content-Disposition": f'inline; filename="order-{dist_slug}-{str(order_id)[:8]}.{ext}"'},
    )


def _item_to_dict(db, item: OrderItem) -> dict:
    from app.models.company import Company
    product = db.get(Product, item.product_id)
    return {
        "product_name": item.item_name_override or (product.name if product else "Unknown Product"),
        "sku": product.sku if product else "",
        "unit_size": item.selected_size or (product.unit_size if product else ""),
        "pack": product.pack if product else "",
        "quantity": item.quantity,
        "selected_unit": item.selected_unit or "Case",
        "bottles_per_unit": item.bottles_per_unit or 1,
        "total_bottles": item.total_bottles or item.quantity,
        "unit_price": float(item.unit_price or 0),
        "line_total": float(item.line_total or 0),
        "price_status": item.price_status or "",
        "price_change": float(item.price_change or 0),
        "is_struck": bool(item.is_struck),
        "item_note": item.item_note or "",
    }


def _build_order_groups(db, order_id) -> list[dict]:
    from app.models.company import Company
    items = db.query(OrderItem).filter_by(order_id=order_id).all()
    groups: dict[str, dict] = {}
    misc_items: list[dict] = []

    for item in items:
        item_dict = _item_to_dict(db, item)
        if item.company_id:
            cid = str(item.company_id)
            if cid not in groups:
                company = db.get(Company, item.company_id)
                groups[cid] = {
                    "company_id": cid,
                    "company_name": company.name if company else "Unknown",
                    "items": [],
                    "subtotal": 0.0,
                    "is_misc": False,
                }
            groups[cid]["items"].append(item_dict)
            groups[cid]["subtotal"] += item_dict["line_total"]
        else:
            misc_items.append(item_dict)

    result = list(groups.values())
    if misc_items:
        result.append({
            "company_id": None,
            "company_name": "Misc / Unassigned",
            "items": misc_items,
            "subtotal": sum(i["line_total"] for i in misc_items),
            "is_misc": True,
        })
    return result


@router.get("/{order_id}/combined-pdf")
def combined_order_pdf(order_id: UUID, db: Session = Depends(get_db)):
    from fastapi.responses import Response
    from app.services.pdf_generator import generate_combined_pdf

    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")

    result_groups = _build_order_groups(db, order_id)
    content = generate_combined_pdf(str(order.order_month), result_groups)
    is_html = content.startswith(b"<")
    ext = "html" if is_html else "pdf"
    media_type = "text/html" if is_html else "application/pdf"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="order-{str(order_id)[:8]}.{ext}"'},
    )
