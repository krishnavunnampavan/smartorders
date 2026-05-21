"""
Extract company information from uploaded catalog files using AI.
Auto-creates or matches an existing company record.
"""
from __future__ import annotations
import re
from sqlalchemy.orm import Session
from app.models import Company


async def extract_company_from_text(raw_text: str, ai_service=None) -> dict:
    """
    Extract company name, phone, email, address from catalog header text.
    Uses AI if available, regex fallback otherwise.
    """
    info = {"name": None, "phone": None, "email": None, "address": None, "contact_name": None}

    # Always try regex first (fast, no API cost)
    phone_m = re.search(r"\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}", raw_text)
    if phone_m:
        info["phone"] = phone_m.group()

    email_m = re.search(r"[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}", raw_text)
    if email_m:
        info["email"] = email_m.group()

    # Try AI for better extraction if available
    if ai_service:
        try:
            # Send only first 2000 chars (header area of catalog)
            snippet = raw_text[:2000]
            prompt = f"""
Extract company/distributor information from this catalog header.
Return ONLY JSON, no explanation:
{{
  "name": "company name",
  "phone": "phone number or null",
  "email": "email or null",
  "address": "full address or null",
  "contact_name": "sales rep name or null",
  "delivery_days": "delivery schedule e.g. Mon, Wed or null"
}}

Catalog text:
{snippet}
"""
            provider = ai_service.get_active_provider()
            if provider == "openai":
                result = await ai_service._openai_parse(prompt)
            else:
                result = await ai_service._claude_parse(prompt)

            if isinstance(result, dict):
                for k in info:
                    if result.get(k):
                        info[k] = result[k]
                if result.get("delivery_days"):
                    info["delivery_days"] = result["delivery_days"]
        except Exception:
            pass  # regex results are fine

    return info


def find_or_create_company(db: Session, info: dict) -> tuple[Company, bool]:
    """
    Find an existing company by name (fuzzy) or create a new one.
    Returns (company, was_created).
    """
    name = info.get("name")
    if not name:
        return None, False

    # Exact match first
    existing = db.query(Company).filter(
        Company.name.ilike(f"%{name}%"),
        Company.is_active == True,
    ).first()

    if existing:
        # Update contact info if we have better data
        changed = False
        for field in ("phone", "email", "contact_name", "delivery_days"):
            val = info.get(field)
            if val and not getattr(existing, field, None):
                setattr(existing, field, val)
                changed = True
        if changed:
            db.commit()
        return existing, False

    # Fuzzy match on name
    all_companies = db.query(Company).filter_by(is_active=True).all()
    if all_companies:
        name_lower = name.lower()
        for co in all_companies:
            co_lower = co.name.lower()
            # Check if significant words overlap
            name_words = set(name_lower.split())
            co_words = set(co_lower.split())
            common = name_words & co_words - {"and", "the", "of", "inc", "llc", "co", "company", "wine", "liquor", "spirits", "distributors", "distribution", "wholesale"}
            if len(common) >= 2 or (len(common) >= 1 and len(name_words) <= 2):
                # Update and return
                for field in ("phone", "email", "contact_name"):
                    val = info.get(field)
                    if val and not getattr(co, field, None):
                        setattr(co, field, val)
                db.commit()
                return co, False

    # Create new company
    company = Company(
        name=name,
        phone=info.get("phone"),
        email=info.get("email"),
        contact_name=info.get("contact_name"),
        delivery_days=info.get("delivery_days"),
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company, True
