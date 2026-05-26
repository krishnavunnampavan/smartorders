import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from app.utils.db_types import GUID
from sqlalchemy.orm import relationship
from app.database import Base


class OrderShareToken(Base):
    __tablename__ = "order_share_tokens"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    order_split_id = Column(GUID(), ForeignKey("order_splits.id", ondelete="CASCADE"))
    token = Column(String(64), unique=True, nullable=False)
    expires_at = Column(DateTime)
    viewed_at = Column(DateTime)
    view_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    order_split = relationship("OrderSplit", back_populates="share_tokens")
