"""
Web scraper router — scrape any liquor store website and bulk-import products.
"""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Product, Company
from app.services.web_scraper import scrape_monaco, scrape_any_store
from app.services.company_extractor import find_or_create_company

router = APIRouter(prefix="/api/scraper", tags=["scraper"])

# In-memory job status (resets on cold start, fine for our use case)
_jobs: dict[str, dict] = {}


class ScrapeRequest(BaseModel):
    url: Optional[str] = None  # None = use Monaco's default
    max_products: int = 500
    auto_create_products: bool = True


def _job_id(url: str | None) -> str:
    import hashlib, time
    return hashlib.md5(f"{url or 'monaco'}{time.time()}".encode()).hexdigest()[:12]


@router.post("/start")
async def start_scrape(body: ScrapeRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Kick off a background scrape. Returns a job_id to poll for status."""
    jid = _job_id(body.url)
    _jobs[jid] = {"status": "running", "progress": "Starting…", "found": 0, "imported": 0, "errors": []}
    background_tasks.add_task(_run_scrape, jid, body, db)
    return {"job_id": jid, "status": "running"}


@router.get("/status/{job_id}")
def scrape_status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.get("/preview")
async def preview_scrape(url: str = Query(default=None), max_products: int = 50):
    """
    Non-destructive preview — scrape but don't write to DB.
    Returns what WOULD be imported.
    """
    if url:
        result = await scrape_any_store(url, max_products)
    else:
        result = await scrape_monaco(max_products)
    return result


@router.post("/import-monaco")
async def import_monaco(
    max_products: int = 500,
    db: Session = Depends(get_db),
):
    """
    Synchronous import of Monaco's Wine & Liquor into the DB.
    For large imports use /start (background task).
    """
    result = await scrape_monaco(max_products)
    company_info = result["company_info"]
    company, created = find_or_create_company(db, company_info)

    if not company:
        company = Company(name="Monaco's Wine & Liquor", website="https://www.monacoswineliquor.com")
        db.add(company)
        db.commit()
        db.refresh(company)
        created = True

    imported = _upsert_products(db, result["products"], company)

    return {
        "company": company.name,
        "company_created": created,
        "products_found": result["total_found"],
        "products_imported": imported,
        "pages_scraped": result["pages_scraped"],
        "errors": result["errors"],
    }


@router.post("/import-url")
async def import_from_url(body: ScrapeRequest, db: Session = Depends(get_db)):
    """Import products from any liquor store URL."""
    if not body.url:
        raise HTTPException(400, "url is required")
    result = await scrape_any_store(body.url, body.max_products)
    company, created = find_or_create_company(db, result["company_info"])
    if not company:
        from urllib.parse import urlparse
        company = Company(name=urlparse(body.url).netloc)
        db.add(company)
        db.commit()
        db.refresh(company)

    imported = _upsert_products(db, result["products"], company) if body.auto_create_products else 0
    return {
        "company": company.name,
        "company_created": created,
        "products_found": result["total_found"],
        "products_imported": imported,
    }


def _upsert_products(db: Session, products: list[dict], company: Company) -> int:
    """Insert scraped products; skip if SKU or name already exists for this company."""
    imported = 0
    for p in products:
        name = (p.get("name") or "").strip()
        if not name or len(name) < 3:
            continue
        # Check duplicate by name under same company
        exists = db.query(Product).filter_by(
            company_id=company.id, name=name
        ).first()
        if exists:
            # Update price if we have it
            if p.get("unit_price") and not exists.sku:
                exists.sku = p.get("sku")
            db.flush()
            continue

        product = Product(
            name=name,
            sku=p.get("sku"),
            brand=p.get("brand"),
            category=p.get("category", "spirits"),
            unit_size=p.get("unit_size"),
            case_pack=12,
            company_id=company.id,
            reorder_level=2,
            current_stock=0,
            aliases=[],
        )
        db.add(product)
        imported += 1

    db.commit()
    return imported


async def _run_scrape(job_id: str, body: ScrapeRequest, db: Session) -> None:
    """Background task executor."""
    job = _jobs[job_id]
    try:
        job["progress"] = "Fetching pages…"
        if body.url:
            result = await scrape_any_store(body.url, body.max_products)
        else:
            result = await scrape_monaco(body.max_products)

        job["found"] = result["total_found"]
        job["progress"] = f"Found {result['total_found']} products. Importing…"

        company, created = find_or_create_company(db, result["company_info"])
        if not company:
            company = Company(name=result["company_info"].get("name", "Imported Store"))
            db.add(company)
            db.commit()
            db.refresh(company)

        if body.auto_create_products:
            imported = _upsert_products(db, result["products"], company)
            job["imported"] = imported

        job["status"] = "done"
        job["progress"] = "Complete"
        job["company"] = company.name
        job["errors"] = result.get("errors", [])
    except Exception as e:
        job["status"] = "error"
        job["progress"] = str(e)
        job["errors"] = [str(e)]
