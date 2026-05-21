from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr


class CompanyBase(BaseModel):
    name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    delivery_days: Optional[str] = None
    min_order_value: Optional[Decimal] = None
    notes: Optional[str] = None


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(CompanyBase):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class CompanyOut(CompanyBase):
    id: UUID
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
