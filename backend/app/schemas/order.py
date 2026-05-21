from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class OrderItemCreate(BaseModel):
    product_id: UUID
    company_id: UUID
    quantity: int
    unit_price: Optional[Decimal] = None
    source: str = "manual"


class OrderItemUpdate(BaseModel):
    quantity: int


class OrderItemOut(BaseModel):
    id: UUID
    product_id: UUID
    company_id: UUID
    quantity: int
    unit_price: Optional[Decimal]
    line_total: Optional[Decimal]
    price_status: Optional[str]
    price_change: Optional[Decimal]
    source: Optional[str]
    was_held: bool

    model_config = {"from_attributes": True}


class OrderCreate(BaseModel):
    order_month: date
    notes: Optional[str] = None


class OrderUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


class OrderSplitOut(BaseModel):
    id: UUID
    order_id: UUID
    company_id: UUID
    item_count: Optional[int]
    subtotal: Optional[Decimal]
    status: str
    sent_at: Optional[datetime]
    confirmed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class OrderOut(BaseModel):
    id: UUID
    order_month: date
    status: str
    total_items: Optional[int]
    total_value: Optional[Decimal]
    savings_vs_last_month: Optional[Decimal]
    held_items_count: Optional[int]
    deal_items_count: Optional[int]
    notes: Optional[str]
    created_at: datetime
    sent_at: Optional[datetime]

    model_config = {"from_attributes": True}
