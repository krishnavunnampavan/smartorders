from __future__ import annotations
from decimal import Decimal
from datetime import date
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session
from app.models import PriceHistory, Product

DEAL_THRESHOLD = Decimal("-0.50")
HOLD_THRESHOLD = Decimal("0.25")
BOOST_QTY_PCT = 0.20
RECOVERY_HOLD_MONTHS = 1


def classify_price_change(change: Decimal, months_on_hold: int) -> str:
    if change <= DEAL_THRESHOLD and months_on_hold >= RECOVERY_HOLD_MONTHS:
        return "RECOVERY_DEAL"
    if change <= DEAL_THRESHOLD:
        return "DEAL"
    if change >= HOLD_THRESHOLD:
        return "HOLD"
    return "STABLE"


def suggest_quantity(product: Product, status: str) -> int:
    base = product.reorder_level or 2
    if status == "RECOVERY_DEAL":
        return int(base * 1.5)
    if status == "DEAL":
        return int(base * 1.2)
    if status == "HOLD":
        return 0
    return base


def process_catalog_prices(
    db: Session,
    company_id: str,
    upload_month: date,
    parsed_items: list[dict],
    catalog_upload_id: str | None = None,
) -> dict:
    from app.utils.fuzzy_match import match_product

    last_month = upload_month - relativedelta(months=1)
    results = {
        "deals": [],
        "holds": [],
        "stable": [],
        "new_items": [],
        "savings_potential": 0.0,
        "upload_month": str(upload_month),
    }

    for item in parsed_items:
        product = match_product(db, item.get("name", ""), company_id)
        if not product:
            results["new_items"].append(item)
            continue

        last_row = (
            db.query(PriceHistory)
            .filter_by(product_id=product.id, effective_month=last_month)
            .first()
        )

        new_price = Decimal(str(item.get("unit_price", 0) or 0))
        prev_price = last_row.unit_price if last_row else new_price
        change = new_price - prev_price

        months_held = 0
        if last_row and last_row.status == "HOLD":
            months_held = (last_row.months_on_hold or 0) + 1
        elif change < HOLD_THRESHOLD:
            months_held = 0

        status = classify_price_change(change, months_held)
        change_pct = float((change / prev_price) * 100) if prev_price else 0.0

        # Upsert price history row
        existing = (
            db.query(PriceHistory)
            .filter_by(product_id=product.id, effective_month=upload_month)
            .first()
        )
        if existing:
            existing.unit_price = new_price
            existing.case_price = Decimal(str(item.get("case_price", 0) or 0)) or None
            existing.prev_unit_price = prev_price
            existing.price_change = change
            existing.price_change_pct = Decimal(str(change_pct))
            existing.status = status
            existing.months_on_hold = months_held
            existing.catalog_upload_id = catalog_upload_id
        else:
            ph = PriceHistory(
                product_id=product.id,
                company_id=company_id,
                effective_month=upload_month,
                unit_price=new_price,
                case_price=Decimal(str(item.get("case_price", 0) or 0)) or None,
                prev_unit_price=prev_price,
                price_change=change,
                price_change_pct=Decimal(str(change_pct)),
                status=status,
                months_on_hold=months_held,
                catalog_upload_id=catalog_upload_id,
            )
            db.add(ph)

        suggested_qty = suggest_quantity(product, status)
        entry = {
            "product_id": str(product.id),
            "product_name": product.name,
            "sku": product.sku,
            "prev_price": float(prev_price),
            "new_price": float(new_price),
            "change": float(change),
            "change_pct": round(change_pct, 2),
            "status": status,
            "months_on_hold": months_held,
            "suggested_qty": suggested_qty,
        }

        if status in ("DEAL", "RECOVERY_DEAL"):
            results["deals"].append(entry)
            results["savings_potential"] += abs(float(change)) * suggested_qty
        elif status == "HOLD":
            results["holds"].append(entry)
        else:
            results["stable"].append(entry)

    db.commit()
    return results


def build_smart_order(db: Session, order_month: date) -> dict:
    current_prices = (
        db.query(PriceHistory).filter_by(effective_month=order_month).all()
    )
    order_items = []
    for ph in current_prices:
        if ph.status == "HOLD":
            continue
        product = db.get(Product, ph.product_id)
        if not product or not product.is_active:
            continue
        qty = suggest_quantity(product, ph.status)
        if qty == 0:
            continue
        order_items.append({
            "product_id": str(ph.product_id),
            "product_name": product.name,
            "company_id": str(ph.company_id),
            "quantity": qty,
            "unit_price": float(ph.unit_price),
            "price_status": ph.status,
            "price_change": float(ph.price_change or 0),
            "source": "auto_deal" if ph.status in ("DEAL", "RECOVERY_DEAL") else "auto_normal",
        })

    return {
        "items": order_items,
        "month": str(order_month),
        "total_items": len(order_items),
        "deal_count": sum(1 for i in order_items if i["price_status"] in ("DEAL", "RECOVERY_DEAL")),
    }


def get_price_alerts(db: Session, month: date) -> dict:
    rows = db.query(PriceHistory).filter_by(effective_month=month).all()
    deals = []
    holds = []
    for ph in rows:
        product = db.get(Product, ph.product_id)
        if not product:
            continue
        entry = {
            "product_id": str(ph.product_id),
            "product_name": product.name,
            "company_id": str(ph.company_id),
            "status": ph.status,
            "change": float(ph.price_change or 0),
            "change_pct": float(ph.price_change_pct or 0),
            "new_price": float(ph.unit_price),
            "months_on_hold": ph.months_on_hold,
        }
        if ph.status in ("DEAL", "RECOVERY_DEAL"):
            deals.append(entry)
        elif ph.status == "HOLD":
            holds.append(entry)
    return {"deals": deals, "holds": holds}
