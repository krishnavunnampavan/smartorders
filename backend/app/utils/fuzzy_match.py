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


def match_multiple(db: Session, names: list[str], limit: int = 20) -> list[dict]:
    """Batch-match a list of names to products. Returns top matches for search."""
    if not names:
        return []
    query_str = names[0].lower() if names else ""
    products = db.query(Product).filter(Product.is_active == True).all()
    if not products:
        return []

    candidates: dict[str, Product] = {}
    for p in products:
        candidates[p.name.lower()] = p
        for alias in (p.aliases or []):
            candidates[alias.lower()] = p

    try:
        from rapidfuzz import process, fuzz as _fuzz
        results = process.extract(query_str, list(candidates.keys()), scorer=_fuzz.WRatio, limit=limit)
        seen = set()
        out = []
        for key, score, _ in results:
            p = candidates[key]
            if str(p.id) not in seen:
                seen.add(str(p.id))
                out.append({"product": p, "score": score, "confident": score >= 85})
        return out
    except ImportError:
        import difflib
        matches = difflib.get_close_matches(query_str, list(candidates.keys()), n=limit, cutoff=0.4)
        seen = set()
        out = []
        for key in matches:
            p = candidates[key]
            if str(p.id) not in seen:
                seen.add(str(p.id))
                out.append({"product": p, "score": 80, "confident": True})
        return out


def save_alias(db: Session, product_id: str, alias: str) -> None:
    product = db.get(Product, product_id)
    if not product:
        return
    aliases = list(product.aliases or [])
    if alias.lower() not in [a.lower() for a in aliases]:
        aliases.append(alias.lower())
        product.aliases = aliases
        db.commit()
