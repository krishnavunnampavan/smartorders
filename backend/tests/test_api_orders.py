"""Integration tests for the orders API."""
import pytest
from datetime import date


class TestOrdersAPI:
    def test_create_order(self, client):
        resp = client.post("/api/orders", json={"order_month": "2025-05-01"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["order_month"] == "2025-05-01"
        assert data["status"] == "draft"

    def test_list_orders(self, client):
        client.post("/api/orders", json={"order_month": "2025-05-01"})
        client.post("/api/orders", json={"order_month": "2025-04-01"})
        resp = client.get("/api/orders")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_update_order_status(self, client):
        order = client.post("/api/orders", json={"order_month": "2025-05-01"}).json()
        resp = client.put(f"/api/orders/{order['id']}", json={"status": "reviewed"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "reviewed"

    def test_add_item_to_order(self, client, sample_product, sample_company):
        order = client.post("/api/orders", json={"order_month": "2025-05-01"}).json()
        resp = client.post(f"/api/orders/{order['id']}/items", json={
            "product_id": str(sample_product.id),
            "company_id": str(sample_company.id),
            "quantity": 3,
            "source": "manual",
        })
        assert resp.status_code == 201
        item = resp.json()
        assert item["quantity"] == 3

    def test_update_item_quantity(self, client, sample_product, sample_company):
        order = client.post("/api/orders", json={"order_month": "2025-05-01"}).json()
        item = client.post(f"/api/orders/{order['id']}/items", json={
            "product_id": str(sample_product.id),
            "company_id": str(sample_company.id),
            "quantity": 3,
        }).json()
        resp = client.put(f"/api/orders/{order['id']}/items/{item['id']}", json={"quantity": 5})
        assert resp.status_code == 200
        assert resp.json()["quantity"] == 5

    def test_delete_item(self, client, sample_product, sample_company):
        order = client.post("/api/orders", json={"order_month": "2025-05-01"}).json()
        item = client.post(f"/api/orders/{order['id']}/items", json={
            "product_id": str(sample_product.id),
            "company_id": str(sample_company.id),
            "quantity": 2,
        }).json()
        resp = client.delete(f"/api/orders/{order['id']}/items/{item['id']}")
        assert resp.status_code == 204
        items = client.get(f"/api/orders/{order['id']}/items").json()
        assert not any(i["id"] == item["id"] for i in items)

    def test_split_order_by_company(self, client, sample_product, sample_company):
        order = client.post("/api/orders", json={"order_month": "2025-05-01"}).json()
        client.post(f"/api/orders/{order['id']}/items", json={
            "product_id": str(sample_product.id),
            "company_id": str(sample_company.id),
            "quantity": 2,
        })
        resp = client.post(f"/api/orders/{order['id']}/split")
        assert resp.status_code == 200
        splits = resp.json()["splits"]
        assert len(splits) == 1
        assert splits[0]["company_id"] == str(sample_company.id)

    def test_get_nonexistent_order(self, client):
        resp = client.get("/api/orders/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404
