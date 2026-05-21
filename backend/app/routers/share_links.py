import secrets
from datetime import datetime, timedelta
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import OrderShareToken, OrderSplit, OrderItem
from app.services.pdf_generator import generate_order_pdf

router = APIRouter(prefix="/api/share", tags=["share"])


@router.post("/generate/{order_split_id}")
def generate_share_link(order_split_id: UUID, db: Session = Depends(get_db)):
    split = db.get(OrderSplit, order_split_id)
    if not split:
        raise HTTPException(404, "Order split not found")

    db.query(OrderShareToken).filter_by(
        order_split_id=order_split_id, is_active=True
    ).update({"is_active": False})

    token = secrets.token_urlsafe(48)
    share = OrderShareToken(
        order_split_id=str(order_split_id),
        token=token,
        expires_at=datetime.utcnow() + timedelta(days=30),
        is_active=True,
    )
    db.add(share)
    db.commit()
    return {
        "token": token,
        "link": f"/order/{token}",
        "expires_at": share.expires_at.isoformat(),
    }


@router.get("/view/{token}")
def view_shared_order(token: str, db: Session = Depends(get_db)):
    share = db.query(OrderShareToken).filter_by(token=token, is_active=True).first()
    if not share:
        raise HTTPException(404, "Order link not found or expired")
    if share.expires_at < datetime.utcnow():
        raise HTTPException(410, "Order link has expired")

    share.view_count += 1
    if not share.viewed_at:
        share.viewed_at = datetime.utcnow()
    db.commit()

    split = share.order_split
    company = split.company
    order = split.order
    items = (
        db.query(OrderItem)
        .filter_by(order_id=split.order_id, company_id=split.company_id)
        .all()
    )

    return {
        "company_name": company.name,
        "order_month": str(order.order_month),
        "items": [
            {
                "product_name": item.product.name,
                "sku": item.product.sku,
                "unit_size": item.product.unit_size,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price or 0),
                "line_total": float(item.line_total or 0),
                "case_pack": item.product.case_pack,
            }
            for item in items
        ],
        "subtotal": float(split.subtotal or 0),
        "item_count": split.item_count,
        "status": split.status,
    }


@router.get("/pdf/{token}")
def download_pdf(token: str, db: Session = Depends(get_db)):
    order_data = view_shared_order(token, db)
    pdf_bytes = generate_order_pdf(order_data)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="order-{token[:8]}.pdf"'},
    )


@router.post("/confirm/{token}")
def confirm_receipt(token: str, db: Session = Depends(get_db)):
    share = db.query(OrderShareToken).filter_by(token=token, is_active=True).first()
    if not share:
        raise HTTPException(404)
    share.order_split.status = "confirmed"
    share.order_split.confirmed_at = datetime.utcnow()
    db.commit()
    return {"status": "confirmed"}


@router.delete("/revoke/{token}", status_code=204)
def revoke_link(token: str, db: Session = Depends(get_db)):
    share = db.query(OrderShareToken).filter_by(token=token).first()
    if share:
        share.is_active = False
        db.commit()
