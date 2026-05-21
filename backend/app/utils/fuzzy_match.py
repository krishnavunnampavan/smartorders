from __future__ import annotations
from rapidfuzz import process, fuzz
from sqlalchemy.orm import Session
from app.models import Product


def match_product(db: Session, name: str, company_id: str | None = None) -> Product | None:
    if not name:
        return None

    query = db.query(Product).filter_by(is_active=True)
    if company_id:
        query = query.filter_by(company_id=company_id)
    products = query.all()

    if not products:
        return None

    # Build candidate list: product name + all aliases
    candidates: dict[str, Product] = {}
    for p in products:
        candidates[p.name.lower()] = p
        for alias in (p.aliases or []):
            candidates[alias.lower()] = p

    result = process.extractOne(
        name.lower(),
        list(candidates.keys()),
        scorer=fuzz.WRatio,
        score_cutoff=75,
    )
    if result:
        matched_key, score, _ = result
        return candidates[matched_key]
    return None


def save_alias(db: Session, product_id: str, alias: str) -> None:
    product = db.get(Product, product_id)
    if not product:
        return
    aliases = list(product.aliases or [])
    if alias.lower() not in [a.lower() for a in aliases]:
        aliases.append(alias.lower())
        product.aliases = aliases
        db.commit()
