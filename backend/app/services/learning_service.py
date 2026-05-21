from __future__ import annotations
"""
Self-learning service.

How it works:
1. Every AI parse is logged in ai_parse_log.
2. User corrections/confirmations are stored in user_feedback.
3. apply_pending_feedback() runs after each correction:
   - Saves new aliases to products table
   - Saves patterns to knowledge_base
   - Increments confidence scores for reliable patterns
4. get_context_hints() injects store-specific knowledge into AI prompts,
   making each subsequent parse smarter than the last.
"""
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.knowledge import KnowledgeBase, AIParseLog, UserFeedback
from app.models import Product
from app.utils.fuzzy_match import save_alias
import uuid


def log_parse(
    db: Session,
    input_type: str,
    raw_input: str,
    ai_provider: str,
    ai_model: str,
    parsed_output: list,
    resolved_items: list,
    unmatched_items: list,
    session_id: str | None = None,
) -> str:
    """Record every AI parse attempt. Returns log ID."""
    log = AIParseLog(
        input_type=input_type,
        raw_input=raw_input[:5000],
        ai_provider=ai_provider,
        ai_model=ai_model,
        parsed_output=parsed_output,
        resolved_items=resolved_items,
        unmatched_items=unmatched_items,
        session_id=session_id,
    )
    db.add(log)
    db.commit()
    return str(log.id)


def record_feedback(
    db: Session,
    original_text: str,
    ai_guess: str,
    correct_product_id: str | None,
    correct_product_name: str,
    feedback_type: str,
    parse_log_id: str | None = None,
) -> str:
    """Store a user correction or confirmation."""
    fb = UserFeedback(
        parse_log_id=parse_log_id,
        original_text=original_text,
        ai_guess=ai_guess,
        correct_product_id=correct_product_id,
        correct_product_name=correct_product_name,
        feedback_type=feedback_type,
    )
    db.add(fb)
    db.commit()

    # Immediately apply if it's a correction or confirmation
    if feedback_type in ("correction", "confirmation") and correct_product_id:
        _apply_feedback(db, fb)

    return str(fb.id)


def _apply_feedback(db: Session, fb: UserFeedback) -> None:
    """Apply a single feedback entry to the knowledge base."""
    if not fb.correct_product_id:
        return

    # 1. Save alias so fuzzy match learns this nickname
    if fb.original_text and fb.original_text.lower() != fb.correct_product_name.lower():
        save_alias(db, str(fb.correct_product_id), fb.original_text.lower())
        if fb.ai_guess and fb.ai_guess.lower() != fb.correct_product_name.lower():
            save_alias(db, str(fb.correct_product_id), fb.ai_guess.lower())

    # 2. Upsert into knowledge_base
    key = f"alias:{fb.original_text.lower()}"
    existing = db.query(KnowledgeBase).filter_by(
        category="product_alias", key=key, is_active=True
    ).first()
    if existing:
        existing.use_count += 1
        existing.confidence = min(1.0, existing.confidence + 0.05)
        existing.last_used_at = datetime.utcnow()
        existing.value = str(fb.correct_product_id)
    else:
        kb = KnowledgeBase(
            category="product_alias",
            key=key,
            value=str(fb.correct_product_id),
            meta={"product_name": fb.correct_product_name, "source_text": fb.original_text},
            confidence=0.9 if fb.feedback_type == "correction" else 0.7,
            source="user_confirmed",
            use_count=1,
            last_used_at=datetime.utcnow(),
        )
        db.add(kb)

    fb.applied = True
    db.commit()


def apply_pending_feedback(db: Session) -> int:
    """Batch-apply any unapplied feedback. Returns count applied."""
    pending = db.query(UserFeedback).filter_by(applied=False).all()
    count = 0
    for fb in pending:
        if fb.correct_product_id:
            _apply_feedback(db, fb)
            count += 1
    return count


def get_context_hints(db: Session, input_type: str = "text") -> str:
    """
    Build a store-specific context string to inject into AI prompts.
    Returns a formatted hint block listing known aliases and patterns.
    """
    # Fetch top-confidence aliases from knowledge base
    aliases = (
        db.query(KnowledgeBase)
        .filter_by(category="product_alias", is_active=True)
        .filter(KnowledgeBase.confidence >= 0.7)
        .order_by(KnowledgeBase.use_count.desc())
        .limit(50)
        .all()
    )

    if not aliases:
        return ""

    lines = ["STORE-SPECIFIC ALIASES (use these mappings):"]
    for a in aliases:
        product_name = a.meta.get("product_name", "") if a.meta else ""
        if product_name:
            lines.append(f'  "{a.key.replace("alias:", "")}" → "{product_name}"')

    return "\n".join(lines)


def record_order_pattern(db: Session, product_id: str, avg_qty: float, month: str) -> None:
    """Track ordering patterns per product for smarter suggestions."""
    key = f"order_pattern:{product_id}"
    existing = db.query(KnowledgeBase).filter_by(
        category="ordering_pattern", key=key
    ).first()
    if existing:
        # Rolling average
        old_avg = float(existing.meta.get("avg_qty", avg_qty))
        new_avg = round((old_avg * 0.7 + avg_qty * 0.3), 2)
        existing.meta = {**existing.meta, "avg_qty": new_avg, "last_month": month}
        existing.use_count += 1
        existing.updated_at = datetime.utcnow()
    else:
        db.add(KnowledgeBase(
            category="ordering_pattern",
            key=key,
            value=str(avg_qty),
            meta={"avg_qty": avg_qty, "product_id": product_id, "last_month": month},
            source="ai_inferred",
            use_count=1,
        ))
    db.commit()


def get_stats(db: Session) -> dict:
    """Return learning stats for the dashboard."""
    return {
        "total_aliases_learned": db.query(KnowledgeBase).filter_by(
            category="product_alias", is_active=True
        ).count(),
        "total_parse_logs": db.query(AIParseLog).count(),
        "total_corrections": db.query(UserFeedback).filter_by(
            feedback_type="correction"
        ).count(),
        "pending_feedback": db.query(UserFeedback).filter_by(applied=False).count(),
        "ordering_patterns": db.query(KnowledgeBase).filter_by(
            category="ordering_pattern"
        ).count(),
    }
