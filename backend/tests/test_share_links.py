"""Integration tests for the shareable order link flow."""
import pytest
from datetime import date


class TestShareLinks:
    def _setup_split(self, client, sample_product, sample_company):
        """Helper: create order → add item → split → return split_id."""
        order = client.post("/api/orders", json={"order_month": "2025-05-01"}).json()
        client.post(f"/api/orders/{order['id']}/items", json={
            "product_id": str(sample_product.id),
            "company_id": str(sample_company.id),
            "quantity": 2,
        })
        splits = client.post(f"/api/orders/{order['id']}/split").json()["splits"]
        return splits[0]["split_id"]

    def test_generate_link(self, client, sample_product, sample_company):
        split_id = self._setup_split(client, sample_product, sample_company)
        resp = client.post(f"/api/share/generate/{split_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["link"].startswith("/order/")

    def test_view_shared_order(self, client, sample_product, sample_company):
        split_id = self._setup_split(client, sample_product, sample_company)
        token = client.post(f"/api/share/generate/{split_id}").json()["token"]

        resp = client.get(f"/api/share/view/{token}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["company_name"] == sample_company.name
        assert len(data["items"]) == 1
        assert data["items"][0]["quantity"] == 2

    def test_view_increments_view_count(self, client, sample_product, sample_company, db):
        from app.models.order_share_token import OrderShareToken
        split_id = self._setup_split(client, sample_product, sample_company)
        token = client.post(f"/api/share/generate/{split_id}").json()["token"]

        client.get(f"/api/share/view/{token}")
        client.get(f"/api/share/view/{token}")

        share = db.query(OrderShareToken).filter_by(token=token).first()
        assert share.view_count == 2

    def test_confirm_receipt(self, client, sample_product, sample_company):
        split_id = self._setup_split(client, sample_product, sample_company)
        token = client.post(f"/api/share/generate/{split_id}").json()["token"]

        resp = client.post(f"/api/share/confirm/{token}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "confirmed"

    def test_revoke_link(self, client, sample_product, sample_company):
        split_id = self._setup_split(client, sample_product, sample_company)
        token = client.post(f"/api/share/generate/{split_id}").json()["token"]

        client.delete(f"/api/share/revoke/{token}")
        resp = client.get(f"/api/share/view/{token}")
        assert resp.status_code == 404

    def test_invalid_token(self, client):
        resp = client.get("/api/share/view/nonexistent-token-xyz")
        assert resp.status_code == 404

    def test_regenerate_invalidates_old_token(self, client, sample_product, sample_company):
        split_id = self._setup_split(client, sample_product, sample_company)
        token1 = client.post(f"/api/share/generate/{split_id}").json()["token"]
        token2 = client.post(f"/api/share/generate/{split_id}").json()["token"]
        assert token1 != token2
        # Old token should be revoked
        resp = client.get(f"/api/share/view/{token1}")
        assert resp.status_code == 404
