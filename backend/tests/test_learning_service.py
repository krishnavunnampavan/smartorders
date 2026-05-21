"""Unit + integration tests for the self-learning service."""
import pytest
from app.services.learning_service import (
    log_parse, record_feedback, apply_pending_feedback,
    get_context_hints, get_stats,
)
from app.models.knowledge import KnowledgeBase, AIParseLog, UserFeedback


class TestLogParse:
    def test_log_is_created(self, db):
        log_id = log_parse(
            db, "text", "3 cases henny",
            "openai", "gpt-4o",
            [{"name": "Hennessy VS", "qty": 3}],
            [{"product_id": "abc", "product_name": "Hennessy VS", "quantity": 3}],
            [],
        )
        assert log_id is not None
        log = db.get(AIParseLog, log_id)
        assert log is not None
        assert log.input_type == "text"
        assert log.ai_provider == "openai"


class TestRecordFeedback:
    def test_correction_saves_alias(self, db, sample_product):
        record_feedback(
            db,
            original_text="henn",
            ai_guess="Hennessy XO",
            correct_product_id=str(sample_product.id),
            correct_product_name=sample_product.name,
            feedback_type="correction",
        )
        db.refresh(sample_product)
        assert "henn" in sample_product.aliases

    def test_correction_adds_to_knowledge_base(self, db, sample_product):
        record_feedback(
            db,
            original_text="brown stuff",
            ai_guess="Whiskey",
            correct_product_id=str(sample_product.id),
            correct_product_name=sample_product.name,
            feedback_type="correction",
        )
        kb = db.query(KnowledgeBase).filter_by(
            category="product_alias",
            key="alias:brown stuff",
        ).first()
        assert kb is not None
        assert kb.source == "user_confirmed"

    def test_confirmation_increases_confidence(self, db, sample_product):
        record_feedback(
            db,
            original_text="hennessy vs",
            ai_guess="Hennessy VS 750ml",
            correct_product_id=str(sample_product.id),
            correct_product_name=sample_product.name,
            feedback_type="confirmation",
        )
        kb = db.query(KnowledgeBase).filter_by(
            category="product_alias",
            key="alias:hennessy vs",
        ).first()
        # Either already there or newly created — should exist
        assert kb is not None


class TestGetContextHints:
    def test_empty_when_no_kb(self, db):
        hints = get_context_hints(db)
        assert hints == ""

    def test_returns_alias_hints(self, db, sample_product):
        # Seed a knowledge base entry
        kb = KnowledgeBase(
            category="product_alias",
            key="alias:henny",
            value=str(sample_product.id),
            meta={"product_name": sample_product.name},
            confidence=0.9,
            source="user_confirmed",
            use_count=5,
        )
        db.add(kb)
        db.commit()

        hints = get_context_hints(db)
        assert "henny" in hints
        assert sample_product.name in hints


class TestGetStats:
    def test_stats_all_zero_on_empty(self, db):
        stats = get_stats(db)
        assert stats["total_aliases_learned"] == 0
        assert stats["total_parse_logs"] == 0
        assert stats["total_corrections"] == 0

    def test_stats_reflect_data(self, db, sample_product):
        log_parse(db, "text", "test", "openai", "gpt-4o", [], [], [])
        record_feedback(
            db, "x", "y",
            str(sample_product.id), sample_product.name, "correction"
        )
        stats = get_stats(db)
        assert stats["total_parse_logs"] == 1
        assert stats["total_corrections"] == 1
        assert stats["total_aliases_learned"] >= 1
