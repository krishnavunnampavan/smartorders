import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from app.utils.db_types import GUID
from app.database import Base


class KnowledgeBase(Base):
    """Central knowledge store — liquor domain facts, product lore, store patterns."""
    __tablename__ = "knowledge_base"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    category = Column(String(100), nullable=False)
    key = Column(String(255), nullable=False)
    value = Column(Text)
    meta = Column(JSON)
    confidence = Column(Float, default=1.0)
    source = Column(String(50))
    use_count = Column(Integer, default=0)
    last_used_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AIParseLog(Base):
    """Log every AI parse attempt — powers self-learning feedback loop."""
    __tablename__ = "ai_parse_log"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    input_type = Column(String(30))
    raw_input = Column(Text)
    ai_provider = Column(String(20))
    ai_model = Column(String(50))
    parsed_output = Column(JSON)
    resolved_items = Column(JSON)
    unmatched_items = Column(JSON)
    user_corrections = Column(JSON)
    accepted_count = Column(Integer, default=0)
    rejected_count = Column(Integer, default=0)
    session_id = Column(String(64))
    created_at = Column(DateTime, default=datetime.utcnow)


class UserFeedback(Base):
    """Stores explicit user corrections — 'AI said X, I meant Y'."""
    __tablename__ = "user_feedback"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    parse_log_id = Column(GUID(), ForeignKey("ai_parse_log.id"), nullable=True)
    original_text = Column(Text)
    ai_guess = Column(String(255))
    correct_product_id = Column(GUID(), ForeignKey("products.id"), nullable=True)
    correct_product_name = Column(String(255))
    feedback_type = Column(String(30))
    applied = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
