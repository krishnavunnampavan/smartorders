"""SQLAlchemy models for real-time persistent cart."""
import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class ActiveCart(Base):
    __tablename__ = "active_cart"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number  = Column(String(50), unique=False, nullable=True)
    order_month   = Column(Date, nullable=True)
    status        = Column(String(30), default="active")
    notes         = Column(Text, nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    submitted_at  = Column(DateTime, nullable=True)
    submitted_by  = Column(String(100), nullable=True)

    items = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")
    logs  = relationship("CartActivityLog", back_populates="cart", cascade="all, delete-orphan")


class CartItem(Base):
    __tablename__ = "cart_items"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cart_id          = Column(UUID(as_uuid=True), ForeignKey("active_cart.id", ondelete="CASCADE"), nullable=False)
    product_id       = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    product_name     = Column(String(255), nullable=False)
    category         = Column(String(100), nullable=True)
    company_id       = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    company_name     = Column(String(255), nullable=True)
    selected_size    = Column(String(20), default="750ml")
    selected_unit    = Column(String(30), default="Case")
    bottles_per_unit = Column(Integer, default=12)
    quantity         = Column(Integer, nullable=False, default=1)
    total_bottles    = Column(Integer, default=12)
    unit_price       = Column(Numeric(10, 2), default=0)
    case_price       = Column(Numeric(10, 2), default=0)
    effective_price  = Column(Numeric(10, 2), default=0)
    line_total       = Column(Numeric(10, 2), default=0)
    price_status     = Column(String(30), default="STABLE")
    price_change     = Column(Numeric(10, 2), default=0)
    source           = Column(String(30), default="manual")
    added_by         = Column(String(100), default="manager")
    added_at         = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cart    = relationship("ActiveCart", back_populates="items")
    product = relationship("Product")
    company = relationship("Company")


class CartActivityLog(Base):
    __tablename__ = "cart_activity_log"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cart_id      = Column(UUID(as_uuid=True), ForeignKey("active_cart.id", ondelete="CASCADE"), nullable=True)
    action       = Column(String(50))
    product_id   = Column(UUID(as_uuid=True), nullable=True)
    product_name = Column(String(255), nullable=True)
    old_qty      = Column(Integer, nullable=True)
    new_qty      = Column(Integer, nullable=True)
    old_size     = Column(String(20), nullable=True)
    new_size     = Column(String(20), nullable=True)
    done_by      = Column(String(100), default="manager")
    done_at      = Column(DateTime, default=datetime.utcnow)

    cart = relationship("ActiveCart", back_populates="logs")
