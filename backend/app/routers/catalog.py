from __future__ import annotations
from typing import Optional
import base64
from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import CatalogUpload
from app.schemas.catalog import CatalogUploadOut, PriceCompareResult
from app.services.ai_service import AIService
from app.services.catalog_parser import (
    extract_text_from_pdf, extract_from_excel, image_to_base64
)
from app.services.price_engine import process_catalog_prices, get_price_alerts

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.post("/upload", response_model=CatalogUploadOut)
async def upload_catalog(
    company_id: UUID = Form(...),
    upload_month: date = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    content = await file.read()
    fname = file.filename or ""
    ext = fname.rsplit(".", 1)[-1].lower()

    upload = CatalogUpload(
        company_id=company_id,
        upload_month=upload_month,
        file_name=fname,
        file_type=ext,
        status="processing",
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    ai = AIService()
    parsed_items: list[dict] = []

    try:
        if ext in ("xlsx", "xls", "csv"):
            parsed_items = extract_from_excel(content)
            upload.ai_provider = "local"
        elif ext == "pdf":
            raw_text = extract_text_from_pdf(content)
            upload.raw_text = raw_text[:50000]
            parsed_items = await ai.parse_catalog_text(raw_text)
            upload.ai_provider = ai.get_active_provider()
        else:
            # image
            b64, media_type = image_to_base64(content, file.content_type or "image/jpeg")
            parsed_items = await ai.parse_catalog_image(b64, media_type)
            upload.ai_provider = "claude" if ai.claude_key else "openai"

        upload.items_parsed = len(parsed_items)
        upload.parsed_items = parsed_items

        result = process_catalog_prices(
            db, str(company_id), upload_month, parsed_items, str(upload.id)
        )
        upload.items_matched = (
            len(result["deals"]) + len(result["holds"]) + len(result["stable"])
        )
        upload.status = "complete"
    except Exception as e:
        upload.status = "error"
        upload.raw_text = (upload.raw_text or "") + f"\nERROR: {str(e)}"

    db.commit()
    db.refresh(upload)
    return upload


@router.get("/uploads", response_model=list[CatalogUploadOut])
def list_uploads(company_id: Optional[UUID] = None, db: Session = Depends(get_db)):
    q = db.query(CatalogUpload)
    if company_id:
        q = q.filter_by(company_id=company_id)
    return q.order_by(CatalogUpload.created_at.desc()).limit(50).all()


@router.get("/price-compare/{company_id}")
def price_compare(
    company_id: UUID,
    month: date = Query(...),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(
            __import__("app.models", fromlist=["PriceHistory"]).PriceHistory
        )
        .filter_by(company_id=company_id, effective_month=month)
        .all()
    )
    from app.models import Product
    deals, holds, stable = [], [], []
    for ph in rows:
        p = db.get(Product, ph.product_id)
        entry = {
            "product_id": str(ph.product_id),
            "product_name": p.name if p else "?",
            "sku": p.sku if p else None,
            "prev_price": float(ph.prev_unit_price or ph.unit_price),
            "new_price": float(ph.unit_price),
            "change": float(ph.price_change or 0),
            "change_pct": float(ph.price_change_pct or 0),
            "status": ph.status,
            "months_on_hold": ph.months_on_hold or 0,
            "suggested_qty": 0,
        }
        if ph.status in ("DEAL", "RECOVERY_DEAL"):
            deals.append(entry)
        elif ph.status == "HOLD":
            holds.append(entry)
        else:
            stable.append(entry)
    return {
        "upload_month": str(month),
        "deals": deals,
        "holds": holds,
        "stable": stable,
        "new_items": [],
        "savings_potential": sum(abs(e["change"]) for e in deals),
    }


@router.get("/alerts")
def price_alerts(month: date = Query(...), db: Session = Depends(get_db)):
    return get_price_alerts(db, month)
