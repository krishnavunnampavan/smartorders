"""Parse distributor catalogs from PDF, Excel, CSV, or image."""
from __future__ import annotations
import base64
import csv
import io
import re
from typing import Optional


# ── PDF ───────────────────────────────────────────────────────────────────
def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF using PyMuPDF. Returns empty string on failure."""
    try:
        import fitz
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        return "\n".join(page.get_text() for page in doc)
    except ImportError:
        return ""
    except Exception:
        return ""


def pdf_pages_to_images(file_bytes: bytes, max_pages: int = 10) -> list[tuple[str, str]]:
    """
    Render PDF pages as PNG images for AI vision fallback.
    Returns [(base64_png, 'image/png'), ...].
    """
    try:
        import fitz
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        result = []
        for i, page in enumerate(doc):
            if i >= max_pages:
                break
            mat = fitz.Matrix(2, 2)  # 2× zoom for legibility
            pix = page.get_pixmap(matrix=mat)
            png_bytes = pix.tobytes("png")
            b64 = base64.b64encode(png_bytes).decode("utf-8")
            result.append((b64, "image/png"))
        return result
    except Exception:
        return []


# ── Excel / CSV ───────────────────────────────────────────────────────────
def extract_from_excel(file_bytes: bytes, filename: str = "") -> list[dict]:
    """Parse Excel (.xlsx/.xls) or CSV files into product dicts."""
    ext = (filename.rsplit(".", 1)[-1].lower() if "." in filename else "")

    if ext == "csv" or (ext not in ("xlsx", "xls") and _looks_like_csv(file_bytes)):
        return _parse_csv(file_bytes)

    return _parse_xlsx(file_bytes)


def _looks_like_csv(data: bytes) -> bool:
    try:
        sample = data[:2000].decode("utf-8", errors="ignore")
        return "," in sample and "\n" in sample
    except Exception:
        return False


def _parse_csv(file_bytes: bytes) -> list[dict]:
    try:
        text = file_bytes.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            return []
        return _rows_to_items(list(reader))
    except Exception:
        return []


def _parse_xlsx(file_bytes: bytes) -> list[dict]:
    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []
        header = [str(c).lower().strip() if c else "" for c in rows[0]]
        dicts = [
            {header[i]: row[i] for i in range(min(len(header), len(row)))}
            for row in rows[1:]
        ]
        return _rows_to_items(dicts)
    except Exception:
        return []


def _rows_to_items(rows: list[dict]) -> list[dict]:
    """Map raw rows (dict per row) to canonical product dicts."""
    if not rows:
        return []
    # Normalise keys
    def norm(k): return str(k or "").lower().strip()

    sample_keys = [norm(k) for k in (rows[0] or {}).keys()]

    name_key   = _first_match(sample_keys, ["name", "product name", "description", "item name", "product", "item"])
    price_key  = _first_match(sample_keys, ["unit price", "btl price", "bottle price", "price each", "unit", "price", "each"])
    case_key   = _first_match(sample_keys, ["case price", "cs price", "case", "cs"])
    sku_key    = _first_match(sample_keys, ["sku", "item #", "item no", "upc", "code", "id"])
    size_key   = _first_match(sample_keys, ["size", "unit size", "pack size", "pack", "volume"])
    cat_key    = _first_match(sample_keys, ["category", "cat", "type", "section", "department"])

    items = []
    for row in rows:
        nrow = {norm(k): v for k, v in row.items()}
        name = nrow.get(name_key) if name_key else None
        if not name or str(name).strip() in ("", "None", "nan"):
            continue
        name = str(name).strip()
        items.append({
            "name":       name,
            "sku":        _str_or_none(nrow.get(sku_key)),
            "unit_price": _to_float(nrow.get(price_key)),
            "case_price": _to_float(nrow.get(case_key)),
            "unit_size":  _str_or_none(nrow.get(size_key)),
            "category":   _str_or_none(nrow.get(cat_key)),
        })
    return items


def _first_match(keys: list[str], candidates: list[str]) -> Optional[str]:
    for c in candidates:
        for k in keys:
            if c in k:
                return k
    return None


# ── Image ─────────────────────────────────────────────────────────────────
def image_to_base64(file_bytes: bytes, content_type: str) -> tuple[str, str]:
    return base64.b64encode(file_bytes).decode("utf-8"), content_type


# ── Regex-based product extraction from PDF text ──────────────────────────
def extract_products_from_text(raw_text: str) -> list[dict]:
    """
    Heuristic extraction: find lines with a price ($xx.xx) and a product name.
    Falls back / supplements AI parsing with rule-based extraction.
    Returns list of dicts.
    """
    items = []
    seen_names = set()

    # Pattern: optional SKU, product name, optional size, price
    price_re = re.compile(
        r'^(.{5,60?}?)\s+'             # product name (greedy but bounded)
        r'(?:(\d+[Xx/]\w+)\s+)?'       # optional pack "12/750ml"
        r'\$?(\d{1,3}(?:\.\d{2})?)$',  # price at end of line
        re.MULTILINE
    )
    for m in price_re.finditer(raw_text):
        name  = m.group(1).strip()
        price = _to_float(m.group(3))
        if price and 1.0 < price < 500 and name not in seen_names:
            seen_names.add(name)
            items.append({"name": name, "unit_price": price, "sku": None, "unit_size": None})

    return items


# ── Helpers ───────────────────────────────────────────────────────────────
def _to_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(str(val).replace("$", "").replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def _str_or_none(val) -> Optional[str]:
    s = str(val).strip() if val is not None else ""
    return s if s not in ("", "None", "nan") else None
