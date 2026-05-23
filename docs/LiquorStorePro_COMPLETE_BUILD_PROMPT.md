# 🏗️ COMPLETE BUILD PROMPT — LiquorStore Pro v2.0
## Full-Stack Smart Stock Ordering Platform
### Paste this into VS Code Claude Extension (Cline / Continue / Claude Code)

---

## 🎯 WHAT YOU ARE BUILDING

A full-stack web application called **LiquorStore Pro** for liquor store managers to:
- Build orders via **voice** (with live transcription + AI autocorrect), **photo of written list**, or **manual product search with +/- buttons**
- Track **monthly distributor catalog price changes** (DEAL / HOLD / STABLE / RECOVERY_DEAL logic)
- Auto-**split orders by distributor company**
- Generate **shareable order links** per company (no login required for the company)
- Manage a **4,930-item product catalog** seeded from a real store's inventory
- Manage **distributors** with full CRUD (add / edit / delete / assign products)
- See a **live running order list** that updates at every step in real time

**Stack:** React 18 + Vite (frontend) | FastAPI + Python 3.11 (backend) | PostgreSQL 15 | Redis | Docker Compose

---

## 📁 COMPLETE PROJECT STRUCTURE

Create exactly this folder and file structure. Do not skip any file.

```
liquorstore-pro/
├── frontend/
│   ├── public/
│   │   └── favicon.ico
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Layout.jsx              # Root layout wrapper
│   │   │   │   ├── Sidebar.jsx             # Left nav with all sections
│   │   │   │   └── TopBar.jsx              # Top bar with store name + alerts
│   │   │   ├── shared/
│   │   │   │   ├── PriceBadge.jsx          # DEAL/HOLD/STABLE/RECOVERY badge
│   │   │   │   ├── ConfirmModal.jsx        # Reusable confirm dialog
│   │   │   │   ├── SearchInput.jsx         # Reusable search bar
│   │   │   │   ├── LoadingSpinner.jsx
│   │   │   │   ├── EmptyState.jsx
│   │   │   │   └── Toast.jsx               # Notification toasts
│   │   │   ├── order/
│   │   │   │   ├── LiveOrderSidebar.jsx    # ALWAYS VISIBLE running order list
│   │   │   │   ├── VoiceInput.jsx          # Voice recording + live transcript
│   │   │   │   ├── PhotoInput.jsx          # Photo upload + AI extraction
│   │   │   │   ├── ManualEntry.jsx         # Product grid with +/- buttons
│   │   │   │   ├── OrderReview.jsx         # Review before split
│   │   │   │   └── OrderSplitView.jsx      # Split by company + share links
│   │   │   ├── catalog/
│   │   │   │   ├── CatalogUpload.jsx       # Upload distributor catalogs
│   │   │   │   └── PriceCompareTable.jsx   # Month-over-month price table
│   │   │   ├── products/
│   │   │   │   ├── ProductList.jsx         # Full product list with filters
│   │   │   │   ├── ProductRow.jsx          # Single product row with actions
│   │   │   │   ├── ProductForm.jsx         # Add/edit product modal
│   │   │   │   └── ProductFilters.jsx      # Filter by category/company/size
│   │   │   ├── distributors/
│   │   │   │   ├── DistributorList.jsx     # All distributors with CRUD
│   │   │   │   ├── DistributorCard.jsx     # Single distributor card
│   │   │   │   ├── DistributorForm.jsx     # Add/edit distributor modal
│   │   │   │   └── DistributorProducts.jsx # Products assigned to a distributor
│   │   │   ├── dashboard/
│   │   │   │   ├── Dashboard.jsx
│   │   │   │   ├── SummaryCards.jsx        # Deal count, savings, low stock, orders
│   │   │   │   ├── PriceAlertFeed.jsx      # Live feed of DEAL/HOLD items
│   │   │   │   ├── SavingsChart.jsx        # Monthly savings bar chart
│   │   │   │   └── LowStockAlerts.jsx      # Products below reorder level
│   │   │   └── settings/
│   │   │       ├── Settings.jsx
│   │   │       ├── APIKeySettings.jsx      # OpenAI + Claude dual key UI
│   │   │       ├── StoreSettings.jsx
│   │   │       └── OrderRules.jsx          # Thresholds for DEAL/HOLD logic
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── NewOrderPage.jsx            # Order entry (Voice/Photo/Manual)
│   │   │   ├── OrderHistoryPage.jsx
│   │   │   ├── OrderDetailPage.jsx
│   │   │   ├── ProductsPage.jsx            # Full item list management
│   │   │   ├── DistributorsPage.jsx
│   │   │   ├── CatalogPage.jsx
│   │   │   ├── SettingsPage.jsx
│   │   │   └── PublicOrderPage.jsx         # /order/:token — no auth needed
│   │   ├── hooks/
│   │   │   ├── useVoiceRecorder.js         # MediaRecorder + real-time transcript
│   │   │   ├── useOrderBuilder.js          # Central order state management
│   │   │   ├── usePriceIntelligence.js     # Price compare logic
│   │   │   └── useDebounce.js
│   │   ├── store/
│   │   │   ├── orderStore.js               # Zustand: live order state
│   │   │   ├── productsStore.js            # Zustand: product catalog cache
│   │   │   └── settingsStore.js            # Zustand: API keys + preferences
│   │   ├── api/
│   │   │   ├── client.js                   # Axios instance + interceptors
│   │   │   ├── orders.js
│   │   │   ├── products.js
│   │   │   ├── distributors.js
│   │   │   ├── catalog.js
│   │   │   ├── aiParse.js
│   │   │   └── shareLinks.js
│   │   ├── utils/
│   │   │   ├── priceUtils.js               # format, classify, color-code prices
│   │   │   ├── fuzzyMatch.js               # Client-side product name matching
│   │   │   └── formatters.js               # Currency, date, size formatters
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py                         # FastAPI app + CORS + router registration
│   │   ├── config.py                       # Settings from env
│   │   ├── database.py                     # SQLAlchemy engine + session
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── product.py
│   │   │   ├── distributor.py
│   │   │   ├── order.py
│   │   │   ├── order_item.py
│   │   │   ├── order_split.py
│   │   │   ├── price_history.py
│   │   │   ├── catalog_upload.py
│   │   │   ├── share_token.py
│   │   │   ├── inventory_log.py
│   │   │   └── app_setting.py
│   │   ├── schemas/
│   │   │   ├── product.py
│   │   │   ├── distributor.py
│   │   │   ├── order.py
│   │   │   └── catalog.py
│   │   ├── routers/
│   │   │   ├── products.py
│   │   │   ├── distributors.py
│   │   │   ├── orders.py
│   │   │   ├── catalog.py
│   │   │   ├── ai_parse.py
│   │   │   ├── share_links.py
│   │   │   └── settings.py
│   │   ├── services/
│   │   │   ├── ai_service.py               # Dual OpenAI + Claude logic
│   │   │   ├── price_engine.py             # DEAL/HOLD/STABLE/RECOVERY_DEAL
│   │   │   ├── order_splitter.py           # Split order by distributor
│   │   │   ├── voice_processor.py          # Whisper transcription
│   │   │   ├── photo_processor.py          # Vision OCR
│   │   │   ├── catalog_parser.py           # PDF/Excel/image catalog parsing
│   │   │   └── pdf_generator.py            # Purchase order PDF export
│   │   └── utils/
│   │       ├── fuzzy_match.py              # rapidfuzz product matching
│   │       └── token_generator.py          # Share link token generation
│   ├── seed/
│   │   └── products_seed.sql               # All 4,930 products (provided below)
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   │       └── 001_initial_schema.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🗄️ DATABASE SCHEMA — Create All Tables Exactly As Written

```sql
-- ============================================================
-- TABLE: distributors
-- ============================================================
CREATE TABLE distributors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    contact_name    VARCHAR(255),
    email           VARCHAR(255),
    phone           VARCHAR(50),
    address         TEXT,
    delivery_days   VARCHAR(100),        -- e.g. "Mon, Wed, Fri"
    min_order_value DECIMAL(10,2) DEFAULT 0,
    notes           TEXT,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Seed 5 real distributors
INSERT INTO distributors (name, contact_name, email, delivery_days) VALUES
  ('Southern Glazers',    'Sales Rep',  'orders@southernglazers.com',  'Mon, Wed, Fri'),
  ('RNDC',                'Sales Rep',  'orders@rndc.com',             'Tue, Thu'),
  ('Reyes Beverage',      'Sales Rep',  'orders@reyesbeverage.com',    'Mon, Wed'),
  ('Anheuser-Busch',      'Sales Rep',  'orders@ab-inbev.com',         'Tue, Fri'),
  ('MillerCoors / Molson','Sales Rep',  'orders@molsoncoors.com',      'Mon, Thu');

-- ============================================================
-- TABLE: products
-- ============================================================
CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    sku             VARCHAR(100),
    upc             VARCHAR(100),
    size            VARCHAR(50),
    pack            VARCHAR(50),
    category        VARCHAR(100),        -- Beer & RTD, Wine, Vodka, Whiskey & Cognac,
                                         -- Tequila & Mezcal, Rum, Gin,
                                         -- Liqueurs & Cordials, Non-Alcoholic,
                                         -- Tobacco, Spirits & Other
    brand           VARCHAR(255),
    distributor_id  UUID REFERENCES distributors(id) ON DELETE SET NULL,
    unit_price      DECIMAL(10,2) DEFAULT 0,
    case_price      DECIMAL(10,2),
    case_pack       INT DEFAULT 12,
    reorder_level   INT DEFAULT 2,
    current_stock   INT DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    aliases         TEXT[],              -- for fuzzy matching: ["henny", "remy"]
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_products_name       ON products USING gin(to_tsvector('english', name));
CREATE INDEX idx_products_category   ON products(category);
CREATE INDEX idx_products_distributor ON products(distributor_id);
CREATE INDEX idx_products_active     ON products(is_active);

-- ============================================================
-- TABLE: price_history
-- ============================================================
CREATE TABLE price_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id          UUID REFERENCES products(id) ON DELETE CASCADE,
    distributor_id      UUID REFERENCES distributors(id) ON DELETE CASCADE,
    effective_month     DATE NOT NULL,           -- first day of month: 2025-03-01
    unit_price          DECIMAL(10,2) NOT NULL,
    case_price          DECIMAL(10,2),
    prev_unit_price     DECIMAL(10,2),
    price_change        DECIMAL(10,2),           -- negative = drop
    price_change_pct    DECIMAL(5,2),
    status              VARCHAR(30),             -- DEAL | HOLD | STABLE | RECOVERY_DEAL
    months_on_hold      INT DEFAULT 0,
    suggested_qty       INT DEFAULT 2,
    catalog_upload_id   UUID,
    created_at          TIMESTAMP DEFAULT NOW(),
    UNIQUE(product_id, effective_month)
);

-- ============================================================
-- TABLE: catalog_uploads
-- ============================================================
CREATE TABLE catalog_uploads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distributor_id  UUID REFERENCES distributors(id),
    upload_month    DATE NOT NULL,
    file_name       VARCHAR(255),
    file_type       VARCHAR(50),             -- pdf | excel | image | csv
    raw_text        TEXT,
    parsed_items    JSONB,
    status          VARCHAR(30) DEFAULT 'processing',  -- processing|complete|error
    ai_provider     VARCHAR(20),             -- openai | claude
    items_parsed    INT DEFAULT 0,
    items_matched   INT DEFAULT 0,
    items_new       INT DEFAULT 0,
    error_message   TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE: orders
-- ============================================================
CREATE TABLE orders (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_month             DATE NOT NULL,
    order_number            VARCHAR(50) UNIQUE,   -- e.g. ORD-2025-03-001
    status                  VARCHAR(30) DEFAULT 'draft',  -- draft|reviewed|split|sent|complete
    total_items             INT DEFAULT 0,
    total_value             DECIMAL(10,2) DEFAULT 0,
    savings_vs_last_month   DECIMAL(10,2) DEFAULT 0,
    held_items_count        INT DEFAULT 0,
    deal_items_count        INT DEFAULT 0,
    notes                   TEXT,
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW(),
    sent_at                 TIMESTAMP
);

-- Auto-generate order number
CREATE SEQUENCE order_seq START 1;

-- ============================================================
-- TABLE: order_items
-- ============================================================
CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id      UUID REFERENCES products(id),
    distributor_id  UUID REFERENCES distributors(id),
    quantity        INT NOT NULL DEFAULT 1,
    unit_price      DECIMAL(10,2),
    line_total      DECIMAL(10,2),
    price_status    VARCHAR(30),             -- DEAL | HOLD | STABLE | RECOVERY_DEAL
    price_change    DECIMAL(10,2),
    source          VARCHAR(30),             -- manual | voice | photo | auto_deal
    was_held        BOOLEAN DEFAULT false,
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE: order_splits  (one row per distributor per order)
-- ============================================================
CREATE TABLE order_splits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID REFERENCES orders(id) ON DELETE CASCADE,
    distributor_id  UUID REFERENCES distributors(id),
    item_count      INT DEFAULT 0,
    subtotal        DECIMAL(10,2) DEFAULT 0,
    status          VARCHAR(30) DEFAULT 'pending',  -- pending|sent|viewed|confirmed
    sent_at         TIMESTAMP,
    viewed_at       TIMESTAMP,
    confirmed_at    TIMESTAMP,
    view_count      INT DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE: order_share_tokens
-- ============================================================
CREATE TABLE order_share_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_split_id  UUID REFERENCES order_splits(id) ON DELETE CASCADE,
    token           VARCHAR(86) UNIQUE NOT NULL,   -- secrets.token_urlsafe(64)
    expires_at      TIMESTAMP,
    viewed_at       TIMESTAMP,
    view_count      INT DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE: inventory_log
-- ============================================================
CREATE TABLE inventory_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID REFERENCES products(id),
    previous_stock  INT,
    new_stock       INT,
    change_amount   INT,
    change_reason   VARCHAR(100),   -- delivery | sale | adjustment | correction
    updated_by      VARCHAR(100) DEFAULT 'manager',
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE: app_settings  (key-value store for API keys etc)
-- ============================================================
CREATE TABLE app_settings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key         VARCHAR(100) UNIQUE NOT NULL,
    value       TEXT,
    is_encrypted BOOLEAN DEFAULT false,
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- Seed default settings
INSERT INTO app_settings (key, value) VALUES
  ('openai_api_key',        ''),
  ('claude_api_key',        ''),
  ('preferred_ai_provider', 'auto'),
  ('store_name',            'Monaco''s Wine & Liquor'),
  ('store_address',         ''),
  ('store_phone',           ''),
  ('deal_threshold',        '0.50'),
  ('hold_threshold',        '0.25'),
  ('deal_boost_pct',        '20'),
  ('recovery_hold_months',  '1');

-- ============================================================
-- TABLE: order_rules
-- ============================================================
CREATE TABLE order_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name       VARCHAR(100),
    rule_type       VARCHAR(50),    -- deal_boost | hold_skip | recovery_trigger
    threshold_pct   DECIMAL(5,2),
    threshold_amt   DECIMAL(10,2),
    action          VARCHAR(100),
    is_active       BOOLEAN DEFAULT true
);
```

---

## 🌱 PRODUCT SEED DATA — 4,930 Items

Place this file at `backend/seed/products_seed.sql`. Run it after schema creation.

The seed data comes from a real liquor store inventory with these categories and counts:
- **Beer & RTD**: 544 items
- **Wine**: 961 items
- **Spirits & Other**: 1,620 items
- **Whiskey & Cognac**: 456 items
- **Vodka**: 389 items
- **Tequila & Mezcal**: 280 items
- **Non-Alcoholic**: 222 items
- **Rum**: 177 items
- **Liqueurs & Cordials**: 160 items
- **Gin**: 67 items
- **Tobacco**: 54 items

**IMPORTANT:** The app must load the seed data from `backend/seed/products_seed.sql` on first run via Alembic or a startup script. The file `items_seed.json` is also available alongside this prompt for the same data in JSON format.

The seed SQL uses this format:
```sql
INSERT INTO products (id, name, upc, size, pack, category, unit_price, reorder_level, is_active, aliases)
VALUES
  (gen_random_uuid(), 'Hennessy VS', '0888190', '750 ml', 'Single', 'Whiskey & Cognac', 28.99, 2, true, ARRAY['henny','hennessy']),
  (gen_random_uuid(), 'Grey Goose', '0853020', '750 ml', 'Single', 'Vodka', 31.45, 2, true, ARRAY['grey goose','goose']),
  -- ... (4928 more rows from items_seed.json)
```

**Build a startup script** `backend/seed_db.py` that:
1. Checks if products table is empty
2. If empty, reads `items_seed.json` and bulk inserts all records
3. Logs progress every 500 records
4. Run this via `python seed_db.py` or automatically on app start

---

## 🤖 AI SERVICE — Dual Provider (OpenAI + Claude)

Build `backend/app/services/ai_service.py` with this EXACT logic:

```python
"""
DUAL AI PROVIDER SERVICE
Rules:
1. Read API keys from app_settings table (set by user in Settings UI)
2. preferred_ai_provider setting: 'openai' | 'claude' | 'auto'
3. Auto mode: try OpenAI first, fall back to Claude if it fails
4. Voice transcription: ALWAYS OpenAI Whisper (Claude has no audio API)
5. Image/catalog parsing: PREFER Claude Vision (better accuracy)
6. Text parsing: use preferred provider, fall back to other
7. If NEITHER key is set: raise clear error "Go to Settings → API Keys"
"""

import anthropic
import openai
import json
import re
from app.database import get_setting

class AIService:

    def get_keys(self):
        return {
            'openai': get_setting('openai_api_key'),
            'claude': get_setting('claude_api_key'),
            'preferred': get_setting('preferred_ai_provider') or 'auto'
        }

    def active_provider(self, keys, task='text'):
        """
        task: 'text' | 'image' | 'voice'
        voice: always openai
        image: prefer claude
        text: use preferred or auto-detect
        """
        if task == 'voice':
            if not keys['openai']:
                raise ValueError("Voice input requires an OpenAI API key. Add it in Settings.")
            return 'openai'
        if task == 'image':
            if keys['claude']: return 'claude'
            if keys['openai']: return 'openai'
            raise ValueError("Image parsing requires an API key. Add one in Settings.")
        # text
        pref = keys['preferred']
        if pref == 'openai' and keys['openai']: return 'openai'
        if pref == 'claude' and keys['claude']: return 'claude'
        if keys['openai']: return 'openai'
        if keys['claude']: return 'claude'
        raise ValueError("No AI API key configured. Go to Settings → API Keys.")

    async def transcribe_audio(self, audio_bytes: bytes) -> str:
        """
        Transcribe voice recording using OpenAI Whisper.
        Returns plain text transcript.
        """
        keys = self.get_keys()
        provider = self.active_provider(keys, 'voice')
        client = openai.OpenAI(api_key=keys['openai'])
        response = client.audio.transcriptions.create(
            model='whisper-1',
            file=('audio.webm', audio_bytes, 'audio/webm'),
            response_format='text'
        )
        return response

    async def parse_order_text(self, raw_text: str) -> list[dict]:
        """
        Extract product names + quantities from voice transcript or typed text.
        Handles formats like:
          "3 cases Hennessy, 5 corona 12 pack, 2 grey goose"
          "Hennessy x3, Patron x2, Modelo 18pk x4"

        Returns: [{"name": "Hennessy VS", "qty": 3, "unit": "cases", "raw": "3 Hennessy"}]
        """
        keys = self.get_keys()
        prompt = f"""
You are a liquor store inventory assistant. Extract ALL product names and quantities from this order text.

Rules:
- Return ONLY a valid JSON array, no explanation, no markdown backticks
- If quantity is not specified, default to 1
- If unit is not specified, default to "cases"
- Normalize brand names: capitalize properly
- Include the original raw phrase for each item

Format: [{{"name": "product name", "qty": number, "unit": "cases|bottles|packs", "raw": "original text"}}]

Text to parse:
{raw_text}
"""
        provider = self.active_provider(keys, 'text')
        try:
            result = await self._call_provider(provider, keys, prompt)
            return self._parse_json_response(result)
        except Exception as e:
            # Fallback to other provider
            other = 'claude' if provider == 'openai' else 'openai'
            if keys.get(other):
                result = await self._call_provider(other, keys, prompt)
                return self._parse_json_response(result)
            raise e

    async def parse_catalog_image(self, image_b64: str, media_type: str) -> list[dict]:
        """
        Extract product names + prices from a catalog photo, PDF page, or screenshot.
        Returns: [{"name": "...", "unit_price": 0.00, "case_price": 0.00, "size": "750ml", "sku": ""}]
        """
        keys = self.get_keys()
        prompt = """
You are reading a liquor distributor price catalog or invoice.
Extract ALL products visible with their prices and sizes.
Return ONLY a valid JSON array, no markdown:
[{"name": "product name", "sku": "if visible or empty", "size": "750ml or empty", "unit_price": 0.00, "case_price": 0.00}]
If case price is not shown, leave it 0.
If only one price shown, put it in unit_price.
"""
        provider = self.active_provider(keys, 'image')
        if provider == 'claude':
            return await self._claude_vision(keys['claude'], image_b64, media_type, prompt)
        else:
            return await self._openai_vision(keys['openai'], image_b64, media_type, prompt)

    async def _call_provider(self, provider, keys, prompt):
        if provider == 'openai':
            client = openai.OpenAI(api_key=keys['openai'])
            resp = client.chat.completions.create(
                model='gpt-4o',
                messages=[{'role': 'user', 'content': prompt}],
                temperature=0
            )
            return resp.choices[0].message.content
        else:
            client = anthropic.Anthropic(api_key=keys['claude'])
            resp = client.messages.create(
                model='claude-opus-4-5',
                max_tokens=4000,
                messages=[{'role': 'user', 'content': prompt}]
            )
            return resp.content[0].text

    async def _claude_vision(self, key, image_b64, media_type, prompt):
        client = anthropic.Anthropic(api_key=key)
        resp = client.messages.create(
            model='claude-opus-4-5',
            max_tokens=4000,
            messages=[{'role': 'user', 'content': [
                {'type': 'image', 'source': {'type': 'base64', 'media_type': media_type, 'data': image_b64}},
                {'type': 'text', 'text': prompt}
            ]}]
        )
        return self._parse_json_response(resp.content[0].text)

    async def _openai_vision(self, key, image_b64, media_type, prompt):
        client = openai.OpenAI(api_key=key)
        resp = client.chat.completions.create(
            model='gpt-4o',
            messages=[{'role': 'user', 'content': [
                {'type': 'image_url', 'image_url': {'url': f'data:{media_type};base64,{image_b64}'}},
                {'type': 'text', 'text': prompt}
            ]}],
            temperature=0
        )
        return self._parse_json_response(resp.choices[0].message.content)

    def _parse_json_response(self, text):
        clean = re.sub(r'```json|```', '', text).strip()
        return json.loads(clean)

    async def test_key(self, provider: str, key: str) -> bool:
        """Test if an API key is valid. Returns True/False."""
        try:
            if provider == 'openai':
                client = openai.OpenAI(api_key=key)
                client.models.list()
                return True
            else:
                client = anthropic.Anthropic(api_key=key)
                client.messages.create(
                    model='claude-haiku-4-5-20251001',
                    max_tokens=10,
                    messages=[{'role': 'user', 'content': 'ping'}]
                )
                return True
        except:
            return False
```

---

## 💡 PRICE INTELLIGENCE ENGINE

Build `backend/app/services/price_engine.py`:

```python
"""
PRICE INTELLIGENCE ENGINE

Classification rules (configurable via app_settings):
  DEAL:           price dropped >= $0.50  (deal_threshold)
  HOLD:           price increased >= $0.25 (hold_threshold)
  STABLE:         price change < threshold in either direction
  RECOVERY_DEAL:  was HOLD for >= 1 month (recovery_hold_months) AND now price dropped

Order quantity suggestions:
  DEAL:           base reorder_level × 1.2 (20% boost)
  RECOVERY_DEAL:  base reorder_level × 1.5 (50% boost — you waited, now stock up)
  HOLD:           0 (skip — do not order)
  STABLE:         base reorder_level (normal)

Main functions to build:
  process_new_catalog(db, distributor_id, upload_month, parsed_items) -> dict
    - For each parsed item, fuzzy match to products table
    - Compare new price to last month's price_history row
    - Save new price_history row with status
    - Return summary: {deals, holds, stable, new_items, savings_potential}

  build_smart_order(db, order_month) -> dict
    - Query all price_history rows for order_month
    - Skip HOLD items
    - Suggest quantities for all others
    - Return pre-populated order item list

  get_monthly_summary(db, month) -> dict
    - Return aggregate: total_deals, total_holds, total_stable,
      savings_if_all_deals_ordered, top_5_deals, top_5_holds

  get_savings_history(db, months=12) -> list
    - Return last N months of savings data for chart
"""
```

---

## 🔍 FUZZY PRODUCT MATCHING

Build `backend/app/utils/fuzzy_match.py`:

```python
"""
FUZZY PRODUCT MATCHER

Uses rapidfuzz for fast similarity matching.
Also checks the products.aliases array.

match_product(db, raw_name: str, distributor_id: str = None) -> Product | None
  - First try exact match on products.name (case insensitive)
  - Then try match on aliases array
  - Then rapidfuzz WRatio score >= 75 on product names
  - If distributor_id given, filter to that distributor first, then all
  - Returns best match or None

match_multiple(db, raw_names: list[str]) -> list[dict]
  - Batch match list of names
  - Returns [{raw, matched_product, score, confident: bool}]
  - confident = True if score >= 85

Common aliases to pre-seed in products.aliases:
  "henny" -> Hennessy VS
  "grey goose" -> Grey Goose Vodka
  "patron silver" -> Patron Silver Tequila
  "don julio blanco" -> Don Julio Blanco
  "jack" -> Jack Daniels Tennessee Whiskey
  "titos" -> Tito's Handmade Vodka
  "modelo" -> Modelo Especial
  "corona" -> Corona Extra
  "hennessy" -> Hennessy VS
  "remy" -> Remy Martin VSOP
  "ciroc" -> Ciroc Vodka
  "casamigos" -> Casamigos Blanco
"""
```

---

## 🔗 SHAREABLE ORDER LINKS

Build `backend/app/routers/share_links.py`:

```python
"""
SHAREABLE ORDER LINKS — Full Flow

1. Manager finalizes order and splits it by distributor
2. For each order_split, manager clicks "Generate Link"
3. System generates: secrets.token_urlsafe(64)
4. Saves to order_share_tokens table
5. Returns: {token, full_link: "https://app.com/order/{token}", expires_at}
6. Manager copies link, texts/emails it to distributor rep

PUBLIC ENDPOINT — /api/public/order/{token}
  - No authentication required
  - Fetch order_share_token by token
  - Validate: is_active=true, not expired
  - Increment view_count, set viewed_at on first view
  - Update order_split.status to 'viewed'
  - Return full order details for that distributor:
    {
      store_name, distributor_name, order_month, order_number,
      items: [{name, sku, size, pack, quantity, unit_price, line_total}],
      subtotal, item_count, status,
      generated_at, expires_at
    }

POST /api/public/order/{token}/confirm
  - Distributor clicks "Confirm Receipt" button
  - Sets order_split.status = 'confirmed', confirmed_at = NOW()
  - Returns {confirmed: true}

DELETE /api/share/{token}
  - Manager revokes a link
  - Sets is_active = false

GET /api/share/splits/{order_id}
  - Returns all splits for an order with their token status
  - Each split shows: {distributor, items, subtotal, token?, link?, status, view_count}
"""
```

---

## 🎤 VOICE INPUT FEATURE — Full Real-Time Transcript + Autocorrect

### Frontend: `VoiceInput.jsx`

Build this component with EXACT behavior:

```
RECORDING PHASE:
- Big circular mic button
- On click: request microphone permission, start MediaRecorder
- Show red pulsing animation while recording
- Show live waveform (animated bars) while recording
- Record audio chunks every 3 seconds
- Every 3 seconds: send chunk to /api/ai/transcribe-chunk
- Display running transcript in real time as words come in
- Each word appears one at a time (streaming text effect)
- User sees exactly what is being recognized as they speak

AFTER STOP RECORDING:
- Show full transcript text in editable textarea
- Show "Matching products..." loading state
- Send full transcript to /api/ai/parse-order
- Display matched products list immediately below
- Each matched item shows:
  - Product name (green if confident match, yellow if fuzzy, red if not found)
  - Matched product from catalog (with size)
  - Price status badge (DEAL / HOLD / STABLE)
  - Quantity input (pre-filled from transcript)
  - [Add to Order] button OR [already added] if already in order

AUTOCORRECT BEHAVIOR:
- "3 hennesy" → matches "Hennessy VS 750ml" (fuzzy)
- "5 corono" → matches "Corona Extra 12pk" (fuzzy)
- Show original recognized text crossed out, corrected name next to it
- Manager can click any matched item to change the product mapping

LIVE ORDER UPDATE:
- When manager clicks [Add to Order] or [Add All]
- The LiveOrderSidebar updates INSTANTLY
- Show brief green flash animation on the sidebar item
```

### Backend: Voice Endpoints

```
POST /api/ai/transcribe-chunk
  - Accepts: audio/webm chunk (multipart)
  - Sends to OpenAI Whisper
  - Returns: {text: "partial transcript"}
  - Used for real-time display during recording

POST /api/ai/parse-order
  - Accepts: {text: "full transcript or typed text", order_id: "uuid"}
  - Runs parse_order_text() from AIService
  - Runs match_multiple() from FuzzyMatcher
  - Returns: {
      items: [{
        raw: "3 hennessy",
        matched_product: {id, name, size, unit_price, price_status},
        quantity: 3,
        confidence: 0.95,
        already_in_order: false
      }],
      unmatched: ["unknown item name"]
    }
```

---

## 📷 PHOTO INPUT FEATURE

### Frontend: `PhotoInput.jsx`

```
- Drag-and-drop zone OR camera capture button (on mobile)
- Shows image preview after upload
- "Analyzing..." progress state with spinner
- Shows extracted items same format as voice: name, qty, match, price badge
- Same [Add to Order] and [Add All] buttons
- Supports: JPG, PNG, HEIC, PDF (first page)
```

### Backend: `/api/ai/parse-photo`
```
- Accepts: image file (multipart)
- Convert to base64
- Send to AIService.parse_catalog_image()
- Run fuzzy matching on results
- Return same format as parse-order response
```

---

## ✏️ MANUAL ENTRY — Product Grid with +/- Buttons

### Frontend: `ManualEntry.jsx`

This is the most important input screen. Build EXACTLY as described:

```
LAYOUT:
- Full width product grid/list
- Search bar at top (prominent, auto-focused)
- Category filter tabs: All | Beer & RTD | Wine | Vodka | Whiskey & Cognac |
  Tequila & Mezcal | Rum | Gin | Liqueurs & Cordials | Non-Alcoholic |
  Tobacco | Spirits & Other
- Products displayed as rows (not cards — list view is faster)

SEARCH BEHAVIOR:
- Instant search as user types (no button)
- Debounced 200ms
- Searches: name, brand, sku, aliases
- Highlights matching text in results
- Shows top 50 results max

EACH PRODUCT ROW SHOWS:
- Product name (bold)
- Size + Pack (gray text)
- Category badge
- Current price ($xx.xx)
- Price status badge (DEAL/HOLD/STABLE — only if price_history exists)
- Stock level (if current_stock > 0)
- [ - ] [  2  ] [ + ] quantity control
- [Add] button → adds to order, or if already in order, shows quantity already added

QUANTITY CONTROL:
- Click + : increase qty by 1
- Click - : decrease qty by 1 (min 0)
- Click the number: type exact quantity
- When qty > 0: row highlights green subtly
- Pressing [Add] with qty=0 does nothing

ORDER UPDATE:
- Every time [Add] is clicked or quantity changes on an already-added item:
  → LiveOrderSidebar updates IMMEDIATELY
  → No page reload, no full re-fetch
  → Use Zustand store for instant UI update
```

---

## 📋 LIVE ORDER SIDEBAR — Always Visible

### Frontend: `LiveOrderSidebar.jsx`

```
ALWAYS VISIBLE on the right side during order entry (all 3 input methods).
Width: 320px, fixed position.

CONTENT:
- Header: "Current Order" + item count badge
- Running list of all items added:
  Each item:
  - Product name (truncated if long)
  - Size
  - [ - ] [qty] [ + ] inline edit
  - Price × qty = line total
  - Price badge (DEAL/HOLD/STABLE)
  - [×] remove button

- Separator line
- Subtotal
- "X items on DEAL — saving $XX.XX" (green)
- "X items HELD (price too high)" (red, if any)

- Bottom buttons:
  [Clear Order]  [Review & Split →]

ANIMATIONS:
- New item added: slide in from top with green flash
- Item removed: fade out
- Qty change: number flips (CSS counter animation)
- Subtotal: smooth number transition

BEHAVIOR:
- Synced with Zustand orderStore
- Any change from Voice, Photo, OR Manual tab → sidebar updates instantly
- Persists across tab switches (don't lose order when switching Voice→Manual)
```

---

## 🏢 DISTRIBUTORS SECTION — Full CRUD

### Page: `DistributorsPage.jsx`

```
LIST VIEW:
- Table with columns: Name | Contact | Email | Phone | Delivery Days |
  Products Assigned | Min Order | Status | Actions
- Action buttons per row: [Edit] [View Products] [Delete]
- [+ Add Distributor] button top right
- Toggle active/inactive status inline

ADD / EDIT MODAL (DistributorForm.jsx):
Fields:
  - Company Name *
  - Contact Person Name
  - Email Address
  - Phone Number
  - Street Address
  - Delivery Days (multi-select checkboxes: Mon Tue Wed Thu Fri Sat)
  - Minimum Order Value ($)
  - Notes (textarea)
  - Is Active toggle

DELETE:
  - Show confirm modal: "Delete [Name]? This will unassign X products."
  - Soft delete (set is_active = false)
  - Products assigned to this distributor → distributor_id set to NULL

VIEW PRODUCTS for a distributor:
  - Modal or slide-out panel
  - Shows all products assigned to this distributor
  - Each row: Product Name | Size | Category | Price | [Unassign]
  - [+ Assign Products] button → searchable product picker
  - Shows count: "47 products assigned"

BACKEND ENDPOINTS:
GET    /api/distributors           → list all (include product_count)
POST   /api/distributors           → create
PUT    /api/distributors/{id}      → update
DELETE /api/distributors/{id}      → soft delete
GET    /api/distributors/{id}/products  → products for this distributor
POST   /api/distributors/{id}/assign   → {product_ids: []} → assign products
DELETE /api/distributors/{id}/unassign → {product_ids: []} → unassign
```

---

## 📦 PRODUCTS / ITEMS LIST SECTION

### Page: `ProductsPage.jsx`

This is a full inventory management page. Build with ALL these features:

```
TOOLBAR:
- Search bar (searches name, sku, upc, aliases)
- Category dropdown filter
- Distributor dropdown filter
- Size filter
- Status filter (active/inactive)
- [+ Add Product] button
- [Import CSV] button
- [Export CSV] button

LIST VIEW (table):
Columns:
  Name | Size | Pack | Category | Distributor | Price | Stock | Status | Actions

- Sortable columns (click header to sort asc/desc)
- Pagination: 50 items per page
- "Showing X-Y of Z items"

EACH ROW:
- Product Name (click to edit inline or open modal)
- Size (e.g. "750 ml")
- Pack (e.g. "12-Pack")
- Category badge (color-coded)
- Distributor name (or "Unassigned" in gray)
- Current price ($xx.xx)
- Stock badge: green if > reorder_level, yellow if close, red if below
- Active/Inactive toggle (inline)
- Actions: [Edit] [Delete] [Update Stock]

ADD / EDIT PRODUCT MODAL (ProductForm.jsx):
Fields:
  - Product Name *
  - UPC / Barcode
  - SKU
  - Size (dropdown: 50ml | 100ml | 187ml | 200ml | 375ml | 500ml | 750ml |
           1L | 1.75L | 3L | 4L | 5L | 12 Oz | 16 Oz | 24 Oz | Other)
  - Pack (dropdown: Single | 4-Pack | 6-Pack | 8-Pack | 12-Pack | 18-Pack |
           24-Pack | 30-Pack | Other)
  - Category (dropdown of 11 categories)
  - Distributor (searchable dropdown of all distributors)
  - Unit Price ($)
  - Reorder Level (number input, default 2)
  - Current Stock (number input)
  - Aliases (tag input — type alias, press Enter to add)
  - Notes
  - Is Active toggle

DELETE:
  - Confirm modal
  - Soft delete (is_active = false)
  - Check: if product is in any open orders, warn user

UPDATE STOCK:
  - Small modal: "Update Stock for [Product Name]"
  - Current: X cases
  - New count: [input]
  - Reason: delivery | sale | adjustment | correction
  - [Save] → logs to inventory_log table

BULK ACTIONS:
  - Select multiple rows with checkboxes
  - Bulk: [Assign Distributor] [Set Active] [Set Inactive] [Delete]

IMPORT CSV:
  - Upload CSV file
  - Map columns: name | size | pack | category | price | upc
  - Preview first 5 rows
  - Import → shows progress bar and result summary

BACKEND ENDPOINTS:
GET    /api/products                    → list (with filters, pagination, search)
POST   /api/products                    → create
PUT    /api/products/{id}               → update
DELETE /api/products/{id}               → soft delete
POST   /api/products/{id}/stock         → update stock + log
GET    /api/products/low-stock          → below reorder_level
GET    /api/products/search?q=hennessy  → fuzzy search
POST   /api/products/import             → bulk import from CSV
GET    /api/products/export             → download CSV
```

---

## 📊 CATALOG UPLOAD — Distributor Catalog Management

### Page: `CatalogPage.jsx`

```
PURPOSE: Every month each distributor sends you their updated price catalog.
You upload it here. The app reads it, matches products, and updates prices.

LAYOUT:
- Left panel: Select Distributor (dropdown)
- Center: Upload zone
- Right panel: Past uploads list

UPLOAD FLOW:
1. Select distributor from dropdown
2. Select month (month/year picker, defaults to current month)
3. Drop file or click to upload
   Supported: PDF, Excel (.xlsx), CSV, JPG/PNG (photo of catalog)
4. Shows upload progress bar
5. "Analyzing catalog..." with spinning icon
6. Shows results:

RESULTS PANEL:
After processing, show:
┌─────────────────────────────────────────────────┐
│  📋 Southern Glazers — March 2025               │
│  Parsed: 142 items | Matched: 138 | New: 4      │
│                                                 │
│  🟢 DEALS (18 items — price dropped)            │
│  🔴 HOLDS (7 items — price went up)             │
│  ⚪ STABLE (113 items — same price)             │
│                                                 │
│  💰 Potential savings this month: $1,240        │
└─────────────────────────────────────────────────┘

PRICE COMPARISON TABLE:
Columns: Product | Last Month | This Month | Change | % | Status
- Color rows: green = DEAL, red = HOLD, white = STABLE
- Sortable by Status (deals first), Change amount
- Show RECOVERY_DEAL in purple: "Was held X months — now dropped!"
- [Apply Prices] button → confirms and saves to price_history

PAST UPLOADS:
- List of all previous catalog uploads
- Columns: Distributor | Month | Items | Deals | Holds | Uploaded
- Click to re-view the comparison table

BACKEND ENDPOINTS:
POST /api/catalog/upload              → upload + process file
GET  /api/catalog/uploads             → list past uploads
GET  /api/catalog/uploads/{id}        → get specific upload + results
GET  /api/catalog/compare?dist=X&month=Y  → price comparison for distributor+month
POST /api/catalog/apply/{upload_id}   → save prices to price_history
```

---

## 🏠 DASHBOARD

### Page: `DashboardPage.jsx`

```
SUMMARY CARDS (top row):
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 🟢 18 Deals  │ │ 🔴 7 Holds   │ │ 📦 12 Low    │ │ 💰 $1,240    │
│ this month   │ │ skip these   │ │ Stock alerts │ │ potential    │
│              │ │              │ │              │ │ savings      │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

PRICE ALERT FEED (left column):
- Scrollable live feed
- Each entry: [DEAL] Hennessy VS 750ml — dropped $3.50 — Order now!
- Each entry: [HOLD] Jack Daniels 1L — up $2.00 — Skip this month
- Each entry: [🎯 RECOVERY] Maker's Mark — was held 2 months — Now $2 cheaper!
- Click any item → opens product detail

LOW STOCK ALERTS (middle):
- Products where current_stock <= reorder_level
- Columns: Product | Size | In Stock | Reorder At | [Add to Order]
- [Add to Order] adds directly to current draft order

SAVINGS CHART (right):
- Bar chart (recharts)
- X axis: last 6 months
- Y axis: $ saved by skipping HOLD items
- Color: teal bars with dollar amount on top

RECENT ORDERS:
- Last 5 orders
- Columns: Date | Items | Value | Status | Distributors
- Status badges: draft | reviewed | sent | complete
```

---

## ⚙️ SETTINGS PAGE — API Keys + Configuration

### Page: `SettingsPage.jsx`

```
4 TABS: API Keys | Store Info | Order Rules | Notifications

TAB 1 — API Keys:
┌─────────────────────────────────────────────────────────┐
│ 🤖 AI Provider Settings                                  │
│                                                         │
│ Preferred Provider:  ○ Auto  ○ OpenAI  ○ Claude         │
│ "Auto = tries OpenAI first, falls back to Claude"        │
│                                                         │
│ OpenAI API Key                                          │
│ [sk-••••••••••••••••••••••••••••••] [Show] [Test] ✅    │
│ Used for: Voice transcription, text parsing             │
│                                                         │
│ Anthropic (Claude) API Key                              │
│ [sk-ant-••••••••••••••••••••••••••] [Show] [Test] ✅    │
│ Used for: Image/catalog parsing, text parsing           │
│                                                         │
│ [Save API Keys]                                         │
│                                                         │
│ ℹ️ Keys are stored encrypted in your local database.    │
│ Never shared or sent to anyone except the AI providers. │
└─────────────────────────────────────────────────────────┘

TAB 2 — Store Info:
- Store Name
- Address
- Phone
- Email
- Logo upload

TAB 3 — Order Rules:
- Deal Threshold: price must drop at least $[0.50] to be a DEAL
- Hold Threshold: price must increase at least $[0.25] to be HOLD
- Deal Boost %: boost order qty by [20]% on deals
- Recovery Hold Months: item must be held [1] month to trigger RECOVERY_DEAL label
- [Save Rules]

TAB 4 — Notifications:
- Low stock alert: when stock drops below [2] cases
- Email notifications: [email field]
- [Save]

BACKEND ENDPOINTS:
POST /api/settings/api-keys         → save keys (encrypted)
GET  /api/settings/ai-status        → {openai: "connected|invalid|not_set", claude: same}
POST /api/settings/test-key         → {provider, key} → {valid: true/false, error: "..."}
GET  /api/settings/store            → store info
POST /api/settings/store            → update store info
GET  /api/settings/rules            → order rules
POST /api/settings/rules            → update rules
```

---

## 🌐 PUBLIC ORDER PAGE — Company Facing

### Page: `PublicOrderPage.jsx` — Route: `/order/:token`

```
NO LOGIN REQUIRED. This is what the distributor rep sees when they open your link.

LAYOUT (clean, professional):
┌─────────────────────────────────────────────────────────┐
│  🏪 Monaco's Wine & Liquor                               │
│  Purchase Order for: Southern Glazers                    │
│  Order Month: March 2025 | Order #: ORD-2025-03-001     │
├─────────────────────────────────────────────────────────┤
│  Product Name        Size    Pack    Qty   Unit  Total  │
│  ─────────────────────────────────────────────────────  │
│  Hennessy VS         750 ml  Single   10  $28.99 $289.90│
│  Grey Goose          1.75 L  Single    5  $45.00 $225.00│
│  Casamigos Blanco    750 ml  Single    3  $42.00 $126.00│
│  ...                                                    │
├─────────────────────────────────────────────────────────┤
│  Total Items: 23   |   Order Total: $2,847.50           │
├─────────────────────────────────────────────────────────┤
│  [📄 Download PDF]          [✅ Confirm Receipt]         │
└─────────────────────────────────────────────────────────┘

STATUS BANNER:
- If viewed for first time: "Order received — please confirm when you can fulfill it"
- If already confirmed: "✅ Confirmed on March 15, 2025"
- If expired: "This order link has expired"

PDF DOWNLOAD:
- Generates clean PDF purchase order
- Store name + logo at top
- Distributor address block
- Line items table
- Totals
- Generated by LiquorStore Pro footer
```

---

## 🎨 DESIGN SYSTEM — Apply Everywhere

```css
/* Color Palette — Dark Command Center */
:root {
  --bg-primary:    #0d1117;
  --bg-secondary:  #161b22;
  --bg-card:       #1c2128;
  --bg-hover:      #21262d;
  --accent-blue:   #58a6ff;
  --accent-green:  #3fb950;
  --accent-red:    #f85149;
  --accent-yellow: #d29922;
  --accent-purple: #bc8cff;
  --accent-teal:   #39d353;
  --text-primary:  #e6edf3;
  --text-secondary:#8b949e;
  --text-muted:    #484f58;
  --border:        #30363d;
  --border-muted:  #21262d;

  /* Price Status Colors */
  --deal-bg:       rgba(63, 185, 80, 0.15);
  --deal-text:     #3fb950;
  --deal-border:   rgba(63, 185, 80, 0.4);
  --hold-bg:       rgba(248, 81, 73, 0.15);
  --hold-text:     #f85149;
  --hold-border:   rgba(248, 81, 73, 0.4);
  --stable-bg:     rgba(139, 148, 158, 0.1);
  --stable-text:   #8b949e;
  --recovery-bg:   rgba(188, 140, 255, 0.15);
  --recovery-text: #bc8cff;
  --recovery-border: rgba(188, 140, 255, 0.4);
}

/* Price Status Badge Classes */
.badge-deal      { background: var(--deal-bg); color: var(--deal-text); border: 1px solid var(--deal-border); }
.badge-hold      { background: var(--hold-bg); color: var(--hold-text); border: 1px solid var(--hold-border); }
.badge-stable    { background: var(--stable-bg); color: var(--stable-text); }
.badge-recovery  { background: var(--recovery-bg); color: var(--recovery-text); border: 1px solid var(--recovery-border); }

/* Typography */
/* Use: font-family: 'JetBrains Mono', 'Space Mono', monospace for numbers/prices */
/* Use: font-family: 'Inter', system-ui, sans-serif for body text */
```

---

## 🧭 NAVIGATION SIDEBAR

Build `Sidebar.jsx` with these nav items in this order:

```
🏠 Dashboard
📦 New Order          ← Primary action, highlight differently
─────────────────
🗂️  Items List         ← Products catalog management
🏢 Distributors       ← Company management
📋 Catalog Upload     ← Monthly price updates
📜 Order History
─────────────────
⚙️  Settings
```

- Active page: highlighted with accent-blue left border
- "New Order" button: slightly larger, teal/green background
- Show badge on "Items List" if low stock count > 0
- Show badge on "Dashboard" if new deals found this month
- Store name at top of sidebar
- App name "LiquorStore Pro" at very top with small bottle emoji

---

## 📡 ALL API ENDPOINTS — Complete List

```
DISTRIBUTORS
GET    /api/distributors
POST   /api/distributors
PUT    /api/distributors/{id}
DELETE /api/distributors/{id}
GET    /api/distributors/{id}/products
POST   /api/distributors/{id}/assign
DELETE /api/distributors/{id}/unassign

PRODUCTS
GET    /api/products                    ?search=&category=&distributor_id=&page=&per_page=50
POST   /api/products
PUT    /api/products/{id}
DELETE /api/products/{id}
POST   /api/products/{id}/stock
GET    /api/products/low-stock
GET    /api/products/search             ?q=hennessy (fuzzy search, returns top 20)
POST   /api/products/import
GET    /api/products/export

ORDERS
GET    /api/orders                      ?status=&month=
POST   /api/orders
GET    /api/orders/{id}
PUT    /api/orders/{id}
DELETE /api/orders/{id}                 (draft only)
GET    /api/orders/smart-build          ?month=YYYY-MM
POST   /api/orders/{id}/items
PUT    /api/orders/{id}/items/{item_id}
DELETE /api/orders/{id}/items/{item_id}
POST   /api/orders/{id}/split           → creates order_splits
GET    /api/orders/{id}/splits

AI / PARSE
POST   /api/ai/transcribe-chunk         (audio chunk → partial text)
POST   /api/ai/parse-order              (full text → matched products)
POST   /api/ai/parse-photo              (image → matched products)
POST   /api/ai/test-match               (test fuzzy matching)

CATALOG
POST   /api/catalog/upload
GET    /api/catalog/uploads
GET    /api/catalog/uploads/{id}
GET    /api/catalog/compare
POST   /api/catalog/apply/{id}

SHARE LINKS
POST   /api/share/generate/{split_id}
GET    /api/share/splits/{order_id}
DELETE /api/share/{token}
GET    /api/public/order/{token}        (NO AUTH — public)
POST   /api/public/order/{token}/confirm (NO AUTH — public)

SETTINGS
POST   /api/settings/api-keys
GET    /api/settings/ai-status
POST   /api/settings/test-key
GET    /api/settings/store
POST   /api/settings/store
GET    /api/settings/rules
POST   /api/settings/rules

INVENTORY
POST   /api/inventory/update
GET    /api/inventory/log               ?product_id=&days=30
GET    /api/inventory/alerts
```

---

## 📦 DEPENDENCIES

### `backend/requirements.txt`
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.29
alembic==1.13.1
psycopg2-binary==2.9.9
python-dotenv==1.0.1
openai==1.30.1
anthropic==0.28.0
python-multipart==0.0.9
pillow==10.3.0
pymupdf==1.24.3
openpyxl==3.1.2
pandas==2.2.2
python-dateutil==2.9.0
weasyprint==62.1
redis==5.0.4
cryptography==42.0.7
rapidfuzz==3.9.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
aiofiles==23.2.1
```

### `frontend/package.json` dependencies
```json
{
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "react-router-dom": "^6.23.0",
  "axios": "^1.7.0",
  "zustand": "^4.5.2",
  "@tanstack/react-query": "^5.40.0",
  "tailwindcss": "^3.4.3",
  "lucide-react": "^0.383.0",
  "recharts": "^2.12.7",
  "react-dropzone": "^14.2.3",
  "date-fns": "^3.6.0",
  "clsx": "^2.1.1",
  "react-hot-toast": "^2.4.1",
  "fuse.js": "^7.0.0",
  "framer-motion": "^11.2.10"
}
```

---

## 🐳 `docker-compose.yml`

```yaml
version: '3.8'
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: liquorstore
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db/liquorstore
      REDIS_URL: redis://redis:6379
      SECRET_KEY: 1b87f5ee5504f8ea8b735aa0132dd10d0c58b941a2934a52543348670f9b31809618bd25a5558c4814ef3b00699b8c66
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./backend:/app
    command: >
      sh -c "alembic upgrade head &&
             python seed_db.py &&
             uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev -- --host

volumes:
  pgdata:
```

---

## 🔑 `.env.example`

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/liquorstore

# Redis
REDIS_URL=redis://localhost:6379

# Security
SECRET_KEY=1b87f5ee5504f8ea8b735aa0132dd10d0c58b941a2934a52543348670f9b31809618bd25a5558c4814ef3b00699b8c66

# AI Keys (set in app Settings UI — not needed here)
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...

# App
APP_ENV=development
APP_PORT=8000
FRONTEND_URL=http://localhost:5173
```

---

## 🚀 BUILD ORDER — Paste These Into Claude Extension One at a Time

```
STEP 1:
"Create the full project structure for LiquorStore Pro as defined in the
build prompt. Create all directories and empty placeholder files. Initialize
React+Vite frontend with Tailwind. Initialize FastAPI backend. Create
docker-compose.yml, .env.example, and README.md."

STEP 2:
"Create the PostgreSQL database schema using SQLAlchemy models and Alembic.
Create all 10 models: Product, Distributor, Order, OrderItem, OrderSplit,
PriceHistory, CatalogUpload, ShareToken, InventoryLog, AppSetting.
Create the initial Alembic migration. Seed the 5 distributors."

STEP 3:
"Build the seed script backend/seed_db.py that reads items_seed.json
and inserts all 4,930 products into the products table on first run.
Show progress every 500 records. Skip if products already exist."

STEP 4:
"Build the complete AI service (ai_service.py) with dual OpenAI+Claude
provider logic. Build the fuzzy match utility (fuzzy_match.py) using
rapidfuzz. Build the price intelligence engine (price_engine.py) with
full DEAL/HOLD/STABLE/RECOVERY_DEAL classification logic."

STEP 5:
"Build all FastAPI routers: products, distributors, orders, catalog,
ai_parse, share_links, settings. Include all endpoints defined in the
build prompt. Register all routers in main.py with CORS configured."

STEP 6:
"Build the React app foundation: App.jsx with all routes, Layout.jsx,
Sidebar.jsx with all nav items, TopBar.jsx, shared components
(PriceBadge, ConfirmModal, SearchInput, Toast, LoadingSpinner).
Set up Zustand stores (orderStore, productsStore, settingsStore).
Apply the full design system CSS variables."

STEP 7:
"Build the Products/Items List page (ProductsPage.jsx) with the full
feature set: searchable table, category filters, inline stock updates,
Add/Edit/Delete product modal, bulk actions, import/export CSV."

STEP 8:
"Build the Distributors page (DistributorsPage.jsx) with full CRUD:
table view, Add/Edit/Delete distributor modal, view assigned products
panel, assign/unassign products functionality."

STEP 9:
"Build the New Order page with all 3 input methods:
(a) VoiceInput.jsx — real-time transcript, waveform, product matching
(b) PhotoInput.jsx — drag-drop upload, AI extraction, product matching
(c) ManualEntry.jsx — searchable product grid with +/- buttons
(d) LiveOrderSidebar.jsx — always-visible running order list
All three methods must update the same Zustand orderStore instantly."

STEP 10:
"Build the Order Review and Split pages: OrderReview.jsx shows full
order with price badges and savings summary. OrderSplitView.jsx shows
order split by distributor with generate/copy link functionality.
Build the share link generation (POST /api/share/generate)."

STEP 11:
"Build the public order page (PublicOrderPage.jsx at /order/:token).
No auth required. Shows clean order table, download PDF button,
confirm receipt button. Build the PDF generator service."

STEP 12:
"Build the Catalog Upload page (CatalogPage.jsx): distributor selector,
file upload zone, AI parsing, price comparison table with DEAL/HOLD/STABLE
color coding, apply prices button, upload history list."

STEP 13:
"Build the Dashboard (DashboardPage.jsx): summary cards, price alert
feed, low stock alerts, savings chart with recharts, recent orders list."

STEP 14:
"Build the Settings page (SettingsPage.jsx) with all 4 tabs:
API Keys (with test connection buttons), Store Info, Order Rules
with configurable thresholds, Notifications."

STEP 15:
"Wire everything together, test all routes, fix any TypeErrors or
import errors. Make sure LiveOrderSidebar stays in sync across all
3 input tabs. Verify docker-compose builds and runs clean."
```

---

*LiquorStore Pro v2.0 — Complete Build Prompt*
*Product catalog: 4,930 items from Monaco's Wine & Liquor*
*Generated: May 2025*
