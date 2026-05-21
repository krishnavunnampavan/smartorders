import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String
from app.utils.db_types import GUID
from sqlalchemy.orm import relationship
from app.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    sku = Column(String(100))
    barcode = Column(String(100))
    category = Column(String(100))
    subcategory = Column(String(100))
    brand = Column(String(255))
    unit_size = Column(String(50))
    case_pack = Column(Integer, default=12)
    company_id = Column(GUID(), ForeignKey("companies.id"))
    reorder_level = Column(Integer, default=2)
    current_stock = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    aliases = Column(JSON, default=list)          # list[str]; JSON works on SQLite + PostgreSQL
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="products")
    price_history = relationship("PriceHistory", back_populates="product")
    order_items = relationship("OrderItem", back_populates="product")
    inventory_logs = relationship("InventoryLog", back_populates="product")
