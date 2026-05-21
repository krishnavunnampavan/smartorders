"""Unit tests for the price intelligence engine."""
from decimal import Decimal
import pytest
from app.services.price_engine import classify_price_change, suggest_quantity


class TestClassifyPriceChange:
    def test_deal_on_50_cent_drop(self):
        assert classify_price_change(Decimal("-0.50"), 0) == "DEAL"

    def test_deal_on_larger_drop(self):
        assert classify_price_change(Decimal("-2.00"), 0) == "DEAL"

    def test_hold_on_25_cent_rise(self):
        assert classify_price_change(Decimal("0.25"), 0) == "HOLD"

    def test_hold_on_larger_rise(self):
        assert classify_price_change(Decimal("1.50"), 0) == "HOLD"

    def test_stable_on_small_positive_change(self):
        assert classify_price_change(Decimal("0.10"), 0) == "STABLE"

    def test_stable_on_zero_change(self):
        assert classify_price_change(Decimal("0.00"), 0) == "STABLE"

    def test_stable_on_small_negative_change(self):
        assert classify_price_change(Decimal("-0.20"), 0) == "STABLE"

    def test_recovery_deal_after_one_month_hold(self):
        # Was on hold for 1 month, now price drops
        assert classify_price_change(Decimal("-0.75"), 1) == "RECOVERY_DEAL"

    def test_recovery_deal_requires_hold_history(self):
        # Price drop but no hold history → just a DEAL
        assert classify_price_change(Decimal("-0.75"), 0) == "DEAL"

    def test_boundary_deal(self):
        # Exactly at threshold
        assert classify_price_change(Decimal("-0.50"), 0) == "DEAL"

    def test_boundary_hold(self):
        assert classify_price_change(Decimal("0.25"), 0) == "HOLD"

    def test_below_boundary_hold(self):
        assert classify_price_change(Decimal("0.24"), 0) == "STABLE"


class TestSuggestQuantity:
    def _make_product(self, reorder_level):
        class FakeProduct:
            pass
        p = FakeProduct()
        p.reorder_level = reorder_level
        return p

    def test_deal_boosts_20_pct(self):
        p = self._make_product(10)
        assert suggest_quantity(p, "DEAL") == 12  # 10 * 1.2

    def test_recovery_deal_boosts_50_pct(self):
        p = self._make_product(10)
        assert suggest_quantity(p, "RECOVERY_DEAL") == 15  # 10 * 1.5

    def test_hold_returns_zero(self):
        p = self._make_product(5)
        assert suggest_quantity(p, "HOLD") == 0

    def test_stable_returns_base(self):
        p = self._make_product(3)
        assert suggest_quantity(p, "STABLE") == 3

    def test_none_reorder_level_defaults_to_two(self):
        p = self._make_product(None)
        assert suggest_quantity(p, "STABLE") == 2
