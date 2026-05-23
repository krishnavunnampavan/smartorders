from __future__ import annotations
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class ProductBase(BaseModel):
    name: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    brand: Optional[str] = None
    unit_size: Optional[str] = None
    pack: Optional[str] = None
    case_pack: int = 12
    unit_price: Optional[float] = 0.0
    case_price: Optional[float] = None
    company_id: Optional[UUID] = None
    reorder_level: int = 2
    aliases: list[str] = []


class ProductCreate(ProductBase):
    pass


class ProductUpdate(ProductBase):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    current_stock: Optional[int] = None


class ProductOut(ProductBase):
    id: UUID
    current_stock: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class StockUpdateIn(BaseModel):
    new_stock: int
    change_reason: str = "adjustment"
    updated_by: str = "manager"
