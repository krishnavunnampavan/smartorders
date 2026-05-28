from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, field_validator


class StoreCreate(BaseModel):
    name: str
    access_key: str
    address: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("access_key")
    @classmethod
    def validate_key(cls, v):
        v = v.strip()
        if len(v) != 4 or not v.isdigit():
            raise ValueError("Access key must be exactly 4 digits")
        return v


class StoreUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class StoreOut(BaseModel):
    id: UUID
    name: str
    access_key: str
    is_owner_platform: bool
    is_active: bool
    address: Optional[str]
    phone: Optional[str]
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthVerifyRequest(BaseModel):
    access_key: str


class AuthVerifyResponse(BaseModel):
    store_id: str
    store_name: str
    access_key: str
    is_owner: bool


class InventoryUploadOut(BaseModel):
    id: str
    store_id: str
    filename: Optional[str]
    total_rows: int
    duplicates_removed: int
    matched_products: int
    status: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class InventoryItemOut(BaseModel):
    id: str
    product_id: Optional[str]
    product_name: str
    sku: Optional[str]
    quantity: int
    unit_size: Optional[str]
    category: Optional[str]

    model_config = {"from_attributes": True}
