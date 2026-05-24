"""Size/unit helpers for the order system."""
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

# ml → display label → multiplier relative to 750ml base price
STANDARD_SIZES = [
    (50,   "50ml",   Decimal("0.10")),
    (100,  "100ml",  Decimal("0.18")),
    (200,  "200ml",  Decimal("0.30")),
    (375,  "375ml",  Decimal("0.52")),
    (500,  "500ml",  Decimal("0.70")),
    (750,  "750ml",  Decimal("1.00")),
    (1000, "1L",     Decimal("1.28")),
    (1750, "1.75L",  Decimal("1.95")),
]

_SIZE_BY_LABEL = {label: (ml, mult) for ml, label, mult in STANDARD_SIZES}
_SIZE_BY_ML    = {ml: (label, mult) for ml, label, mult in STANDARD_SIZES}

WINE_KEYWORDS = ("wine", "chardonnay", "cabernet", "merlot", "pinot", "sauvignon",
                 "riesling", "prosecco", "champagne", "brut", "rosé", "shiraz",
                 "malbec", "zinfandel", "moscato")


def _is_wine(product) -> bool:
    name = (product.name or "").lower()
    cat  = (product.category or "").lower()
    return "wine" in cat or any(k in name for k in WINE_KEYWORDS)


def _base_price(product) -> Optional[Decimal]:
    """Return the 750ml (base) bottle price for a product."""
    p = product.unit_price
    return Decimal(str(p)) if p else None


def get_size_options(product) -> list[dict]:
    """
    Returns list of {size_label, size_ml, unit_price, is_default}.
    Wine: only the catalog 750ml size (no multiplier expansion).
    Non-wine: all 8 standard sizes derived from 750ml price.
    """
    base = _base_price(product)
    if base is None or base == 0:
        return [{"size_label": "750ml", "size_ml": 750, "unit_price": None, "is_default": True}]

    if _is_wine(product):
        return [{"size_label": "750ml", "size_ml": 750, "unit_price": float(base), "is_default": True}]

    options = []
    for ml, label, mult in STANDARD_SIZES:
        price = (base * mult).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        options.append({
            "size_label": label,
            "size_ml": ml,
            "unit_price": float(price),
            "is_default": ml == 750,
        })
    return options


def get_unit_options(product, selected_size_ml: int = 750) -> list[dict]:
    """
    Returns list of {unit_label, bottles_per_unit, is_default}.
    Units: Bottle | Half Case | Case | Mixed Case
    case_pack comes from product.case_pack or defaults to 12.
    """
    try:
        pack_str = str(product.pack or "").strip()
        # pack can be "12" or "12/750ml" or "6/1.75L" — take first number
        case_pack = int(pack_str.split("/")[0]) if pack_str else 12
    except (ValueError, AttributeError):
        case_pack = 12

    half = max(1, case_pack // 2)

    return [
        {"unit_label": "Bottle",     "bottles_per_unit": 1,         "is_default": False},
        {"unit_label": "Half Case",  "bottles_per_unit": half,       "is_default": False},
        {"unit_label": "Case",       "bottles_per_unit": case_pack,  "is_default": True},
        {"unit_label": "Mixed Case", "bottles_per_unit": case_pack,  "is_default": False},
    ]


def calculate_effective_price(
    base_unit_price: Optional[float],
    size_label: str,
    unit_label: str,
    quantity: int,
    case_pack: int = 12,
) -> dict:
    """
    Returns {unit_price, bottles_per_unit, total_bottles, line_total}.
    unit_price = price for the selected size × bottles_per_unit.
    """
    # Even when no price, still compute bottle counts correctly
    half = max(1, case_pack // 2)
    unit_map_early = {
        "Bottle": 1, "Half Case": half, "Case": case_pack, "Mixed Case": case_pack,
    }
    bpu_early = unit_map_early.get(unit_label, 1)
    if base_unit_price is None:
        return {"unit_price": None, "bottles_per_unit": bpu_early, "total_bottles": quantity * bpu_early, "line_total": None}

    base = Decimal(str(base_unit_price))

    # size multiplier
    _, mult = _SIZE_BY_LABEL.get(size_label, (750, Decimal("1.00")))
    size_price = (base * mult).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # bottles per unit
    half = max(1, case_pack // 2)
    unit_map = {
        "Bottle": 1,
        "Half Case": half,
        "Case": case_pack,
        "Mixed Case": case_pack,
    }
    bottles_per_unit = unit_map.get(unit_label, 1)

    unit_price   = size_price * bottles_per_unit
    total_bottles = bottles_per_unit * quantity
    line_total   = unit_price * quantity

    return {
        "unit_price":      float(unit_price.quantize(Decimal("0.01"))),
        "bottles_per_unit": bottles_per_unit,
        "total_bottles":   total_bottles,
        "line_total":      float(line_total.quantize(Decimal("0.01"))),
    }
