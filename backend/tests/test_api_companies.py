"""Integration tests for the companies API."""
import pytest


class TestCompaniesAPI:
    def test_create_company(self, client):
        resp = client.post("/api/companies", json={
            "name": "Acme Spirits",
            "email": "acme@spirits.com",
            "delivery_days": "Mon, Wed",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Acme Spirits"
        assert "id" in data

    def test_list_companies(self, client, sample_company):
        resp = client.get("/api/companies")
        assert resp.status_code == 200
        companies = resp.json()
        assert len(companies) >= 1
        assert any(c["name"] == "Test Spirits Co" for c in companies)

    def test_get_company(self, client, sample_company):
        resp = client.get(f"/api/companies/{sample_company.id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Test Spirits Co"

    def test_update_company(self, client, sample_company):
        resp = client.put(f"/api/companies/{sample_company.id}", json={
            "name": "Updated Spirits Co",
        })
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Spirits Co"

    def test_delete_company(self, client, sample_company):
        resp = client.delete(f"/api/companies/{sample_company.id}")
        assert resp.status_code == 204
        # Should not appear in active list
        list_resp = client.get("/api/companies")
        names = [c["name"] for c in list_resp.json()]
        assert "Test Spirits Co" not in names

    def test_get_nonexistent_company(self, client):
        resp = client.get("/api/companies/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404

    def test_company_requires_name(self, client):
        resp = client.post("/api/companies", json={"email": "no-name@test.com"})
        assert resp.status_code == 422
