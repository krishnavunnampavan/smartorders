import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, Date, ForeignKey, Integer, Numeric, String
from app.utils.db_types import GUID
from sqlalchemy.orm import relationship
from app.database import Base


class PriceHistory(Base):
    __tablename__ = "price_history"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    product_id = Column(GUID(), ForeignKey("products.id"))
    company_id = Column(GUID(), ForeignKey("companies.id"))
    effective_month = Column(Date, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    case_price = Column(Numeric(10, 2))
    prev_unit_price = Column(Numeric(10, 2))
    price_change = Column(Numeric(10, 2))
    price_change_pct = Column(Numeric(5, 2))
    status = Column(String(30))          # DEAL, HOLD, STABLE, RECOVERY_DEAL
    months_on_hold = Column(Integer, default=0)
    catalog_upload_id = Column(GUID(), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="price_history")
    company = relationship("Company", back_populates="price_history")
