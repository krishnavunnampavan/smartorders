from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db, get_setting, set_setting
from app.services.ai_service import AIService
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/settings", tags=["settings"])


class APIKeysIn(BaseModel):
    openai_key: Optional[str] = None
    claude_key: Optional[str] = None
    preferred_provider: str = "auto"


class TestKeyIn(BaseModel):
    provider: str
    key: str


class StoreInfo(BaseModel):
    store_name: Optional[str] = None
    store_address: Optional[str] = None
    store_phone: Optional[str] = None
    store_email: Optional[str] = None


@router.post("/api-keys")
def save_api_keys(body: APIKeysIn, db: Session = Depends(get_db)):
    if body.openai_key is not None:
        set_setting("openai_api_key", body.openai_key)
    if body.claude_key is not None:
        set_setting("claude_api_key", body.claude_key)
    set_setting("preferred_ai_provider", body.preferred_provider)
    return {"ok": True}


@router.get("/ai-status")
def ai_status():
    openai_key = get_setting("openai_api_key")
    claude_key = get_setting("claude_api_key")
    preferred = get_setting("preferred_ai_provider") or "auto"
    return {
        "openai": "connected" if openai_key else "not_set",
        "claude": "connected" if claude_key else "not_set",
        "preferred_provider": preferred,
    }


@router.post("/test-ai-key")
async def test_key(body: TestKeyIn):
    ai = AIService()
    ok = await ai.test_key(body.provider, body.key)
    return {"provider": body.provider, "status": "connected" if ok else "invalid"}


@router.get("/store")
def get_store():
    return {
        "store_name": get_setting("store_name") or "",
        "store_address": get_setting("store_address") or "",
        "store_phone": get_setting("store_phone") or "",
        "store_email": get_setting("store_email") or "",
    }


@router.post("/store")
def update_store(body: StoreInfo):
    for k, v in body.model_dump(exclude_none=True).items():
        set_setting(k, v)
    return {"ok": True}


@router.get("/rules")
def get_rules(db: Session = Depends(get_db)):
    from app.models import OrderRule
    return db.query(OrderRule).filter_by(is_active=True).all()


@router.put("/rules/{rule_id}")
def update_rule(rule_id: str, body: dict, db: Session = Depends(get_db)):
    from app.models import OrderRule
    rule = db.get(OrderRule, rule_id)
    if not rule:
        raise HTTPException(404)
    for k, v in body.items():
        if hasattr(rule, k):
            setattr(rule, k, v)
    db.commit()
    return rule
