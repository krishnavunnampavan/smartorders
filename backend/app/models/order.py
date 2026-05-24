import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Date, ForeignKey, Integer, Numeric, String, Text
from app.utils.db_types import GUID
from sqlalchemy.orm import relationship
from app.database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    order_month = Column(Date, nullable=False)
    status = Column(String(30), default="draft")
    total_items = Column(Integer)
    total_value = Column(Numeric(10, 2))
    savings_vs_last_month = Column(Numeric(10, 2))
    held_items_count = Column(Integer)
    deal_items_count = Column(Integer)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    sent_at = Column(DateTime)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    splits = relationship("OrderSplit", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    order_id = Column(GUID(), ForeignKey("orders.id"))
    product_id = Column(GUID(), ForeignKey("products.id"))
    company_id = Column(GUID(), ForeignKey("companies.id"))
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2))
    line_total = Column(Numeric(10, 2))
    price_status = Column(String(30))
    price_change = Column(Numeric(10, 2))
    source = Column(String(30))
    was_held = Column(Boolean, default=False)
    selected_size = Column(String(20))
    selected_unit = Column(String(30))
    bottles_per_unit = Column(Integer, default=1)
    total_bottles = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")
    company = relationship("Company")


class OrderSplit(Base):
    __tablename__ = "order_splits"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    order_id = Column(GUID(), ForeignKey("orders.id"))
    company_id = Column(GUID(), ForeignKey("companies.id"))
    item_count = Column(Integer)
    subtotal = Column(Numeric(10, 2))
    status = Column(String(30), default="pending")
    sent_at = Column(DateTime)
    confirmed_at = Column(DateTime)

    order = relationship("Order", back_populates="splits")
    company = relationship("Company", back_populates="order_splits")
    share_tokens = relationship("OrderShareToken", back_populates="order_split")
