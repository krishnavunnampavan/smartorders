import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Numeric, String, Text
from app.utils.db_types import GUID
from sqlalchemy.orm import relationship
from app.database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    contact_name = Column(String(255))
    email = Column(String(255))
    phone = Column(String(50))
    delivery_days = Column(String(100))
    min_order_value = Column(Numeric(10, 2))
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    products = relationship("Product", back_populates="company")
    order_splits = relationship("OrderSplit", back_populates="company")
    price_history = relationship("PriceHistory", back_populates="company")
