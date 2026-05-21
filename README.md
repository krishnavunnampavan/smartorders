# LiquorStore Pro — Smart Stock Ordering Platform

A full-stack web app for liquor store managers to order via voice, photo, or manual entry, track monthly price changes with AI-powered buy/hold intelligence, auto-split orders by distributor, and generate shareable order links.

## Stack
- **Frontend:** React 18 + Vite + Tailwind CSS + Zustand + TanStack Query
- **Backend:** FastAPI + Python 3.11 + SQLAlchemy
- **Database:** PostgreSQL 15
- **Cache:** Redis 7
- **AI:** OpenAI (GPT-4o + Whisper) + Anthropic Claude (Vision + text)

## Quick Start

### With Docker Compose (recommended)
```bash
cp .env.example .env
docker compose up
```
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Local Development

**Backend:**
```bash
cd backend
pip install -r requirements.txt
# Set DATABASE_URL in .env
alembic upgrade head
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Configuration

On first run, go to **Settings → API Keys** and add:
- **OpenAI API Key** — for voice transcription (Whisper) and text parsing
- **Claude API Key** — for vision/photo parsing (preferred) and text parsing

The app auto-falls back to the other provider if one fails.

## Features

| Feature | Description |
|---------|-------------|
| 🎤 Voice Order | Record voice → Whisper transcription → fuzzy-matched products |
| 📷 Photo Order | Drag photo of order sheet → Claude Vision extracts items |
| ✏️ Manual Entry | Searchable product dropdown with qty selector |
| 💡 Price Intelligence | DEAL / HOLD / STABLE / RECOVERY_DEAL classification |
| 📊 Catalog Upload | PDF, Excel, or image → AI parsing → price comparison table |
| 🔗 Share Links | Per-distributor shareable links with 30-day expiry |
| 📄 PDF Generation | Download purchase order PDF from share link |
| 📦 Inventory Tracking | Manual stock updates with low-stock alerts |
| 🏢 Company Management | Distributor directory with delivery schedule |

## Price Intelligence Rules

| Status | Trigger | Action |
|--------|---------|--------|
| `DEAL` | Price dropped ≥ $0.50 | Boost order qty 20% |
| `RECOVERY_DEAL` | DEAL after ≥1 month on HOLD | Boost qty 50% |
| `HOLD` | Price rose ≥ $0.25 | Skip ordering |
| `STABLE` | Change < threshold | Order normal qty |

## API Docs
FastAPI auto-generates interactive docs at `/docs` (Swagger) and `/redoc`.
