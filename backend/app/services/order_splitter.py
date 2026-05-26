from __future__ import annotations
import uuid as _uuid
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.models import Order, OrderItem, OrderSplit, Company
from app.models.order_share_token import OrderShareToken


def split_order_by_company(db: Session, order_id: str) -> list[dict]:
    """Group order items by company and create OrderSplit records."""
    try:
        oid = _uuid.UUID(str(order_id))
    except (ValueError, AttributeError):
        return []

    order = db.get(Order, oid)
    if not order:
        return []

    # Collect existing split IDs so we can delete their FK-dependent share tokens first.
    existing_split_ids = [
        row[0] for row in db.query(OrderSplit.id).filter_by(order_id=oid).all()
    ]

    # Must delete share tokens before splits — order_share_tokens.order_split_id has no
    # ON DELETE CASCADE, so PostgreSQL rejects the split DELETE if tokens exist.
    if existing_split_ids:
        db.query(OrderShareToken).filter(
            OrderShareToken.order_split_id.in_(existing_split_ids)
        ).delete(synchronize_session=False)

    db.query(OrderSplit).filter_by(order_id=oid).delete(synchronize_session=False)
    db.flush()

    items = db.query(OrderItem).filter_by(order_id=oid).all()

    # Group by company_id — keep as UUID/None, never stringify (str(None)='None' breaks FK).
    groups: dict = {}
    for item in items:
        key = item.company_id  # UUID object or None
        if key not in groups:
            groups[key] = []
        groups[key].append(item)

    splits = []
    for company_id, company_items in groups.items():
        subtotal = sum(float(i.line_total or 0) for i in company_items)
        split = OrderSplit(
            order_id=oid,
            company_id=company_id,  # UUID or None — both valid
            item_count=len(company_items),
            subtotal=subtotal,
            status="pending",
        )
        db.add(split)
        db.flush()

        company = db.get(Company, company_id) if company_id else None
        splits.append({
            "split_id":     str(split.id),
            "company_id":   str(company_id) if company_id else None,
            "company_name": company.name if company else "Unassigned",
            "item_count":   len(company_items),
            "subtotal":     subtotal,
            "status":       "pending",
        })

    order.total_items      = len(items)
    order.total_value      = sum(float(i.line_total or 0) for i in items)
    order.deal_items_count = sum(1 for i in items if i.price_status in ("DEAL", "RECOVERY_DEAL"))
    order.held_items_count = sum(1 for i in items if getattr(i, "was_held", False))
    db.commit()
    return splits
