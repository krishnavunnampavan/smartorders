"""Integration tests for the settings API."""
import pytest


class TestSettingsAPI:
    def test_get_ai_status_defaults(self, client):
        resp = client.get("/api/settings/ai-status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["openai"] == "not_set"
        assert data["claude"] == "not_set"

    def test_save_api_keys(self, client):
        resp = client.post("/api/settings/api-keys", json={
            "openai_key": "sk-test-openai",
            "preferred_provider": "openai",
        })
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_get_store_info(self, client):
        resp = client.get("/api/settings/store")
        assert resp.status_code == 200
        assert "store_name" in resp.json()

    def test_update_store_info(self, client):
        resp = client.post("/api/settings/store", json={
            "store_name": "Happy Bottles",
            "store_phone": "555-1234",
        })
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_get_order_rules(self, client):
        resp = client.get("/api/settings/rules")
        assert resp.status_code == 200
        # Rules are seeded in migration — may be empty in test SQLite
        assert isinstance(resp.json(), list)
