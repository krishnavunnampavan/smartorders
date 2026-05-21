from __future__ import annotations
from sqlalchemy.orm import Session
from app.models import Product

try:
    from rapidfuzz import process, fuzz as _fuzz

    def _best_match(query: str, candidates: list[str]) -> tuple[str, float] | None:
        result = process.extractOne(
            query, candidates, scorer=_fuzz.WRatio, score_cutoff=75
        )
        if result:
            return result[0], result[1]
        return None

except ImportError:
    # Pure-Python fallback using stdlib difflib (always available).
    # Slightly less accurate than rapidfuzz but requires no compilation.
    import difflib

    def _best_match(query: str, candidates: list[str]) -> tuple[str, float] | None:
        matches = difflib.get_close_matches(query, candidates, n=1, cutoff=0.6)
        if matches:
            return matches[0], 80.0
        return None


def match_product(db: Session, name: str, company_id: str | None = None) -> Product | None:
    if not name:
        return None

    query = db.query(Product).filter_by(is_active=True)
    if company_id:
        query = query.filter_by(company_id=company_id)
    products = query.all()
    if not products:
        return None

    candidates: dict[str, Product] = {}
    for p in products:
        candidates[p.name.lower()] = p
        for alias in (p.aliases or []):
            candidates[alias.lower()] = p

    result = _best_match(name.lower(), list(candidates.keys()))
    if result:
        matched_key, _ = result
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
