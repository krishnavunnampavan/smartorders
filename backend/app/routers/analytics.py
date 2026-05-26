from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Order, OrderItem, OrderSplit, Product
from app.models.company import Company

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary")
def analytics_summary(db: Session = Depends(get_db)):
    """Return all analytics data the frontend needs in a single call."""

    # ── Monthly totals (last 6 months) ────────────────────────────────────
    orders = (
        db.query(Order)
        .filter(Order.status != "draft")
        .order_by(Order.order_month)
        .all()
    )
    # Group by YYYY-MM string
    monthly: dict[str, dict] = {}
    for o in orders:
        key = str(o.order_month)[:7]  # "2026-05"
        if key not in monthly:
            monthly[key] = {"month": key, "total": 0.0, "deal_count": 0, "savings": 0.0}
        monthly[key]["total"] += float(o.total_value or 0)
        monthly[key]["deal_count"] += int(o.deal_items_count or 0)
        monthly[key]["savings"] += float(o.savings_vs_last_month or 0)

    monthly_totals = sorted(monthly.values(), key=lambda x: x["month"])[-6:]

    # ── Spend by distributor (from splits) ────────────────────────────────
    splits = db.query(OrderSplit).all()
    company_totals: dict[str, float] = {}
    company_names: dict[str, str] = {}
    for split in splits:
        if not split.company_id:
            continue
        cid = str(split.company_id)
        if cid not in company_names:
            company = db.get(Company, split.company_id)
            company_names[cid] = company.name if company else "Unknown"
        company_totals[cid] = company_totals.get(cid, 0.0) + float(split.subtotal or 0)

    by_company = [
        {"company": company_names[cid], "total": round(total, 2)}
        for cid, total in sorted(company_totals.items(), key=lambda x: -x[1])
    ][:8]

    # ── Spend by category (order items → products) ────────────────────────
    items = db.query(OrderItem).all()
    cat_totals: dict[str, float] = {}
    for item in items:
        product = db.get(Product, item.product_id)
        cat = (product.category if product else None) or "Other"
        cat_totals[cat] = cat_totals.get(cat, 0.0) + float(item.line_total or 0)

    by_category = [
        {"category": cat, "total": round(total, 2)}
        for cat, total in sorted(cat_totals.items(), key=lambda x: -x[1])
        if total > 0
    ]

    # ── Quick KPIs ─────────────────────────────────────────────────────────
    total_spent = sum(float(o.total_value or 0) for o in orders)
    total_savings = sum(float(o.savings_vs_last_month or 0) for o in orders)
    total_orders = len(orders)

    return {
        "kpis": {
            "total_spent": round(total_spent, 2),
            "total_savings": round(total_savings, 2),
            "total_orders": total_orders,
            "avg_order_value": round(total_spent / total_orders, 2) if total_orders else 0,
        },
        "monthly_totals": monthly_totals,
        "by_company": by_company,
        "by_category": by_category,
    }
