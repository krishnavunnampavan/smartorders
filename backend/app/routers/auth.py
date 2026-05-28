from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.store import Store
from app.schemas.store import AuthVerifyRequest, AuthVerifyResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/verify", response_model=AuthVerifyResponse)
def verify_access_key(body: AuthVerifyRequest, db: Session = Depends(get_db)):
    key = body.access_key.strip()
    if len(key) != 4 or not key.isdigit():
        raise HTTPException(400, "Access key must be exactly 4 digits")

    store = db.query(Store).filter_by(access_key=key, is_active=True).first()
    if not store:
        raise HTTPException(401, "Invalid access key")

    return AuthVerifyResponse(
        store_id=str(store.id),
        store_name=store.name,
        access_key=store.access_key,
        is_owner=store.is_owner_platform,
    )


@router.get("/me")
def get_me(x_store_key: str = None, db: Session = Depends(get_db)):
    """Validate a stored key on page load."""
    from fastapi import Header
    raise HTTPException(400, "Use POST /verify")
