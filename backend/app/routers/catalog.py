from __future__ import annotations
from typing import Optional
import base64
from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import CatalogUpload
from app.schemas.catalog import CatalogUploadOut
from app.services.ai_service import AIService
from app.services.catalog_parser import (
    extract_text_from_pdf, extract_from_excel, image_to_base64
)
from app.services.price_engine import process_catalog_prices, get_price_alerts
from app.services.company_extractor import extract_company_from_text, find_or_create_company

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.post("/upload", response_model=CatalogUploadOut)
async def upload_catalog(
    upload_month: date = Form(...),
    file: UploadFile = File(...),
    # company_id is now OPTIONAL — we auto-detect from catalog if not supplied
    company_id: Optional[UUID] = Form(default=None),
    db: Session = Depends(get_db),
):
    content = await file.read()
    fname = file.filename or ""
    ext = fname.rsplit(".", 1)[-1].lower()

    ai = AIService()
    parsed_items: list[dict] = []
    raw_text = ""
    ai_provider = "local"

    # ── 1. Parse the file ──────────────────────────────────────────────────
    try:
        if ext in ("xlsx", "xls", "csv"):
            parsed_items = extract_from_excel(content)
        elif ext == "pdf":
            raw_text = extract_text_from_pdf(content)
            parsed_items = await ai.parse_catalog_text(raw_text)
            ai_provider = ai.get_active_provider()
        else:
            b64, media_type = image_to_base64(content, file.content_type or "image/jpeg")
            parsed_items = await ai.parse_catalog_image(b64, media_type)
            ai_provider = "claude" if ai.claude_key else "openai"
    except Exception as e:
        raw_text += f"\nPARSE ERROR: {e}"

    # ── 2. Auto-detect company if not provided ─────────────────────────────
    resolved_company_id = company_id
    auto_company_info = None

    if not resolved_company_id:
        # Use raw_text (PDF/text) or filename as hint
        source_text = raw_text or fname
        company_info = await extract_company_from_text(
            source_text,
            ai_service=ai if (ai.openai_key or ai.claude_key) else None,
        )
        if company_info.get("name"):
            company, created = find_or_create_company(db, company_info)
            if company:
                resolved_company_id = company.id
                auto_company_info = {
                    "id": str(company.id),
                    "name": company.name,
                    "was_created": created,
                }

    if not resolved_company_id:
        raise HTTPException(
            400,
            "Could not detect company from catalog. "
            "Please select a company manually or ensure the catalog header has the company name.",
        )

    # ── 3. Save upload record ──────────────────────────────────────────────
    upload = CatalogUpload(
        company_id=resolved_company_id,
        upload_month=upload_month,
        file_name=fname,
        file_type=ext,
        raw_text=raw_text[:50000],
        status="processing",
        ai_provider=ai_provider,
        items_parsed=len(parsed_items),
        parsed_items=parsed_items,
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    # ── 4. Run price intelligence ──────────────────────────────────────────
    try:
        result = process_catalog_prices(
            db, str(resolved_company_id), upload_month, parsed_items, str(upload.id)
        )
        upload.items_matched = (
            len(result["deals"]) + len(result["holds"]) + len(result["stable"])
        )
        upload.status = "complete"
    except Exception as e:
        upload.status = "error"
        upload.raw_text = (upload.raw_text or "") + f"\nPRICE ENGINE ERROR: {e}"

    db.commit()
    db.refresh(upload)

    # Attach auto-detected company info to response for UI feedback
    response = CatalogUploadOut.model_validate(upload)
    if auto_company_info:
        # Attach as extra field (Pydantic v2 allows this via model_config)
        response.__dict__["auto_company"] = auto_company_info

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
    from app.models import PriceHistory, Product
    rows = db.query(PriceHistory).filter_by(company_id=company_id, effective_month=month).all()
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
