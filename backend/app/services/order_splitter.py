from __future__ import annotations
from sqlalchemy.orm import Session
from app.models import Order, OrderItem, OrderSplit, Company
import uuid


def split_order_by_company(db: Session, order_id: str) -> list[dict]:
    """Group order items by company and create OrderSplit records."""
    order = db.get(Order, order_id)
    if not order:
        return []

    # Remove existing splits
    db.query(OrderSplit).filter_by(order_id=order_id).delete()

    items = db.query(OrderItem).filter_by(order_id=order_id).all()

    # Group by company
    groups: dict[str, list[OrderItem]] = {}
    for item in items:
        key = str(item.company_id)
        groups.setdefault(key, []).append(item)

    splits = []
    for company_id, company_items in groups.items():
        subtotal = sum(float(i.line_total or 0) for i in company_items)
        split = OrderSplit(
            order_id=order_id,
            company_id=company_id,
            item_count=len(company_items),
            subtotal=subtotal,
            status="pending",
        )
        db.add(split)
        db.flush()

        company = db.get(Company, company_id)
        splits.append({
            "split_id": str(split.id),
            "company_id": company_id,
            "company_name": company.name if company else "Unknown",
            "item_count": len(company_items),
            "subtotal": subtotal,
            "status": "pending",
        })

    # Update order totals
    order.total_items = len(items)
    order.total_value = sum(float(i.line_total or 0) for i in items)
    order.deal_items_count = sum(1 for i in items if i.price_status in ("DEAL", "RECOVERY_DEAL"))
    order.held_items_count = sum(1 for i in items if i.was_held)
    db.commit()
    return splits
