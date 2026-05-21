"""
Web scraper for monacoswineliquor.com and any liquor store website.

Strategy:
1. Fetch pages with realistic browser headers to avoid 403s
2. Parse HTML with BeautifulSoup — handles common e-commerce patterns
3. Try multiple URL patterns (category pages, all-products, sitemap)
4. Fall back to AI vision/text parsing if HTML structure is unrecognized
5. Return normalized product list: name, price, category, size, brand
"""
from __future__ import annotations

import re
import json
import asyncio
from typing import Optional
from urllib.parse import urljoin, urlparse

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Upgrade-Insecure-Requests": "1",
}

MONACO_BASE = "https://www.monacoswineliquor.com"

# Common category URL patterns to try
CATEGORY_PATHS = [
    "/spirits", "/liquor", "/wine", "/beer", "/wines", "/beers",
    "/whiskey", "/whisky", "/vodka", "/rum", "/gin", "/tequila", "/bourbon",
    "/red-wine", "/white-wine", "/champagne", "/beer-cider",
    "/collections/spirits", "/collections/wine", "/collections/beer",
    "/shop", "/products", "/catalog", "/store",
]


async def fetch_page(url: str, timeout: int = 15) -> tuple[int, str]:
    """Fetch a URL with browser headers. Returns (status_code, html)."""
    try:
        import httpx
        async with httpx.AsyncClient(
            headers=BROWSER_HEADERS,
            timeout=timeout,
            follow_redirects=True,
            verify=False,  # some liquor sites have cert issues
        ) as client:
            resp = await client.get(url)
            return resp.status_code, resp.text
    except Exception as e:
        return 0, str(e)


def extract_json_ld(html: str) -> list[dict]:
    """Pull structured product data from JSON-LD scripts (common in Shopify/WooCommerce)."""
    products = []
    pattern = re.compile(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', re.DOTALL)
    for match in pattern.finditer(html):
        try:
            data = json.loads(match.group(1))
            if isinstance(data, list):
                for item in data:
                    if item.get("@type") in ("Product", "ItemList"):
                        products.append(item)
            elif isinstance(data, dict):
                if data.get("@type") == "Product":
                    products.append(data)
                elif data.get("@type") == "ItemList":
                    for el in data.get("itemListElement", []):
                        if el.get("@type") == "Product":
                            products.append(el)
        except (json.JSONDecodeError, AttributeError):
            continue
    return products


def normalize_json_ld_product(item: dict) -> dict | None:
    name = item.get("name", "").strip()
    if not name:
        return None
    offers = item.get("offers", {})
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    price = None
    raw_price = offers.get("price") or offers.get("lowPrice")
    if raw_price:
        try:
            price = float(str(raw_price).replace("$", "").replace(",", ""))
        except ValueError:
            pass
    return {
        "name": name,
        "unit_price": price,
        "sku": item.get("sku") or item.get("mpn"),
        "brand": item.get("brand", {}).get("name") if isinstance(item.get("brand"), dict) else item.get("brand"),
        "description": item.get("description", "")[:200],
        "image_url": item.get("image") if isinstance(item.get("image"), str) else None,
        "category": _infer_category(name),
        "unit_size": _extract_size(name),
    }


def parse_html_products(html: str, base_url: str = "") -> list[dict]:
    """
    Parse product listings from raw HTML using BeautifulSoup.
    Handles Shopify, WooCommerce, and custom liquor store layouts.
    """
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return []

    soup = BeautifulSoup(html, "html.parser")
    products = []

    # 1. JSON-LD structured data (best quality)
    json_ld_items = extract_json_ld(html)
    for item in json_ld_items:
        p = normalize_json_ld_product(item)
        if p:
            products.append(p)

    if products:
        return products

    # 2. Common CSS selectors for product cards
    selectors = [
        # Shopify
        (".product-card", ".product-card__title", ".price"),
        (".product-item", ".product-item__title", ".price__regular"),
        # WooCommerce
        (".product", ".woocommerce-loop-product__title", ".woocommerce-Price-amount"),
        # Generic
        (".product", "h2,h3,.product-title,.product-name", ".price,.amount"),
        (".item", ".item-title,.title", ".price"),
        ("[class*='product']", "[class*='title'],[class*='name']", "[class*='price']"),
    ]

    for card_sel, name_sel, price_sel in selectors:
        cards = soup.select(card_sel)
        if len(cards) < 3:  # too few to be a real product list
            continue
        for card in cards[:200]:
            name_el = card.select_one(name_sel)
            price_el = card.select_one(price_sel)
            if not name_el:
                continue
            name = name_el.get_text(strip=True)
            if len(name) < 3:
                continue
            price = None
            if price_el:
                raw = price_el.get_text(strip=True)
                m = re.search(r"[\d,]+\.?\d*", raw.replace(",", ""))
                if m:
                    try:
                        price = float(m.group().replace(",", ""))
                    except ValueError:
                        pass
            products.append({
                "name": name,
                "unit_price": price,
                "sku": None,
                "brand": _extract_brand(name),
                "category": _infer_category(name),
                "unit_size": _extract_size(name),
                "description": "",
            })
        if products:
            break

    # 3. Last resort: find price+name pairs in any structure
    if not products:
        price_els = soup.find_all(string=re.compile(r"\$\d+"))
        for el in price_els[:100]:
            parent = el.parent
            for _ in range(4):
                if not parent:
                    break
                text = parent.get_text(separator=" ", strip=True)
                # Look for something that reads like a product name
                words = text.split()
                if 2 < len(words) < 15:
                    try:
                        price = float(re.search(r"\d+\.?\d*", el).group())
                    except (AttributeError, ValueError):
                        price = None
                    products.append({
                        "name": " ".join(w for w in words if "$" not in w)[:100],
                        "unit_price": price,
                        "sku": None,
                        "brand": None,
                        "category": "spirits",
                        "unit_size": _extract_size(text),
                    })
                    break
                parent = parent.parent

    return [p for p in products if len(p.get("name", "")) > 3]


async def scrape_monaco(max_products: int = 500) -> dict:
    """
    Main entry point: scrape Monaco's Wine & Liquor.
    Returns {products, company_info, pages_scraped, errors}.
    """
    company_info = {
        "name": "Monaco's Wine & Liquor",
        "website": MONACO_BASE,
        "email": None,
        "phone": None,
        "address": None,
    }

    all_products: list[dict] = []
    errors: list[str] = []
    pages_scraped = 0

    # First try the homepage for company info and nav links
    status, html = await fetch_page(MONACO_BASE)
    if status == 200:
        pages_scraped += 1
        _extract_company_info(html, company_info)

        # Find additional category links from nav
        extra_paths = _extract_nav_links(html, MONACO_BASE)
        paths_to_try = list(dict.fromkeys(CATEGORY_PATHS + extra_paths))
    else:
        errors.append(f"Homepage {status}: {html[:100]}")
        paths_to_try = CATEGORY_PATHS

    # Scrape category pages
    tasks = [fetch_page(urljoin(MONACO_BASE, p)) for p in paths_to_try[:12]]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for path, result in zip(paths_to_try, results):
        if isinstance(result, Exception):
            errors.append(f"{path}: {result}")
            continue
        status, html = result
        if status != 200:
            continue
        pages_scraped += 1
        products = parse_html_products(html, MONACO_BASE)
        for p in products:
            p["source_url"] = urljoin(MONACO_BASE, path)
        all_products.extend(products)
        if len(all_products) >= max_products:
            break

    # Deduplicate by name
    seen: set[str] = set()
    unique: list[dict] = []
    for p in all_products:
        key = p["name"].lower().strip()
        if key not in seen:
            seen.add(key)
            unique.append(p)

    return {
        "company_info": company_info,
        "products": unique[:max_products],
        "total_found": len(unique),
        "pages_scraped": pages_scraped,
        "errors": errors,
    }


async def scrape_any_store(url: str, max_products: int = 300) -> dict:
    """
    Generic scraper for any liquor store URL.
    Tries the URL directly plus common category sub-paths.
    """
    base = f"{urlparse(url).scheme}://{urlparse(url).netloc}"
    company_info = {"name": urlparse(url).netloc, "website": base}

    status, html = await fetch_page(url)
    products = []
    if status == 200:
        _extract_company_info(html, company_info)
        products = parse_html_products(html, base)

    if len(products) < 5:
        tasks = [fetch_page(urljoin(base, p)) for p in CATEGORY_PATHS[:8]]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, Exception):
                continue
            s, h = r
            if s == 200:
                products.extend(parse_html_products(h, base))

    seen: set[str] = set()
    unique = []
    for p in products:
        k = p["name"].lower().strip()
        if k not in seen:
            seen.add(k)
            unique.append(p)

    return {
        "company_info": company_info,
        "products": unique[:max_products],
        "total_found": len(unique),
    }


# ── helpers ──────────────────────────────────────────────────────────────────

def _extract_company_info(html: str, info: dict) -> None:
    """Pull phone, email, address from page HTML."""
    phone_m = re.search(r"\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}", html)
    if phone_m:
        info["phone"] = phone_m.group()
    email_m = re.search(r"[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}", html)
    if email_m and "example" not in email_m.group():
        info["email"] = email_m.group()
    addr_m = re.search(r"\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Ct)", html)
    if addr_m:
        info["address"] = addr_m.group()
    # Try JSON-LD for org info
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.string or "")
                if isinstance(data, dict) and data.get("@type") in ("LocalBusiness", "Store", "Organization", "LiquorStore"):
                    info["name"] = data.get("name", info["name"])
                    info["phone"] = data.get("telephone", info.get("phone"))
                    info["email"] = data.get("email", info.get("email"))
                    addr = data.get("address", {})
                    if isinstance(addr, dict):
                        info["address"] = f"{addr.get('streetAddress', '')} {addr.get('addressLocality', '')} {addr.get('addressRegion', '')}".strip()
            except Exception:
                pass
    except ImportError:
        pass


def _extract_nav_links(html: str, base: str) -> list[str]:
    """Pull category links from navigation."""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        links = []
        for a in soup.select("nav a, header a, .menu a, .navigation a"):
            href = a.get("href", "")
            if href and not href.startswith(("mailto:", "tel:", "#", "javascript:")):
                if not href.startswith("http"):
                    href = urljoin(base, href)
                if urlparse(href).netloc == urlparse(base).netloc:
                    path = urlparse(href).path
                    if path and path != "/" and len(path) > 1:
                        links.append(path)
        return list(dict.fromkeys(links))[:20]
    except ImportError:
        return []


_CATEGORIES = {
    "bourbon": "spirits", "whiskey": "spirits", "whisky": "spirits",
    "scotch": "spirits", "vodka": "spirits", "gin": "spirits",
    "rum": "spirits", "tequila": "spirits", "mezcal": "spirits",
    "cognac": "spirits", "brandy": "spirits", "liqueur": "spirits",
    "schnapps": "spirits", "triple sec": "spirits",
    "cabernet": "wine", "merlot": "wine", "chardonnay": "wine",
    "pinot": "wine", "sauvignon": "wine", "champagne": "wine",
    "prosecco": "wine", "riesling": "wine", "rosé": "wine",
    "ipa": "beer", "lager": "beer", "ale": "beer", "stout": "beer",
    "porter": "beer", "pilsner": "beer", "cider": "beer",
    "vermouth": "mixer", "bitters": "mixer", "tonic": "mixer",
}

def _infer_category(name: str) -> str:
    lower = name.lower()
    for keyword, cat in _CATEGORIES.items():
        if keyword in lower:
            return cat
    return "spirits"

def _extract_brand(name: str) -> str | None:
    # First 1-2 words are usually the brand
    parts = name.split()
    return " ".join(parts[:2]) if len(parts) >= 2 else parts[0] if parts else None

_SIZE_RE = re.compile(r"\b(\d+(?:\.\d+)?)\s*(ml|l|liter|litre|oz|cl|fl\s*oz|pk|pack|case)\b", re.IGNORECASE)
def _extract_size(text: str) -> str | None:
    m = _SIZE_RE.search(text)
    return m.group() if m else None
