from __future__ import annotations
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models import Product

try:
    from rapidfuzz import process, fuzz as _fuzz

    def _best_match(query: str, candidates: list[str], cutoff: int = 75) -> tuple[str, float] | None:
        result = process.extractOne(query, candidates, scorer=_fuzz.WRatio, score_cutoff=cutoff)
        return (result[0], result[1]) if result else None

    def _multi_match(query: str, candidates: list[str], limit: int, cutoff: int = 40) -> list[tuple[str, float]]:
        results = process.extract(query, candidates, scorer=_fuzz.WRatio, limit=limit, score_cutoff=cutoff)
        return [(r[0], r[1]) for r in results]

except ImportError:
    import difflib

    def _best_match(query: str, candidates: list[str], cutoff: int = 75) -> tuple[str, float] | None:
        matches = difflib.get_close_matches(query, candidates, n=1, cutoff=cutoff / 100)
        return (matches[0], 80.0) if matches else None

    def _multi_match(query: str, candidates: list[str], limit: int, cutoff: int = 40) -> list[tuple[str, float]]:
        matches = difflib.get_close_matches(query, candidates, n=limit, cutoff=cutoff / 100)
        return [(m, 80.0) for m in matches]


def _build_candidate_map(products: list) -> dict[str, object]:
    candidates: dict[str, object] = {}
    for p in products:
        candidates[p.name.lower()] = p
        for alias in (p.aliases or []):
            candidates[alias.lower()] = p
    return candidates


def _keyword_prefilter(db: Session, name: str, company_id: str | None, limit: int = 300) -> list:
    """Return products whose name contains at least one meaningful keyword from the query."""
    words = [w for w in name.lower().split() if len(w) > 2]
    if not words:
        return []
    filters = [Product.name.ilike(f"%{w}%") for w in words[:4]]
    q = db.query(Product).filter(Product.is_active == True, or_(*filters))
    if company_id:
        q = q.filter_by(company_id=company_id)
    return q.limit(limit).all()


def match_product(db: Session, name: str, company_id: str | None = None) -> Product | None:
    if not name:
        return None

    name_lower = name.lower().strip()

    # 1. Exact name match (fastest path)
    exact = (
        db.query(Product)
        .filter(Product.is_active == True, Product.name.ilike(name_lower))
        .first()
    )
    if exact:
        return exact

    # 2. Keyword pre-filter then fuzzy on the small set (~10-300 products)
    filtered = _keyword_prefilter(db, name, company_id)
    if filtered:
        candidates = _build_candidate_map(filtered)
        result = _best_match(name_lower, list(candidates.keys()), cutoff=72)
        if result:
            return candidates[result[0]]

    # 3. Full fuzzy fallback (only if keyword pre-filter returned nothing)
    q = db.query(Product).filter(Product.is_active == True)
    if company_id:
        q = q.filter_by(company_id=company_id)
    all_products = q.all()
    if not all_products:
        return None
    candidates = _build_candidate_map(all_products)
    result = _best_match(name_lower, list(candidates.keys()), cutoff=75)
    return candidates[result[0]] if result else None


def match_multiple(db: Session, names: list[str], limit: int = 20) -> list[dict]:
    if not names:
        return []
    query_str = names[0].lower()
    filtered = _keyword_prefilter(db, query_str, None, limit=500)
    if not filtered:
        filtered = db.query(Product).filter(Product.is_active == True).all()

    candidates = _build_candidate_map(filtered)
    results = _multi_match(query_str, list(candidates.keys()), limit=limit)
    seen: set[str] = set()
    out = []
    for key, score in results:
        p = candidates[key]
        pid = str(p.id)
        if pid not in seen:
            seen.add(pid)
            out.append({"product": p, "score": score, "confident": score >= 85})
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
