from __future__ import annotations
import uuid as _uuid
from sqlalchemy.orm import Session
from app.models import Order, OrderItem, OrderSplit, Company


def split_order_by_company(db: Session, order_id: str) -> list[dict]:
    """Group order items by company and create OrderSplit records."""
    # Normalise to UUID object so pg8000/PostgreSQL handles the type correctly.
    try:
        oid = _uuid.UUID(str(order_id))
    except (ValueError, AttributeError):
        return []

    order = db.get(Order, oid)
    if not order:
        return []

    # Remove existing splits
    db.query(OrderSplit).filter_by(order_id=oid).delete()

    items = db.query(OrderItem).filter_by(order_id=oid).all()

    # Group by company_id — keep as UUID/None, never stringify so None stays None.
    groups: dict = {}
    for item in items:
        key = item.company_id  # UUID object or None — do NOT use str()
        if key not in groups:
            groups[key] = []
        groups[key].append(item)

    splits = []
    for company_id, company_items in groups.items():
        subtotal = sum(float(i.line_total or 0) for i in company_items)
        split = OrderSplit(
            order_id=oid,
            company_id=company_id,  # UUID or None — both valid (no FK violation)
            item_count=len(company_items),
            subtotal=subtotal,
            status="pending",
        )
        db.add(split)
        db.flush()

        company = db.get(Company, company_id) if company_id else None
        splits.append({
            "split_id":    str(split.id),
            "company_id":  str(company_id) if company_id else None,
            "company_name": company.name if company else "Unassigned",
            "item_count":  len(company_items),
            "subtotal":    subtotal,
            "status":      "pending",
        })

    # Update order totals
    order.total_items      = len(items)
    order.total_value      = sum(float(i.line_total or 0) for i in items)
    order.deal_items_count = sum(1 for i in items if i.price_status in ("DEAL", "RECOVERY_DEAL"))
    order.held_items_count = sum(1 for i in items if getattr(i, "was_held", False))
    db.commit()
    return splits
