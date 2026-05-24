from __future__ import annotations
import base64
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.ai_service import AIService
from app.services.learning_service import (
    log_parse, record_feedback, apply_pending_feedback,
    get_context_hints, get_stats,
)
from app.utils.fuzzy_match import match_product

router = APIRouter(prefix="/api/ai", tags=["ai"])


class FeedbackIn(BaseModel):
    original_text: str
    ai_guess: str
    correct_product_id: Optional[str] = None
    correct_product_name: str
    feedback_type: str = "correction"   # correction | confirmation | rejection
    parse_log_id: Optional[str] = None


@router.post("/voice")
async def voice_to_order(
    audio: UploadFile = File(...),
    mime_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    content = await audio.read()
    if not content:
        raise HTTPException(400, "Empty audio file")
    effective_mime = mime_type or audio.content_type or "audio/webm"
    ai = AIService()
    try:
        transcript = await ai.transcribe_audio(content, effective_mime)
    except ValueError as e:
        raise HTTPException(400, str(e))

    # Inject store-specific context hints into the prompt
    hints = get_context_hints(db, "voice")
    parsed = await ai.parse_order_text(transcript, context_hints=hints)

    result = _resolve_products(parsed, db, "voice", transcript)

    # Log for self-learning
    log_parse(
        db, "voice", transcript,
        ai.get_active_provider(), "whisper-1 + gpt-4o",
        parsed, result["resolved"], result["unmatched"],
    )
    return result


@router.post("/photo")
async def photo_to_order(image: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await image.read()
    b64 = base64.b64encode(content).decode()
    media_type = image.content_type or "image/jpeg"
    ai = AIService()
    try:
        parsed = await ai.parse_catalog_image(b64, media_type)
    except ValueError as e:
        raise HTTPException(400, str(e))

    result = _resolve_products(parsed, db, "photo")
    log_parse(
        db, "photo", f"[image:{media_type}]",
        ai.get_active_provider(), "claude-opus-4-5-vision",
        parsed, result["resolved"], result["unmatched"],
    )
    return result


@router.post("/parse-text")
async def parse_text(body: dict, db: Session = Depends(get_db)):
    raw = body.get("text", "")
    if not raw:
        raise HTTPException(400, "text field required")
    ai = AIService()
    hints = get_context_hints(db, "text")
    parsed = await ai.parse_order_text(raw, context_hints=hints)
    result = _resolve_products(parsed, db, "manual", raw)
    log_parse(
        db, "text", raw,
        ai.get_active_provider(), "gpt-4o",
        parsed, result["resolved"], result["unmatched"],
    )
    return result


@router.post("/feedback")
def submit_feedback(body: FeedbackIn, db: Session = Depends(get_db)):
    """User corrects an AI parse — immediately trains the system."""
    fb_id = record_feedback(
        db,
        original_text=body.original_text,
        ai_guess=body.ai_guess,
        correct_product_id=body.correct_product_id,
        correct_product_name=body.correct_product_name,
        feedback_type=body.feedback_type,
        parse_log_id=body.parse_log_id,
    )
    return {"feedback_id": fb_id, "applied": True}


@router.post("/apply-feedback")
def batch_apply_feedback(db: Session = Depends(get_db)):
    """Run pending feedback batch — call from cron or admin panel."""
    count = apply_pending_feedback(db)
    return {"applied": count}


@router.get("/learning-stats")
def learning_stats(db: Session = Depends(get_db)):
    return get_stats(db)


def _resolve_products(parsed: list[dict], db: Session, source: str, transcript: str = "") -> dict:
    resolved = []
    unmatched = []
    for item in parsed:
        name = item.get("name", "")
        product = match_product(db, name)
        if product:
            resolved.append({
                "product_id": str(product.id),
                "product_name": product.name,
                "company_id": str(product.company_id) if product.company_id else None,
                "quantity": item.get("qty", 1),
                "unit": item.get("unit", "cases"),
                "matched_from": name,
                "source": source,
            })
        else:
            unmatched.append({"name": name, "qty": item.get("qty", 1)})
    return {
        "resolved": resolved,
        "unmatched": unmatched,
        "transcript": transcript,
        "total_parsed": len(parsed),
    }
