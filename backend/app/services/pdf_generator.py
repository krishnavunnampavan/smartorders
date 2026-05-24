"""Generate purchase order PDFs. Falls back to HTML if weasyprint unavailable."""
from datetime import datetime

# ── Shared CSS ──────────────────────────────────────────────────────────────
_CSS = """
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1a1a2e; background: #fff; }
.page { max-width: 900px; margin: 0 auto; padding: 36px 40px 48px; }
/* Header */
.header { display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 3px solid #1a1a2e; padding-bottom: 16px; margin-bottom: 24px; }
.brand { font-size: 22px; font-weight: 800; color: #1a1a2e; letter-spacing: -0.5px; }
.brand span { color: #2563eb; }
.meta-block { text-align: right; font-size: 11px; color: #555; line-height: 1.7; }
.meta-block strong { color: #1a1a2e; }
/* Summary strip */
.summary { display: flex; gap: 0; margin-bottom: 28px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
.summary-cell { flex: 1; padding: 10px 14px; border-right: 1px solid #e2e8f0; }
.summary-cell:last-child { border-right: none; }
.summary-cell .label { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
.summary-cell .val { font-size: 18px; font-weight: 700; color: #1a1a2e; margin-top: 2px; }
.summary-cell.accent .val { color: #2563eb; }
/* Distributor section */
.dist-section { margin-bottom: 28px; break-inside: avoid; }
.dist-header { display: flex; justify-content: space-between; align-items: center;
               background: #1a1a2e; color: #fff; padding: 9px 14px; border-radius: 6px 6px 0 0; }
.dist-header .dist-name { font-size: 13px; font-weight: 700; letter-spacing: .02em; }
.dist-header .dist-meta { font-size: 11px; color: #94a3b8; }
.dist-header.misc { background: #64748b; }
/* Item table */
table { width: 100%; border-collapse: collapse; }
thead tr { background: #f1f5f9; }
th { padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase;
     letter-spacing: .05em; color: #475569; border-bottom: 1px solid #e2e8f0; }
th.num { text-align: right; }
td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11.5px; color: #1e293b; vertical-align: middle; }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
tr:last-child td { border-bottom: none; }
tr:nth-child(even) td { background: #fafafa; }
.badge { display: inline-block; font-size: 9px; font-weight: 700; padding: 1px 5px;
         border-radius: 4px; letter-spacing: .04em; vertical-align: middle; margin-left: 4px; }
.badge-deal { background: #d1fae5; color: #065f46; }
.badge-rdeal { background: #a7f3d0; color: #064e3b; }
/* Subtotal row */
.subtotal-row td { background: #f8fafc; font-weight: 600; font-size: 12px;
                   border-top: 1.5px solid #cbd5e1; }
/* Grand total */
.grand-total { text-align: right; margin-top: 28px; padding: 14px 18px;
               background: #1a1a2e; color: #fff; border-radius: 8px; font-size: 16px; font-weight: 700; }
.grand-total span { color: #60a5fa; margin-left: 12px; font-size: 20px; }
/* Footer */
.footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0;
          font-size: 10px; color: #94a3b8; text-align: center; }
@media print {
  .page { padding: 20px; }
  .dist-section { break-inside: avoid; }
}
"""


def _to_bytes(html: str) -> bytes:
    try:
        from weasyprint import HTML
        return HTML(string=html).write_pdf()
    except ImportError:
        return html.encode("utf-8")


# ── Single-distributor PDF (used by share-link route) ───────────────────────
def generate_order_pdf(order_data: dict) -> bytes:
    return _to_bytes(_build_single_html(order_data))


def _build_single_html(data: dict) -> str:
    items_rows = "".join(_item_row(i) for i in data.get("items", []))
    subtotal = float(data.get("subtotal", 0))
    item_count = len(data.get("items", []))
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Purchase Order</title><style>{_CSS}</style></head>
<body><div class="page">
  {_header(data.get('order_month',''), 1, item_count, subtotal)}
  <div class="dist-section">
    <div class="dist-header">
      <span class="dist-name">{_esc(data.get('company_name',''))}</span>
      <span class="dist-meta">{item_count} items</span>
    </div>
    {_items_table(data.get('items', []), subtotal)}
  </div>
  <div class="grand-total">Grand Total<span>${subtotal:,.2f}</span></div>
  {_footer()}
</div></body></html>"""


# ── Combined PDF (all distributors + Misc) ──────────────────────────────────
def generate_combined_pdf(order_month: str, groups: list[dict]) -> bytes:
    return _to_bytes(_build_combined_html(order_month, groups))


def _build_combined_html(order_month: str, groups: list[dict]) -> str:
    total_items = sum(len(g["items"]) for g in groups)
    grand_total = sum(g["subtotal"] for g in groups)
    dist_count = sum(1 for g in groups if not g.get("is_misc"))

    sections_html = ""
    for g in groups:
        is_misc = g.get("is_misc", False)
        header_class = "dist-header misc" if is_misc else "dist-header"
        name = g["company_name"]
        items = g["items"]
        sub = g["subtotal"]
        sections_html += f"""
  <div class="dist-section">
    <div class="{header_class}">
      <span class="dist-name">{_esc(name)}</span>
      <span class="dist-meta">{len(items)} item{'s' if len(items)!=1 else ''} &nbsp;·&nbsp; ${sub:,.2f}</span>
    </div>
    {_items_table(items, sub)}
  </div>"""

    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Purchase Order — {_esc(order_month)}</title><style>{_CSS}</style></head>
<body><div class="page">
  {_header(order_month, dist_count, total_items, grand_total)}
  {sections_html}
  <div class="grand-total">Grand Total<span>${grand_total:,.2f}</span></div>
  {_footer()}
</div></body></html>"""


# ── Helpers ─────────────────────────────────────────────────────────────────
def _header(order_month: str, dist_count: int, item_count: int, total: float) -> str:
    return f"""
<div class="header">
  <div>
    <div class="brand">🍾 <span>LiquorStore</span> Pro</div>
    <div style="font-size:13px;color:#475569;margin-top:6px;">Purchase Order</div>
  </div>
  <div class="meta-block">
    <strong>Order Month:</strong> {_esc(order_month)}<br>
    <strong>Generated:</strong> {datetime.utcnow().strftime('%b %d, %Y %H:%M')} UTC
  </div>
</div>
<div class="summary">
  <div class="summary-cell accent"><div class="label">Distributors</div><div class="val">{dist_count}</div></div>
  <div class="summary-cell"><div class="label">Total Items</div><div class="val">{item_count}</div></div>
  <div class="summary-cell"><div class="label">Order Value</div><div class="val">${total:,.2f}</div></div>
</div>"""


def _items_table(items: list, subtotal: float) -> str:
    rows = "".join(_item_row(i) for i in items)
    return f"""<table>
  <thead><tr>
    <th>Product</th><th>SKU / Size</th>
    <th class="num">Pack</th><th class="num">Qty</th>
    <th class="num">Unit Price</th><th class="num">Line Total</th>
  </tr></thead>
  <tbody>
    {rows}
    <tr class="subtotal-row">
      <td colspan="5" style="text-align:right;color:#475569;font-size:11px;">Subtotal</td>
      <td class="num">${subtotal:,.2f}</td>
    </tr>
  </tbody>
</table>"""


def _item_row(item: dict) -> str:
    status = item.get("price_status", "")
    badge = ""
    if status == "DEAL":
        badge = '<span class="badge badge-deal">DEAL</span>'
    elif status == "RECOVERY_DEAL":
        badge = '<span class="badge badge-rdeal">BEST DEAL</span>'
    name = _esc(item.get("product_name", ""))
    sku = _esc(item.get("sku", "") or "")
    size = _esc(item.get("unit_size", "") or "")
    sku_size = f"{sku}" + (f" · {size}" if size else "")
    pack = _esc(str(item.get("pack", "") or ""))
    qty = item.get("quantity", 0)
    unit = float(item.get("unit_price", 0) or 0)
    total = float(item.get("line_total", 0) or unit * qty)
    return f"""<tr>
      <td>{name}{badge}</td>
      <td style="color:#64748b;font-size:11px;">{sku_size}</td>
      <td class="num" style="color:#64748b;">{pack}</td>
      <td class="num"><strong>{qty}</strong></td>
      <td class="num">${unit:,.2f}</td>
      <td class="num">${total:,.2f}</td>
    </tr>"""


def _footer() -> str:
    return f'<div class="footer">Generated by LiquorStore Pro &nbsp;·&nbsp; {datetime.utcnow().strftime("%Y-%m-%d")}</div>'


def _esc(s: str) -> str:
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
