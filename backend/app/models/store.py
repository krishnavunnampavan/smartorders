import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.utils.db_types import GUID
from app.database import Base


class Store(Base):
    __tablename__ = "stores"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    access_key = Column(String(10), unique=True, nullable=False)
    is_owner_platform = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    address = Column(String(300))
    phone = Column(String(50))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    inventory_uploads = relationship("StoreInventoryUpload", back_populates="store", cascade="all, delete-orphan")
    inventory_items = relationship("StoreInventoryItem", back_populates="store", cascade="all, delete-orphan")


class StoreInventoryUpload(Base):
    __tablename__ = "store_inventory_uploads"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    store_id = Column(GUID(), ForeignKey("stores.id"), nullable=False)
    filename = Column(String(300))
    total_rows = Column(Integer, default=0)
    duplicates_removed = Column(Integer, default=0)
    matched_products = Column(Integer, default=0)
    status = Column(String(30), default="processed")
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    store = relationship("Store", back_populates="inventory_uploads")
    items = relationship("StoreInventoryItem", back_populates="upload", cascade="all, delete-orphan")


class StoreInventoryItem(Base):
    __tablename__ = "store_inventory_items"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    store_id = Column(GUID(), ForeignKey("stores.id"), nullable=False)
    upload_id = Column(GUID(), ForeignKey("store_inventory_uploads.id"), nullable=False)
    product_id = Column(GUID(), ForeignKey("products.id"), nullable=True)
    product_name = Column(String(300), nullable=False)
    sku = Column(String(100))
    quantity = Column(Integer, default=0)
    unit_size = Column(String(50))
    category = Column(String(100))

    store = relationship("Store", back_populates="inventory_items")
    upload = relationship("StoreInventoryUpload", back_populates="items")
    product = relationship("Product")
