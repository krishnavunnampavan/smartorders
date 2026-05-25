"""
CART SERVICE — All persistent cart operations.

Every mutating function:
  1. Saves to PostgreSQL immediately
  2. Logs to cart_activity_log
  3. Broadcasts WebSocket event to all connected clients
"""
from __future__ import annotations
import uuid as _uuid
from datetime import datetime, date
from typing import Optional
from sqlalchemy.orm import Session
from app.models.cart import ActiveCart, CartItem, CartActivityLog
from app.models.product import Product
from app.models.company import Company


# ── Helpers ───────────────────────────────────────────────────────────────

def get_or_create_active_cart(db: Session) -> ActiveCart:
    """Return the single active cart, creating one if needed."""
    cart = db.query(ActiveCart).filter_by(status="active").first()
    if not cart:
        today = date.today()
        month = today.replace(day=1)
        cart = ActiveCart(
            order_number=f"ORD-{month.strftime('%Y-%m')}-001",
            order_month=month,
            status="active",
        )
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart


def cart_item_to_dict(item: CartItem) -> dict:
    return {
        "id":               str(item.id),
        "product_id":       str(item.product_id) if item.product_id else None,
        "product_name":     item.product_name,
        "category":         item.category,
        "company_id":       str(item.company_id) if item.company_id else None,
        "company_name":     item.company_name,
        "selected_size":    item.selected_size,
        "selected_unit":    item.selected_unit,
        "bottles_per_unit": item.bottles_per_unit,
        "quantity":         item.quantity,
        "total_bottles":    item.total_bottles,
        "unit_price":       float(item.unit_price or 0),
        "case_price":       float(item.case_price or 0),
        "effective_price":  float(item.effective_price or 0),
        "line_total":       float(item.line_total or 0),
        "price_status":     item.price_status,
        "price_change":     float(item.price_change or 0),
        "source":           item.source,
        "added_by":         item.added_by,
        "added_at":         item.added_at.isoformat() if item.added_at else None,
    }


def get_active_cart_full(db: Session) -> dict:
    """Return the complete current cart state (used on page load and WebSocket connect)."""
    cart = get_or_create_active_cart(db)
    items = db.query(CartItem).filter_by(cart_id=cart.id).order_by(CartItem.added_at).all()
    item_dicts = [cart_item_to_dict(i) for i in items]
    deal_items = [i for i in items if i.price_status in ("DEAL", "RECOVERY_DEAL") and (i.price_change or 0) < 0]
    return {
        "cart_id":      str(cart.id),
        "order_number": cart.order_number,
        "order_month":  cart.order_month.isoformat() if cart.order_month else None,
        "status":       cart.status,
        "updated_at":   cart.updated_at.isoformat() if cart.updated_at else None,
        "items":        item_dicts,
        "summary": {
            "total_items":   len(items),
            "total_bottles": sum(i.total_bottles or 0 for i in items),
            "subtotal":      float(sum(i.line_total or 0 for i in items)),
            "deal_count":    len(deal_items),
            "deal_savings":  float(sum(abs(i.price_change or 0) * i.quantity for i in deal_items)),
        },
    }


def _log(db: Session, cart_id, action: str, product_id=None, product_name: str = "",
         old_qty: Optional[int] = None, new_qty: Optional[int] = None,
         old_size: Optional[str] = None, new_size: Optional[str] = None,
         done_by: str = "manager"):
    try:
        log = CartActivityLog(
            cart_id=cart_id, action=action,
            product_id=product_id, product_name=product_name or "",
            old_qty=old_qty, new_qty=new_qty,
            old_size=old_size, new_size=new_size,
            done_by=done_by or "manager",
        )
        db.add(log)
        db.commit()
    except Exception:
        db.rollback()


# ── Mutations ─────────────────────────────────────────────────────────────

async def add_item_to_cart(
    db: Session,
    product_id: str,
    selected_size: str,
    selected_unit: str,
    bottles_per_unit: int,
    quantity: int,
    unit_price: float,
    case_price: float,
    effective_price: float,
    price_status: str = "STABLE",
    price_change: float = 0.0,
    source: str = "manual",
    added_by: str = "manager",
) -> dict:
    """Add item or merge with existing same product+size+unit."""
    from app.routers.ws_cart import broadcast_event

    cart = get_or_create_active_cart(db)

    # Lookup product and company for denormalized fields
    try:
        pid = _uuid.UUID(str(product_id))
    except (ValueError, AttributeError):
        pid = None

    product = db.get(Product, pid) if pid else None
    company = db.get(Company, product.company_id) if product and product.company_id else None

    line_total    = quantity * effective_price
    total_bottles = quantity * bottles_per_unit

    # Merge if same product + size + unit already in cart
    existing = (
        db.query(CartItem)
        .filter_by(
            cart_id=cart.id,
            product_id=pid,
            selected_size=selected_size,
            selected_unit=selected_unit,
        )
        .first()
    )

    if existing:
        old_qty = existing.quantity
        existing.quantity        = quantity
        existing.total_bottles   = total_bottles
        existing.effective_price = effective_price
        existing.line_total      = line_total
        existing.updated_at      = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        item_dict = cart_item_to_dict(existing)
        _log(db, cart.id, "updated", pid, existing.product_name, old_qty, quantity,
             existing.selected_size, selected_size, added_by)
        try:
            await broadcast_event({"type": "ITEM_UPDATED", "item": item_dict})
        except Exception:
            pass
    else:
        new_item = CartItem(
            cart_id          = cart.id,
            product_id       = pid,
            product_name     = product.name if product else "Unknown",
            category         = product.category if product else "",
            company_id       = product.company_id if product else None,
            company_name     = company.name if company else "Unassigned",
            selected_size    = selected_size,
            selected_unit    = selected_unit,
            bottles_per_unit = bottles_per_unit,
            quantity         = quantity,
            total_bottles    = total_bottles,
            unit_price       = unit_price,
            case_price       = case_price,
            effective_price  = effective_price,
            line_total       = line_total,
            price_status     = price_status,
            price_change     = price_change,
            source           = source,
            added_by         = added_by,
        )
        db.add(new_item)
        db.commit()
        db.refresh(new_item)
        item_dict = cart_item_to_dict(new_item)
        _log(db, cart.id, "added", pid, new_item.product_name, None, quantity, None, selected_size, added_by)
        try:
            await broadcast_event({"type": "ITEM_ADDED", "item": item_dict})
        except Exception:
            pass

    cart.updated_at = datetime.utcnow()
    db.commit()
    return item_dict


async def update_cart_item(
    db: Session,
    item_id: str,
    updates: dict,
    updated_by: str = "manager",
) -> dict:
    """Update qty, size, unit, or price of an existing cart item."""
    from app.routers.ws_cart import broadcast_event

    try:
        iid = _uuid.UUID(str(item_id))
    except (ValueError, AttributeError):
        raise ValueError(f"Invalid item ID: {item_id}")

    item = db.get(CartItem, iid)
    if not item:
        raise ValueError(f"Cart item {item_id} not found")

    old_qty  = item.quantity
    old_size = item.selected_size

    for field, value in updates.items():
        if hasattr(item, field) and field not in ("id", "cart_id"):
            setattr(item, field, value)

    # Recalculate totals
    item.total_bottles = item.quantity * (item.bottles_per_unit or 1)
    item.line_total    = item.quantity * float(item.effective_price or 0)
    item.updated_at    = datetime.utcnow()
    db.commit()
    db.refresh(item)

    item_dict = cart_item_to_dict(item)
    _log(db, item.cart_id, "updated", item.product_id, item.product_name,
         old_qty, item.quantity, old_size, item.selected_size, updated_by)
    try:
        await broadcast_event({"type": "ITEM_UPDATED", "item": item_dict})
    except Exception:
        pass

    cart = db.get(ActiveCart, item.cart_id)
    if cart:
        cart.updated_at = datetime.utcnow()
        db.commit()

    return item_dict


async def remove_cart_item(db: Session, item_id: str, removed_by: str = "manager") -> None:
    """Delete one cart item."""
    from app.routers.ws_cart import broadcast_event

    try:
        iid = _uuid.UUID(str(item_id))
    except (ValueError, AttributeError):
        return

    item = db.get(CartItem, iid)
    if not item:
        return

    _log(db, item.cart_id, "removed", item.product_id, item.product_name,
         item.quantity, None, item.selected_size, None, removed_by)
    db.delete(item)

    cart = db.get(ActiveCart, item.cart_id)
    if cart:
        cart.updated_at = datetime.utcnow()

    db.commit()
    try:
        await broadcast_event({"type": "ITEM_REMOVED", "item_id": item_id})
    except Exception:
        pass


async def clear_cart(db: Session, cleared_by: str = "manager") -> None:
    """Remove ALL items from the active cart."""
    from app.routers.ws_cart import broadcast_event

    cart = get_or_create_active_cart(db)
    db.query(CartItem).filter_by(cart_id=cart.id).delete()
    _log(db, cart.id, "cleared", None, None, None, None, None, None, cleared_by)
    cart.updated_at = datetime.utcnow()
    db.commit()
    try:
        await broadcast_event({"type": "CART_CLEARED"})
    except Exception:
        pass


async def submit_cart_to_order(db: Session, submitted_by: str = "manager") -> dict:
    """
    Convert active cart → Order + OrderItems + OrderSplits.
    Archives the cart, creates a new empty active cart.
    """
    from app.routers.ws_cart import broadcast_event
    from app.models.order import Order, OrderItem, OrderSplit
    from itertools import groupby

    cart  = get_or_create_active_cart(db)
    items = db.query(CartItem).filter_by(cart_id=cart.id).all()

    if not items:
        raise ValueError("Cart is empty")

    total_value = float(sum(i.line_total or 0 for i in items))

    order = Order(
        order_month  = cart.order_month,
        status       = "reviewed",
        total_items  = len(items),
        total_value  = total_value,
    )
    db.add(order)
    db.flush()

    for item in items:
        oi = OrderItem(
            order_id         = order.id,
            product_id       = item.product_id,
            company_id       = item.company_id,
            quantity         = item.quantity,
            unit_price       = item.effective_price,
            line_total       = item.line_total,
            selected_size    = item.selected_size,
            selected_unit    = item.selected_unit,
            bottles_per_unit = item.bottles_per_unit,
            total_bottles    = item.total_bottles,
            price_status     = item.price_status,
            price_change     = item.price_change,
            source           = item.source,
        )
        db.add(oi)

    # OrderSplits — one per company
    items_sorted = sorted(items, key=lambda i: str(i.company_id or ""))
    for cid_str, group in groupby(items_sorted, key=lambda i: str(i.company_id or "")):
        group_list = list(group)
        split = OrderSplit(
            order_id   = order.id,
            company_id = group_list[0].company_id,
            item_count = len(group_list),
            subtotal   = float(sum(i.line_total or 0 for i in group_list)),
            status     = "pending",
        )
        db.add(split)

    # Archive cart
    cart.status       = "submitted"
    cart.submitted_at = datetime.utcnow()
    cart.submitted_by = submitted_by
    db.commit()

    # Create new empty active cart
    today = date.today()
    month = today.replace(day=1)
    new_num = f"ORD-{month.strftime('%Y-%m')}-{str(_uuid.uuid4())[:4].upper()}"
    new_cart = ActiveCart(order_number=new_num, order_month=month, status="active")
    db.add(new_cart)
    db.commit()

    _log(db, cart.id, "submitted", None, None, None, None, None, None, submitted_by)
    try:
        await broadcast_event({"type": "CART_CLEARED"})
        await broadcast_event({"type": "CART_SUBMITTED", "order_id": str(order.id)})
    except Exception:
        pass

    return {"order_id": str(order.id), "order_number": str(order.id)[:8].upper()}
