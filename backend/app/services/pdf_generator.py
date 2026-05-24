"""Generate purchase order PDFs. Falls back to HTML if weasyprint unavailable."""
from datetime import datetime

_CSS = """
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1a1a2e; background: #fff; }
.page { max-width: 960px; margin: 0 auto; padding: 36px 40px 48px; }
/* Header */
.header { display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 3px solid #1a1a2e; padding-bottom: 16px; margin-bottom: 24px; }
.brand { font-size: 22px; font-weight: 800; color: #1a1a2e; letter-spacing: -0.5px; }
.brand span { color: #2563eb; }
.meta-block { text-align: right; font-size: 11px; color: #555; line-height: 1.7; }
.meta-block strong { color: #1a1a2e; }
/* Summary strip */
.summary { display: flex; gap: 0; margin-bottom: 28px; border: 1px solid #e2e8f0;
           border-radius: 8px; overflow: hidden; }
.summary-cell { flex: 1; padding: 10px 14px; border-right: 1px solid #e2e8f0; }
.summary-cell:last-child { border-right: none; }
.summary-cell .label { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
.summary-cell .val { font-size: 18px; font-weight: 700; color: #1a1a2e; margin-top: 2px; }
.summary-cell.accent .val { color: #2563eb; }
.summary-cell.green .val { color: #16a34a; }
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
th { padding: 7px 8px; text-align: left; font-size: 10px; text-transform: uppercase;
     letter-spacing: .05em; color: #475569; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
th.num { text-align: right; }
td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 11px;
     color: #1e293b; vertical-align: middle; }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
tr:last-child td { border-bottom: none; }
tr:nth-child(even) td { background: #fafafa; }
.badge { display: inline-block; font-size: 9px; font-weight: 700; padding: 1px 5px;
         border-radius: 4px; letter-spacing: .04em; vertical-align: middle; margin-left: 4px; }
.badge-deal { background: #d1fae5; color: #065f46; }
.badge-hold { background: #fef3c7; color: #92400e; }
.badge-rdeal { background: #a7f3d0; color: #064e3b; }
.size-pill { display: inline-block; background: #eff6ff; color: #1d4ed8; font-size: 9px;
             font-weight: 600; padding: 1px 5px; border-radius: 3px; margin-right: 3px; }
.unit-dim { color: #94a3b8; font-size: 10px; }
/* Subtotal row */
.subtotal-row td { background: #f8fafc; font-weight: 600; font-size: 12px;
                   border-top: 1.5px solid #cbd5e1; }
/* Grand total */
.grand-total { text-align: right; margin-top: 28px; padding: 14px 18px;
               background: #1a1a2e; color: #fff; border-radius: 8px;
               font-size: 16px; font-weight: 700; }
.grand-total span { color: #60a5fa; margin-left: 12px; font-size: 20px; }
/* Footer */
.footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0;
          font-size: 10px; color: #94a3b8; text-align: center; }
/* Company PDF only header */
.company-strip { background: #eff6ff; border: 1px solid #bfdbfe;
                 border-radius: 8px; padding: 10px 16px; margin-bottom: 20px; }
.company-strip .cname { font-size: 16px; font-weight: 800; color: #1e3a8a; }
.company-strip .cmeta { font-size: 11px; color: #3b82f6; margin-top: 2px; }
@media print {
  .page { padding: 20px; }
  .dist-section { break-inside: avoid; }
}
"""


def _to_bytes(html: str) -> bytes:
    try:
        from weasyprint import HTML
        return HTML(string=html).write_pdf()
    except (ImportError, OSError):
        return html.encode("utf-8")


# ── Single-distributor PDF ──────────────────────────────────────────────────
def generate_order_pdf(order_data: dict) -> bytes:
    return _to_bytes(_build_single_html(order_data))


def _build_single_html(data: dict) -> str:
    items = data.get("items", [])
    subtotal = float(data.get("subtotal", 0))
    total_bottles = sum(i.get("total_bottles") or i.get("quantity", 0) for i in items)
    deals = sum(1 for i in items if i.get("price_status") == "DEAL")
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Purchase Order — {_esc(data.get('company_name', ''))}</title>
<style>{_CSS}</style></head>
<body><div class="page">
  {_header(data.get('order_month', ''), 1, len(items), subtotal, total_bottles, deals)}
  <div class="company-strip">
    <div class="cname">{_esc(data.get('company_name', ''))}</div>
    <div class="cmeta">{len(items)} line items &nbsp;·&nbsp; {total_bottles:,} total bottles &nbsp;·&nbsp; ${subtotal:,.2f}</div>
  </div>
  <div class="dist-section">
    {_items_table(items, subtotal)}
  </div>
  <div class="grand-total">Order Total<span>${subtotal:,.2f}</span></div>
  {_footer()}
</div></body></html>"""


# ── Combined master PDF (all distributors) ─────────────────────────────────
def generate_combined_pdf(order_month: str, groups: list[dict]) -> bytes:
    return _to_bytes(_build_combined_html(order_month, groups))


def _build_combined_html(order_month: str, groups: list[dict]) -> str:
    total_items = sum(len(g["items"]) for g in groups)
    grand_total = sum(g["subtotal"] for g in groups)
    total_bottles = sum(
        sum(i.get("total_bottles") or i.get("quantity", 0) for i in g["items"])
        for g in groups
    )
    deals = sum(
        sum(1 for i in g["items"] if i.get("price_status") == "DEAL")
        for g in groups
    )
    dist_count = sum(1 for g in groups if not g.get("is_misc"))

    sections_html = ""
    for g in groups:
        is_misc = g.get("is_misc", False)
        hdr_class = "dist-header misc" if is_misc else "dist-header"
        name = g["company_name"]
        items = g["items"]
        sub = g["subtotal"]
        dist_bottles = sum(i.get("total_bottles") or i.get("quantity", 0) for i in items)
        sections_html += f"""
  <div class="dist-section">
    <div class="{hdr_class}">
      <span class="dist-name">{_esc(name)}</span>
      <span class="dist-meta">{len(items)} item{'s' if len(items)!=1 else ''}
        &nbsp;·&nbsp; {dist_bottles:,} btl &nbsp;·&nbsp; ${sub:,.2f}</span>
    </div>
    {_items_table(items, sub)}
  </div>"""

    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Master Purchase Order — {_esc(order_month)}</title>
<style>{_CSS}</style></head>
<body><div class="page">
  {_header(order_month, dist_count, total_items, grand_total, total_bottles, deals)}
  {sections_html}
  <div class="grand-total">Grand Total<span>${grand_total:,.2f}</span></div>
  {_footer()}
</div></body></html>"""


# ── Helpers ─────────────────────────────────────────────────────────────────
def _header(order_month, dist_count, item_count, total, total_bottles=0, deals=0) -> str:
    savings_html = ""
    if deals > 0:
        savings_html = f'<div class="summary-cell green"><div class="label">DEAL Items</div><div class="val">{deals}</div></div>'
    return f"""
<div class="header">
  <div>
    <div class="brand">&#127870; <span>LiquorStore</span> Pro</div>
    <div style="font-size:13px;color:#475569;margin-top:6px;">Purchase Order</div>
  </div>
  <div class="meta-block">
    <strong>Order Month:</strong> {_esc(order_month)}<br>
    <strong>Generated:</strong> {datetime.utcnow().strftime('%b %d, %Y %H:%M')} UTC
  </div>
</div>
<div class="summary">
  <div class="summary-cell accent"><div class="label">Distributors</div><div class="val">{dist_count}</div></div>
  <div class="summary-cell"><div class="label">Line Items</div><div class="val">{item_count}</div></div>
  <div class="summary-cell"><div class="label">Total Bottles</div><div class="val">{total_bottles:,}</div></div>
  <div class="summary-cell"><div class="label">Order Value</div><div class="val">${total:,.2f}</div></div>
  {savings_html}
</div>"""


def _items_table(items: list, subtotal: float) -> str:
    rows = "".join(_item_row(i) for i in items)
    return f"""<table>
  <thead><tr>
    <th style="width:32%">Product</th>
    <th>Size</th>
    <th>Unit</th>
    <th class="num">Qty</th>
    <th class="num">Btl/Unit</th>
    <th class="num">Total Btl</th>
    <th class="num">Unit Price</th>
    <th class="num">Line Total</th>
  </tr></thead>
  <tbody>
    {rows}
    <tr class="subtotal-row">
      <td colspan="7" style="text-align:right;color:#475569;font-size:11px;">Subtotal</td>
      <td class="num">${subtotal:,.2f}</td>
    </tr>
  </tbody>
</table>"""


def _item_row(item: dict) -> str:
    status = item.get("price_status", "")
    badge = ""
    if status == "DEAL":
        badge = '<span class="badge badge-deal">DEAL</span>'
    elif status == "HOLD":
        badge = '<span class="badge badge-hold">HOLD</span>'
    elif status == "RECOVERY_DEAL":
        badge = '<span class="badge badge-rdeal">BEST DEAL</span>'

    name = _esc(item.get("product_name", ""))
    sel_size = _esc(item.get("unit_size") or item.get("selected_size") or "750ml")
    sel_unit = _esc(item.get("selected_unit") or "Case")
    qty = item.get("quantity", 0)
    bpu = item.get("bottles_per_unit") or 1
    total_btl = item.get("total_bottles") or (qty * bpu)
    unit_p = float(item.get("unit_price", 0) or 0)
    line = float(item.get("line_total", 0) or unit_p * qty)

    # price change indicator
    change = item.get("price_change", 0) or 0
    change_html = ""
    if change and change != 0:
        arrow = "&#9660;" if change > 0 else "&#9650;"
        color = "#16a34a" if change < 0 else "#dc2626"
        change_html = f'<span style="color:{color};font-size:9px;margin-left:3px">{arrow}${abs(float(change)):.2f}</span>'

    return f"""<tr>
      <td>{name}{badge}</td>
      <td><span class="size-pill">{sel_size}</span></td>
      <td class="unit-dim">{sel_unit}</td>
      <td class="num"><strong>{qty}</strong></td>
      <td class="num unit-dim">{bpu}</td>
      <td class="num">{total_btl:,}</td>
      <td class="num">${unit_p:,.2f}{change_html}</td>
      <td class="num">${line:,.2f}</td>
    </tr>"""


def _footer() -> str:
    return f'<div class="footer">Generated by LiquorStore Pro &nbsp;·&nbsp; {datetime.utcnow().strftime("%Y-%m-%d")}</div>'


def _esc(s: str) -> str:
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
