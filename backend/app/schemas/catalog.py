from __future__ import annotations
from datetime import date, datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class CatalogUploadOut(BaseModel):
    id: UUID
    company_id: Optional[UUID]
    upload_month: date
    file_name: Optional[str]
    file_type: Optional[str]
    status: Optional[str]
    ai_provider: Optional[str]
    items_parsed: int
    items_matched: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PriceCompareEntry(BaseModel):
    product_id: str
    product_name: str
    sku: Optional[str]
    prev_price: float
    new_price: float
    change: float
    change_pct: float
    status: str
    months_on_hold: int
    suggested_qty: int


class PriceCompareResult(BaseModel):
    upload_month: str
    deals: list[PriceCompareEntry]
    holds: list[PriceCompareEntry]
    stable: list[PriceCompareEntry]
    new_items: list[dict]
    savings_potential: float
