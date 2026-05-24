"""
Seed script: parses BB Buy Guide, Bottle Change Report, and Company Catalog PDFs
and inserts all distributor + product + price_history data into Neon PostgreSQL.

Usage:
    cd backend && .venv/bin/python seed_from_pdf.py
"""
import json
import re
import sys
import uuid
from decimal import Decimal
from pathlib import Path

import psycopg2
import fitz  # PyMuPDF

DB_URL = (
    "postgresql://neondb_owner:npg_iAdVsSmJ9pR4"
    "@ep-old-surf-apqa4eke-pooler.c-7.us-east-1.aws.neon.tech"
    "/neondb?sslmode=require"
)

BB_PDF   = Path.home() / "Downloads/BB Buy Guide May & June 2026.pdf"
BCR_PDF  = Path.home() / "Downloads/Bottle Change Report May-June 2026.pdf"
CAT_PDF  = Path.home() / "Downloads/company_catalog.pdf"


# ── PDF helpers ─────────────────────────────────────────────────────────────

def pdf_text(path: Path) -> str:
    doc = fitz.open(str(path))
    return "\n".join(page.get_text() for page in doc)


# ── Parse Bottle Change Report → {item_no: (may_btl, jun_btl, status)} ─────

def parse_bcr(text: str) -> dict:
    result = {}
    # Pattern: item_no  description  MAY_BTL  JUN_BTL  delta  INCREASE/DECREASE
    pat = re.compile(
        r"^(\d{4,6})\s+.+?\s+(\d+\.\d+)\s+(\d+\.\d+)\s+-?\d+\.\d+\s+(INCREASE|DECREASE)\s*$",
        re.MULTILINE,
    )
    for m in pat.finditer(text):
        item_no, may, jun, status = m.group(1), m.group(2), m.group(3), m.group(4)
        result[item_no] = (Decimal(may), Decimal(jun), status)
    return result


# ── Parse BB Buy Guide ───────────────────────────────────────────────────────
# Line example:
#   12980 JIM BEAM 80PF\n750ML\n60\n184.92\n17.99\n42.00\n226.92\n18.99\n...
# After PDF extraction it comes out as one stream of tokens on many lines.
# Strategy: find lines that start with a 4-6 digit item number.

CATEGORY_WORDS = {
    "THC", "RTD", "SCOTCH", "BOURBON", "IRISH", "GIN", "VODKA", "RUM",
    "TEQUILA", "COGNAC", "BRANDY", "CORDIALS", "WINE", "BEER", "SAKE",
    "CHAMPAGNE", "SPARKLING", "VERMOUTH", "LIQUEUR", "WHISKEY", "MEZCAL",
}

SKIP_LINES = {
    "BUY GUIDE", "MAY 2026", "AMENDED", "ITEM #", "DESCRIPTION",
    "SIZE", "BUY", "MAY", "CASE", "BTL", "SAVINGS", "JUN", "JUL", "NEXT",
    "A = AMENDED", "LR = LONG RANGE", "FUTURE PRICES SUBJECT TO CHANGE",
    "5/15/2026",
}


def parse_bb_guide(text: str) -> list[dict]:
    lines = [l.strip() for l in text.splitlines()]
    products = []
    current_category = "SPIRITS"

    i = 0
    while i < len(lines):
        line = lines[i]

        # Detect category headers
        if line in CATEGORY_WORDS:
            current_category = line
            i += 1
            continue

        # Skip header / footer noise
        if not line or line in SKIP_LINES or line.isdigit() or line.startswith("Page "):
            i += 1
            continue

        # Match item line: starts with 4-6 digit item number
        m = re.match(r"^(\d{4,6})\s+(.+)$", line)
        if not m:
            i += 1
            continue

        item_no = m.group(1)
        desc_rest = m.group(2).strip()

        # Collect continuation of description (may span next line if PDF wrapped it)
        # and accumulate subsequent numeric tokens
        nums = []
        size = ""
        extra_desc = ""

        j = i + 1
        while j < len(lines) and len(nums) < 12:
            nxt = lines[j].strip()
            if not nxt:
                j += 1
                continue
            # Stop if we hit another item or category
            if re.match(r"^\d{4,6}\s+", nxt) or nxt in CATEGORY_WORDS:
                break
            if nxt in SKIP_LINES or nxt.startswith("BUY GUIDE") or nxt.startswith("5/1"):
                j += 1
                continue
            # Size token: e.g. 750ML, 1.75L, 12OZ, 375ML, 50ML, 100ML, 1LTR, 200ML, 700ML
            if re.match(r"^\d+(\.\d+)?(ML|L|LTR|OZ)$", nxt, re.I):
                if not size:
                    size = nxt.upper()
                j += 1
                continue
            # Numeric token (price or case qty)
            if re.match(r"^\d+(\.\d+)?$", nxt):
                nums.append(Decimal(nxt))
                j += 1
                continue
            # Tokens like "30/S", "60", "LR", "A", "30" at start = buy qty, skip
            if re.match(r"^(LR|A|\d+/S?)$", nxt):
                j += 1
                continue
            # Looks like more description text (e.g. wrapped product name)
            if re.match(r"^[A-Z &\-\(\)\/\',\.0-9]+$", nxt) and len(nxt) > 2:
                extra_desc = nxt
                j += 1
                continue
            # "XXX - AUG" style = next-price note, stop
            if re.match(r"^\d+.*-\s*(AUG|SEP|OCT|NOV|DEC|JAN|FEB|MAR|APR|MAY|JUN|JUL)$", nxt, re.I):
                j += 1
                break
            j += 1

        i = j

        # We need at least 4 numbers: may_case, may_btl, jun_case, jun_btl
        if len(nums) < 4:
            continue

        # nums layout (savings may appear between may and jun blocks):
        # [may_case, may_btl, (savings?), jun_case, jun_btl, (jul_case, jul_btl, ...)]
        # Heuristic: first two are may_case, may_btl; look for 4 total prices
        # Filter out very large numbers that are obviously case prices (>100 usually for case)
        # Actually just take first 4 numbers where we have pairs:
        # May Case, May Btl, Jun Case, Jun Btl
        # Savings comes between them as a small positive number
        price_nums = [n for n in nums if n > 0]

        if len(price_nums) < 4:
            continue

        # Simple assignment: first 4 in order are may_case, may_btl, jun_case, jun_btl
        # BUT sometimes savings is in there. We can detect: btl price < 200 and case > btl
        # Build pairs: look for consecutive (large, small) pairs
        pairs = []
        k = 0
        while k < len(price_nums) - 1 and len(pairs) < 2:
            c, b = price_nums[k], price_nums[k + 1]
            # Valid pair: case > btl and case < 5000 and btl < 300
            if c > b and c < 5000 and b < 300:
                pairs.append((c, b))
                k += 2
            else:
                k += 1

        if len(pairs) < 1:
            continue

        may_case, may_btl = pairs[0]
        if len(pairs) >= 2:
            jun_case, jun_btl = pairs[1]
        else:
            jun_case, jun_btl = may_case, may_btl

        name = desc_rest
        if extra_desc:
            # Only prepend if it looks like a continuation of the name
            pass

        products.append({
            "item_no": item_no,
            "name": name,
            "size": size or "750ML",
            "category": current_category,
            "may_case": may_case,
            "may_btl": may_btl,
            "jun_case": jun_case,
            "jun_btl": jun_btl,
        })

    return products


# ── Parse company catalog (Martignetti, Eder-Goodman, CDI) ──────────────────

def parse_catalog(text: str) -> list[dict]:
    """Returns list of {company_name, address, phone, products: [{name, sizes}]}.
    PDF layout is 3 lines per product: just-a-number, product-name, sizes.
    """
    companies = []
    current = None

    lines = [l.strip() for l in text.splitlines()]
    comp_headers = [
        "MARTIGNETTI COMPANIES",
        "EDER-GOODMAN",
        "CONNECTICUT DISTRIBUTORS INC. (CDI)",
        "BRESCOME BARTON",
    ]
    SKIP = {"#", "Product", "Available Sizes", "products", ""}

    SIZE_RE = re.compile(
        r"^[\d.]+\s*(ml|mL|L|oz|OZ|cl|pk|pk$)", re.I
    )

    i = 0
    while i < len(lines):
        line = lines[i]

        # Company header
        for ch in comp_headers:
            if line == ch or ch in line:
                addr, phone = "", ""
                if i + 1 < len(lines):
                    m = re.match(r"(.+?)\|\s*([\(\d][\d\-\(\)\s]+)", lines[i + 1])
                    if m:
                        addr = m.group(1).strip()
                        phone = m.group(2).strip()
                current = {"name": ch, "address": addr, "phone": phone, "products": []}
                companies.append(current)
                i += 2
                break
        else:
            # Product row: the number is alone on a line
            if current and re.match(r"^\d+$", line) and line not in SKIP:
                # Next line = product name
                if i + 1 < len(lines):
                    pname = lines[i + 1].strip()
                    sizes_raw = ""
                    skip_extra = 1
                    # Line after that may be sizes or another number
                    if i + 2 < len(lines):
                        maybe_size = lines[i + 2].strip()
                        if SIZE_RE.match(maybe_size) or re.match(r"^\d+(\.\d+)?(L|ml|oz)", maybe_size, re.I):
                            sizes_raw = maybe_size
                            skip_extra = 2
                    if pname and pname not in SKIP and not re.match(r"^\d+$", pname):
                        sizes = [s.strip() for s in sizes_raw.split(",")] if sizes_raw else []
                        current["products"].append({"name": pname, "sizes": sizes})
                    i += skip_extra
            i += 1

    return companies


# ── Main seed logic ──────────────────────────────────────────────────────────

def main():
    print("Connecting to Neon…")
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    # ── Step 1: Clean up duplicates (re-seed unique products) ────────────────
    cur.execute("SELECT COUNT(*) FROM products")
    prod_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(DISTINCT name) FROM products")
    distinct_count = cur.fetchone()[0]

    if prod_count > distinct_count * 2:
        print(f"Detected {prod_count} products with only {distinct_count} distinct names — deduplicating…")
        # Keep one row per (name, sku) combination using ctid
        cur.execute("""
            DELETE FROM products
            WHERE ctid NOT IN (
                SELECT MIN(ctid)
                FROM products
                GROUP BY name, sku
            )
        """)
        deleted = cur.rowcount
        print(f"Deleted {deleted} duplicate product rows.")

    # ── Step 2: Delete the PARSE ERROR company (and its catalog_uploads) ────────
    cur.execute(
        "DELETE FROM catalog_uploads WHERE company_id IN "
        "(SELECT id FROM companies WHERE name LIKE 'PARSE ERROR%%')"
    )
    cur.execute("DELETE FROM companies WHERE name LIKE 'PARSE ERROR%%'")
    if cur.rowcount:
        print(f"Removed {cur.rowcount} error company row(s).")

    # ── Step 3: Insert / upsert 4 distributor companies ──────────────────────
    distributors = [
        {
            "name": "BRESCOME BARTON",
            "contact_name": "Sales Rep",
            "email": "orders@brescomebarton.com",
            "phone": "860-922-7713",
            "address": "69 Deiko Park Road, North Haven, CT",
            "delivery_days": "Mon, Wed, Fri",
        },
        {
            "name": "MARTIGNETTI COMPANIES",
            "contact_name": "Sales Rep",
            "email": "orders@martignetti.com",
            "phone": "203-375-5671",
            "address": "100 Browning St, Stratford, CT",
            "delivery_days": "Tue, Thu",
        },
        {
            "name": "EDER-GOODMAN",
            "contact_name": "Sales Rep",
            "email": "orders@edergoodman.com",
            "phone": "(203) 934-2032",
            "address": "11 Eder Road, West Haven, CT 06516",
            "delivery_days": "Mon, Wed",
        },
        {
            "name": "CONNECTICUT DISTRIBUTORS INC. (CDI)",
            "contact_name": "Sales Rep",
            "email": "orders@ctdistributors.com",
            "phone": "203-377-1440",
            "address": "333 Lordship Blvd, Stratford, CT",
            "delivery_days": "Tue, Fri",
        },
    ]

    company_ids = {}
    for d in distributors:
        cur.execute("SELECT id FROM companies WHERE name = %s", (d["name"],))
        row = cur.fetchone()
        if row:
            company_ids[d["name"]] = row[0]
            cur.execute(
                """UPDATE companies SET phone=%s, notes=%s WHERE id=%s""",
                (d["phone"], d["address"], row[0]),
            )
            print(f"Updated company: {d['name']}")
        else:
            cid = str(uuid.uuid4())
            cur.execute(
                """INSERT INTO companies (id, name, contact_name, email, phone, delivery_days, notes, is_active, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, true, NOW())""",
                (cid, d["name"], d["contact_name"], d["email"], d["phone"], d["delivery_days"], d["address"]),
            )
            company_ids[d["name"]] = cid
            print(f"Inserted company: {d['name']} ({cid})")

    conn.commit()

    bb_id = company_ids["BRESCOME BARTON"]
    mart_id = company_ids["MARTIGNETTI COMPANIES"]
    eder_id = company_ids["EDER-GOODMAN"]
    cdi_id = company_ids["CONNECTICUT DISTRIBUTORS INC. (CDI)"]

    # ── Step 4: Parse PDFs ────────────────────────────────────────────────────
    print("\nParsing PDFs…")
    bcr_text = pdf_text(BCR_PDF)
    bb_text  = pdf_text(BB_PDF)
    cat_text = pdf_text(CAT_PDF)

    bcr = parse_bcr(bcr_text)
    print(f"Bottle Change Report: {len(bcr)} price-change records")

    bb_products = parse_bb_guide(bb_text)
    print(f"BB Buy Guide: {len(bb_products)} product records parsed")

    catalog_companies = parse_catalog(cat_text)
    print(f"Company Catalog: {len(catalog_companies)} companies")

    # ── Step 5: Insert BB products + price_history ────────────────────────────
    print("\nInserting BB products…")
    bb_inserted = 0
    ph_inserted = 0

    # Build lookup: existing BB products by sku
    cur.execute("SELECT sku, id FROM products WHERE company_id = %s", (bb_id,))
    existing_bb = {row[0]: row[1] for row in cur.fetchall()}

    CATEGORY_MAP = {
        "SCOTCH": "Scotch Whisky",
        "BOURBON": "Bourbon",
        "IRISH": "Irish Whiskey",
        "GIN": "Gin",
        "VODKA": "Vodka",
        "RUM": "Rum",
        "TEQUILA": "Tequila",
        "COGNAC": "Cognac",
        "BRANDY": "Brandy",
        "CORDIALS": "Cordials & Liqueurs",
        "WINE": "Wine",
        "BEER": "Beer",
        "RTD": "RTD Cocktails",
        "THC": "THC Beverages",
        "WHISKEY": "Whiskey",
        "MEZCAL": "Mezcal",
        "CHAMPAGNE": "Champagne & Sparkling",
        "SPARKLING": "Champagne & Sparkling",
        "VERMOUTH": "Vermouth",
        "LIQUEUR": "Cordials & Liqueurs",
        "SAKE": "Sake",
    }

    product_ids = {}  # item_no → product_id (for price_history)

    for p in bb_products:
        sku = p["item_no"]
        name = p["name"]
        size = p["size"]
        category = CATEGORY_MAP.get(p["category"], p["category"].title())
        jun_btl = p["jun_btl"]

        if sku in existing_bb:
            pid = existing_bb[sku]
            cur.execute(
                """UPDATE products SET name=%s, unit_size=%s, category=%s, unit_price=%s,
                   case_price=%s, company_id=%s WHERE id=%s""",
                (name, size, category, float(jun_btl), float(p["jun_case"]), bb_id, pid),
            )
        else:
            pid = str(uuid.uuid4())
            cur.execute(
                """INSERT INTO products (id, name, sku, category, unit_size, case_pack,
                   unit_price, case_price, company_id, reorder_level, current_stock, is_active, aliases, created_at)
                   VALUES (%s, %s, %s, %s, %s, 12, %s, %s, %s, 2, 0, true, %s::json, NOW())""",
                (
                    pid, name, sku, category, size,
                    float(jun_btl), float(p["jun_case"]),
                    bb_id,
                    json.dumps([name.lower()]),
                ),
            )
            bb_inserted += 1

        product_ids[sku] = pid

    conn.commit()
    print(f"BB products: {bb_inserted} inserted, {len(bb_products)-bb_inserted} updated")

    # ── Step 6: Insert price_history for May & June 2026 ─────────────────────
    print("Inserting price_history…")
    # Delete existing BB price history for these months to re-seed cleanly
    cur.execute(
        """DELETE FROM price_history WHERE company_id = %s
           AND effective_month IN ('2026-05-01', '2026-06-01')""",
        (bb_id,),
    )

    for p in bb_products:
        sku = p["item_no"]
        if sku not in product_ids:
            continue
        pid = product_ids[sku]

        may_btl = p["may_btl"]
        may_case = p["may_case"]
        jun_btl = p["jun_btl"]
        jun_case = p["jun_case"]

        # Classify using price_engine thresholds (DEAL < -0.50, HOLD >= 0.25)
        price_change = jun_btl - may_btl
        if price_change <= Decimal("-0.50"):
            status = "DEAL"
        elif price_change >= Decimal("0.25"):
            status = "HOLD"
        else:
            status = "STABLE"

        price_change_pct = (price_change / may_btl * 100).quantize(Decimal("0.01")) if may_btl else Decimal("0")

        # May 2026
        cur.execute(
            """INSERT INTO price_history
               (id, product_id, company_id, effective_month, unit_price, case_price,
                prev_unit_price, price_change, price_change_pct, status)
               VALUES (%s,%s,%s,'2026-05-01',%s,%s,NULL,0,0,'STABLE')""",
            (str(uuid.uuid4()), pid, bb_id, float(may_btl), float(may_case)),
        )

        # June 2026
        cur.execute(
            """INSERT INTO price_history
               (id, product_id, company_id, effective_month, unit_price, case_price,
                prev_unit_price, price_change, price_change_pct, status)
               VALUES (%s,%s,%s,'2026-06-01',%s,%s,%s,%s,%s,%s)""",
            (
                str(uuid.uuid4()), pid, bb_id,
                float(jun_btl), float(jun_case),
                float(may_btl),
                float(price_change), float(price_change_pct),
                status,
            ),
        )
        ph_inserted += 2

    conn.commit()
    print(f"Price history: {ph_inserted} records inserted")

    # ── Step 7: Insert Martignetti / Eder-Goodman / CDI products ─────────────
    print("\nInserting catalog products (Martignetti, Eder-Goodman, CDI)…")

    COMPANY_NAME_MAP = {
        "MARTIGNETTI COMPANIES": mart_id,
        "EDER-GOODMAN": eder_id,
        "CONNECTICUT DISTRIBUTORS INC. (CDI)": cdi_id,
    }

    for comp in catalog_companies:
        cname = comp["name"]
        cid = COMPANY_NAME_MAP.get(cname)
        if not cid:
            continue

        # Get existing products for this company
        cur.execute("SELECT name FROM products WHERE company_id = %s", (cid,))
        existing_names = {row[0].lower() for row in cur.fetchall()}

        cat_inserted = 0
        for prod in comp["products"]:
            pname = prod["name"]
            if pname.lower() in existing_names:
                continue
            sizes = prod.get("sizes", [])
            size_str = ", ".join(sizes) if sizes else ""

            pid = str(uuid.uuid4())
            cur.execute(
                """INSERT INTO products (id, name, sku, category, unit_size, case_pack,
                   unit_price, company_id, reorder_level, current_stock, is_active, aliases, created_at)
                   VALUES (%s, %s, %s, 'Spirits & Other', %s, 12, 0, %s, 2, 0, true, %s::json, NOW())""",
                (pid, pname, "", size_str, cid, json.dumps([pname.lower()])),
            )
            cat_inserted += 1

        conn.commit()
        print(f"  {cname}: {cat_inserted} products inserted")

    # ── Step 8: Final counts ──────────────────────────────────────────────────
    cur.execute("SELECT COUNT(*) FROM companies")
    print(f"\nFinal counts:")
    print(f"  Companies:     {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM products")
    print(f"  Products:      {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM price_history")
    print(f"  Price history: {cur.fetchone()[0]}")

    cur.close()
    conn.close()
    print("\nDone!")


if __name__ == "__main__":
    main()
