"""
Product catalog enrichment service.

Normalizes existing product names against a canonical reference,
populates the brand field, deduplicates size variants, and inserts
missing canonical products.
"""
from __future__ import annotations
import re
import json
import uuid
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from typing import Optional
from sqlalchemy.orm import Session
from app.models.product import Product

CANONICAL_FILE = Path(__file__).parent.parent.parent / "seed" / "canonical_products.json"

_SIZE_RE = re.compile(r'\b\d+\.?\d*\s*(?:ml|l|oz|litre|liter)s?\b', re.IGNORECASE)
_PUNCT_RE = re.compile(r"['\"\-&./,!]")


def _clean(text: str) -> str:
    """Strip sizes and punctuation, lowercase and normalise whitespace."""
    text = _SIZE_RE.sub(' ', text or '')
    text = _PUNCT_RE.sub(' ', text)
    return ' '.join(text.lower().split())


def _tokenize(text: str) -> list[str]:
    return [w for w in re.sub(r'[^a-z0-9 ]', ' ', _clean(text)).split() if len(w) >= 3]


def _word_sim(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def _token_score(name_tokens: list[str], canon_tokens: list[str]) -> float:
    """
    Bidirectional fuzzy token match score in [0, 1].
    Weights name coverage (every name token matches something) higher than
    canonical coverage (canonical may have more descriptive tokens).
    """
    if not name_tokens or not canon_tokens:
        return 0.0

    name_matched = sum(
        1 for nt in name_tokens
        if max((_word_sim(nt, ct) for ct in canon_tokens), default=0) >= 0.75
    )
    canon_matched = sum(
        1 for ct in canon_tokens
        if max((_word_sim(ct, nt) for nt in name_tokens), default=0) >= 0.75
    )
    return 0.6 * (name_matched / len(name_tokens)) + 0.4 * (canon_matched / len(canon_tokens))


def _best_match(
    name: str,
    canonical: list[dict],
    threshold: float = 0.72,
) -> Optional[dict]:
    name_tokens = _tokenize(name)
    if not name_tokens:
        return None

    best_score = 0.0
    best_item: Optional[dict] = None

    for item in canonical:
        # Try aliases first (they often exactly capture known typos)
        for alias in item.get('aliases', []):
            alias_tokens = _tokenize(alias)
            s = _token_score(name_tokens, alias_tokens)
            if s > best_score:
                best_score = s
                best_item = item

        # Try canonical name
        canon_tokens = _tokenize(item['name'])
        s = _token_score(name_tokens, canon_tokens)
        if s > best_score:
            best_score = s
            best_item = item

    return best_item if best_score >= threshold else None


def enrich_products(db: Session) -> dict:
    """
    Run the full enrichment pass and return stats.

    Phases:
    1. Match every active product to a canonical entry.
    2. Update name, brand, category where the canonical version differs.
    3. Within each canonical group, soft-delete size-variant duplicates
       that have no order history (transfer company_id to the keeper first).
    4. Insert canonical entries that have no match in the DB at all.
    """
    with open(CANONICAL_FILE) as f:
        canonical: list[dict] = json.load(f)

    products = db.query(Product).filter(Product.is_active == True).all()

    stats = {"renamed": 0, "brand_set": 0, "deduped": 0, "inserted": 0, "skipped": 0}

    # Phase 1 — match each product to a canonical entry
    matched_canonical: set[str] = set()
    groups: dict[str, list[Product]] = defaultdict(list)
    product_matches: list[tuple[Product, Optional[dict]]] = []

    for p in products:
        item = _best_match(p.name, canonical)
        product_matches.append((p, item))
        if item:
            matched_canonical.add(item['name'])
            groups[item['name']].append(p)

    # Phase 2 — update name, brand, category
    for p, item in product_matches:
        if not item:
            stats['skipped'] += 1
            continue

        if p.name != item['name']:
            p.name = item['name']
            stats['renamed'] += 1

        if not p.brand or p.brand != item['brand']:
            p.brand = item['brand']
            stats['brand_set'] += 1

        if not p.category and item.get('category'):
            p.category = item['category']

    db.flush()

    # Phase 3 — deduplicate size variants within each canonical group
    for canon_name, group in groups.items():
        if len(group) <= 1:
            continue

        # Sort: keep products with order history first, then price > 0, then 750ml size
        def _sort_key(p: Product):
            has_orders = bool(p.order_items)
            has_price = bool(p.unit_price and float(p.unit_price) > 0)
            is_750 = (p.unit_size or '').lower() in ('750ml', '750 ml', '750')
            return (not has_orders, not has_price, not is_750)

        group.sort(key=_sort_key)
        keeper = group[0]

        for dupe in group[1:]:
            if dupe.order_items:
                continue  # never touch products with order history
            # Transfer company_id to keeper if keeper is unassigned
            if not keeper.company_id and dupe.company_id:
                keeper.company_id = dupe.company_id
            dupe.is_active = False
            stats['deduped'] += 1

    db.flush()

    # Phase 4 — insert canonical products missing from the DB entirely
    existing_clean_names = {_clean(p.name) for p in products}

    for item in canonical:
        if item['name'] in matched_canonical:
            continue
        if _clean(item['name']) in existing_clean_names:
            continue

        new_p = Product(
            id=uuid.uuid4(),
            name=item['name'],
            brand=item.get('brand'),
            category=item.get('category', 'Spirits & Other'),
            unit_size=item.get('size', '750ml'),
            pack=item.get('pack', '12'),
            unit_price=float(item.get('price', 0)),
            aliases=[item['name'].lower()] + item.get('aliases', [])[:5],
            reorder_level=2,
            current_stock=0,
            is_active=True,
        )
        db.add(new_p)
        stats['inserted'] += 1

    db.commit()
    return stats


def assign_brand_company(db: Session, brand: str, company_id: str) -> int:
    """Set company_id on every active product whose brand matches (case-insensitive)."""
    products = (
        db.query(Product)
        .filter(Product.is_active == True, Product.brand.ilike(f'%{brand}%'))
        .all()
    )
    for p in products:
        p.company_id = company_id
    db.commit()
    return len(products)
