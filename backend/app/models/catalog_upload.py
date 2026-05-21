import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, Date, ForeignKey, Integer, JSON, String, Text
from app.utils.db_types import GUID
from sqlalchemy.orm import relationship
from app.database import Base


class CatalogUpload(Base):
    __tablename__ = "catalog_uploads"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id = Column(GUID(), ForeignKey("companies.id"))
    upload_month = Column(Date, nullable=False)
    file_name = Column(String(255))
    file_type = Column(String(50))
    raw_text = Column(Text)
    parsed_items = Column(JSON)
    status = Column(String(30))
    ai_provider = Column(String(20))
    items_parsed = Column(Integer, default=0)
    items_matched = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company")
