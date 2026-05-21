"""Unit tests for fuzzy product matching."""
import pytest
from app.utils.fuzzy_match import match_product, save_alias


class TestMatchProduct:
    def test_exact_match(self, db, sample_product):
        result = match_product(db, "Hennessy VS 750ml")
        assert result is not None
        assert result.id == sample_product.id

    def test_alias_match(self, db, sample_product):
        result = match_product(db, "henny")
        assert result is not None
        assert result.id == sample_product.id

    def test_case_insensitive(self, db, sample_product):
        result = match_product(db, "HENNESSY VS")
        assert result is not None
        assert result.id == sample_product.id

    def test_partial_name_match(self, db, sample_product):
        result = match_product(db, "Hennessy")
        assert result is not None
        assert result.id == sample_product.id

    def test_no_match_returns_none(self, db, sample_product):
        result = match_product(db, "Extremely obscure product xyz123")
        assert result is None

    def test_empty_string_returns_none(self, db, sample_product):
        result = match_product(db, "")
        assert result is None

    def test_typo_match(self, db, sample_product):
        # "Hennessey" with extra 'e' — should still match
        result = match_product(db, "Hennessey VS")
        assert result is not None


class TestSaveAlias:
    def test_save_new_alias(self, db, sample_product):
        save_alias(db, str(sample_product.id), "cognac")
        db.refresh(sample_product)
        assert "cognac" in sample_product.aliases

    def test_no_duplicate_alias(self, db, sample_product):
        save_alias(db, str(sample_product.id), "henny")  # already in aliases
        save_alias(db, str(sample_product.id), "henny")
        db.refresh(sample_product)
        count = sum(1 for a in sample_product.aliases if a == "henny")
        assert count == 1
