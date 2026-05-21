"""Integration tests for the products API."""
import pytest


class TestProductsAPI:
    def test_create_product(self, client, sample_company):
        resp = client.post("/api/products", json={
            "name": "Maker's Mark 750ml",
            "category": "spirits",
            "subcategory": "bourbon",
            "brand": "Maker's Mark",
            "unit_size": "750ml",
            "case_pack": 12,
            "company_id": str(sample_company.id),
            "reorder_level": 3,
        })
        assert resp.status_code == 201
        assert resp.json()["name"] == "Maker's Mark 750ml"

    def test_list_products(self, client, sample_product):
        resp = client.get("/api/products")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_filter_by_company(self, client, sample_product, sample_company):
        resp = client.get(f"/api/products?company_id={sample_company.id}")
        assert resp.status_code == 200
        assert all(p["company_id"] == str(sample_company.id) for p in resp.json())

    def test_low_stock_alert(self, client, db, sample_product):
        # Product has stock=5, reorder=2 → NOT low
        resp = client.get("/api/products/low-stock")
        assert resp.status_code == 200
        low = resp.json()
        assert not any(p["id"] == str(sample_product.id) for p in low)

        # Set stock below reorder level
        sample_product.current_stock = 1
        db.commit()
        resp = client.get("/api/products/low-stock")
        low = resp.json()
        assert any(p["id"] == str(sample_product.id) for p in low)

    def test_update_stock(self, client, sample_product):
        resp = client.post(f"/api/products/{sample_product.id}/stock", json={
            "new_stock": 20,
            "change_reason": "delivery",
        })
        assert resp.status_code == 200
        assert resp.json()["new_stock"] == 20

    def test_add_alias(self, client, db, sample_product):
        resp = client.post(
            f"/api/products/{sample_product.id}/alias?alias=henndog"
        )
        assert resp.status_code == 200
        db.refresh(sample_product)
        assert "henndog" in sample_product.aliases

    def test_soft_delete(self, client, sample_product):
        resp = client.delete(f"/api/products/{sample_product.id}")
        assert resp.status_code == 204
        list_resp = client.get("/api/products")
        ids = [p["id"] for p in list_resp.json()]
        assert str(sample_product.id) not in ids
