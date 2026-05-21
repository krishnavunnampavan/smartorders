# Deployment Guide — LiquorStore Pro

## Architecture
```
Vercel (frontend)  ──→  Railway/Render (FastAPI backend)  ──→  Neon/Supabase (PostgreSQL)
                                                           ──→  Upstash (Redis)
```

## Step 1 — Backend (Railway)

1. Create account at [railway.app](https://railway.app)
2. New Project → Deploy from GitHub Repo → select `liquorstore-pro/backend`
3. Add a PostgreSQL database plugin
4. Add environment variables:
   ```
   DATABASE_URL=<from Railway PostgreSQL>
   REDIS_URL=<from Upstash or Railway Redis>
   SECRET_KEY=<generate: python -c "import secrets; print(secrets.token_hex(32))">
   ```
5. Deploy — Railway auto-detects the Dockerfile
6. Copy your backend URL (e.g. `https://liquorstore-pro.up.railway.app`)

### Run Migrations
```bash
# SSH into Railway shell or run via CLI
alembic upgrade head
```

## Step 2 — Frontend (Vercel)

1. Create account at [vercel.com](https://vercel.com)
2. Import GitHub repo → select the `frontend/` directory as root
3. Framework: **Vite**
4. Build Command: `npm run build`
5. Output Dir: `dist`
6. Add environment variable:
   ```
   VITE_API_URL=https://your-backend.railway.app
   ```
7. In `frontend/vercel.json`, replace `your-backend.railway.app` with your actual Railway URL
8. Deploy

## Step 3 — Database (Neon — free tier)

1. Create account at [neon.tech](https://neon.tech)
2. Create project → copy connection string
3. Update `DATABASE_URL` in Railway with the Neon connection string

## Step 4 — AI Keys

Go to your deployed app → **Settings → API Keys** and add:
- OpenAI API key (for voice + text parsing)
- Claude API key (for image parsing)

## Environment Variables Summary

| Variable | Where | Description |
|----------|-------|-------------|
| `DATABASE_URL` | Railway | PostgreSQL connection string |
| `REDIS_URL` | Railway | Redis connection string |
| `SECRET_KEY` | Railway | 32-byte random secret |
| `VITE_API_URL` | Vercel | Backend API URL |

## Local Development (quick start)

```bash
cp .env.example .env
# Edit .env with your values
docker compose up
# Frontend: http://localhost:5173
# Backend:  http://localhost:8000/docs
```

## Running Tests

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt pytest httpx
pytest tests/ -v
```
