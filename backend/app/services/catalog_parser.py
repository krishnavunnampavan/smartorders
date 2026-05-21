from __future__ import annotations
import base64
import io


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF. Requires pymupdf — not available on Vercel."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        return "\n".join(page.get_text() for page in doc)
    except ImportError:
        raise RuntimeError(
            "PDF text extraction is not available in this deployment. "
            "Please upload an Excel file or image instead."
        )


def extract_from_excel(file_bytes: bytes) -> list[dict]:
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []

    header = [str(c).lower().strip() if c else "" for c in rows[0]]
    name_col = _find_col(header, ["name", "product", "description", "item"])
    price_col = _find_col(header, ["unit price", "price", "unit", "each"])
    case_col = _find_col(header, ["case price", "case", "cs"])
    sku_col = _find_col(header, ["sku", "code", "item #", "item no"])
    size_col = _find_col(header, ["size", "unit size", "pack"])

    items = []
    for row in rows[1:]:
        name = row[name_col] if name_col is not None and name_col < len(row) else None
        if not name:
            continue
        items.append({
            "name": str(name).strip(),
            "sku": str(row[sku_col]).strip() if sku_col is not None and row[sku_col] else None,
            "unit_price": _to_float(row[price_col] if price_col is not None else None),
            "case_price": _to_float(row[case_col] if case_col is not None else None),
            "unit_size": str(row[size_col]).strip() if size_col is not None and row[size_col] else None,
        })
    return items


def image_to_base64(file_bytes: bytes, content_type: str) -> tuple[str, str]:
    return base64.b64encode(file_bytes).decode("utf-8"), content_type


def _find_col(headers: list[str], candidates: list[str]) -> int | None:
    for c in candidates:
        for i, h in enumerate(headers):
            if c in h:
                return i
    return None


def _to_float(val) -> float | None:
    if val is None:
        return None
    try:
        return float(str(val).replace("$", "").replace(",", "").strip())
    except ValueError:
        return None
