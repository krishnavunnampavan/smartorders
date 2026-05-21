import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from app.utils.db_types import GUID
from sqlalchemy.orm import relationship
from app.database import Base


class AppSetting(Base):
    __tablename__ = "app_settings"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Text)
    is_encrypted = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class OrderRule(Base):
    __tablename__ = "order_rules"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    rule_name = Column(String(100))
    rule_type = Column(String(50))
    threshold_value = Column(Numeric(10, 2))
    action = Column(String(100))
    is_active = Column(Boolean, default=True)


class InventoryLog(Base):
    __tablename__ = "inventory_log"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    product_id = Column(GUID(), ForeignKey("products.id"))
    previous_stock = Column(Integer)
    new_stock = Column(Integer)
    change_reason = Column(String(100))
    updated_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="inventory_logs")
