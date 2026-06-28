"""Integration tests for the profile-service HTTP API.

Spec coverage:
  - docs/Functional-Test-Cases.md  FT-APC-01 (auto-generation contract)
  - docs/Functional-Test-Cases.md  FT-APC-02 (UUID validation)
  - docs/Functional-Test-Cases.md  FT-PBR-01 (restoration via token)
  - docs/Acceptance-Criteria.md     AC-1.1, AC-1.2, AC-1.3

These tests use an in-memory fake DB so they can run without docker.
A separate integration suite under tests/integration_db/ would exercise
the real Postgres via docker-compose.
"""
from datetime import datetime, timezone
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from profile_service.app.main import create_app
from profile_service.app.db import InMemoryProfileStore
from profile_service.app.dependencies import get_profile_store


@pytest.fixture
def store():
    return InMemoryProfileStore()


@pytest.fixture
def client(store):
    app = create_app()
    app.dependency_overrides[get_profile_store] = lambda: store
    return TestClient(app)


def test_post_profiles_creates_record_and_returns_recovery_token(client):
    uid = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
    resp = client.post("/api/v1/profiles", json={"anonymous_user_id": uid})
    assert resp.status_code == 201
    body = resp.json()
    assert body["anonymous_user_id"] == uid
    # 4-word mnemonic format
    assert body["recovery_token"].count("-") == 3
    assert body["scores"] == {
        "memory": 0, "focus": 0, "logic": 0, "speed": 0, "spatial": 0
    }
    assert body["current_streak"] == 0
    assert body["daily_games_played"] == 0
    assert body["daily_goal"] == 3
    assert body["created_at"] is not None


def test_post_profiles_rejects_malformed_uuid(client):
    resp = client.post("/api/v1/profiles", json={"anonymous_user_id": "invalid-id-123"})
    assert resp.status_code == 400
    err = resp.json()["error"]
    assert err["code"] == "INVALID_PARAMETER"


def test_post_profiles_conflicts_on_duplicate(client):
    uid = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
    client.post("/api/v1/profiles", json={"anonymous_user_id": uid})
    resp = client.post("/api/v1/profiles", json={"anonymous_user_id": uid})
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "DATABASE_CONFLICT"


def test_get_profile_returns_full_state(client):
    uid = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
    client.post("/api/v1/profiles", json={"anonymous_user_id": uid})
    resp = client.get(f"/api/v1/profiles/{uid}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["anonymous_user_id"] == uid
    assert "recovery_token" in body
    assert body["scores"]["memory"] == 0


def test_get_profile_applies_decay_after_72h(client, store):
    uid = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
    client.post("/api/v1/profiles", json={"anonymous_user_id": uid})
    # Simulate a score and a last_active_at 100h ago.
    old = datetime(2026, 6, 23, 0, 0, tzinfo=timezone.utc)
    store.override_profile(uid, {
        "score_memory": 1000,
        "score_focus": 800,
        "score_logic": 0,
        "score_speed": 0,
        "score_spatial": 0,
        "last_active_at": old,
    })
    resp = client.get(f"/api/v1/profiles/{uid}")
    assert resp.status_code == 200
    scores = resp.json()["scores"]
    # 1000 * 0.98 = 980, 800 * 0.98 = 784
    assert scores["memory"] == 980
    assert scores["focus"] == 784


def test_get_profile_404_when_missing(client):
    resp = client.get("/api/v1/profiles/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_post_profiles_restore_returns_user(client):
    uid = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
    create = client.post("/api/v1/profiles", json={"anonymous_user_id": uid})
    token = create.json()["recovery_token"]
    resp = client.post("/api/v1/profiles/restore", json={"recovery_token": token})
    assert resp.status_code == 200
    assert resp.json()["anonymous_user_id"] == uid


def test_post_profiles_restore_404_when_token_unknown(client):
    resp = client.post("/api/v1/profiles/restore", json={"recovery_token": "totally-bogus-token-here"})
    assert resp.status_code == 404


def test_post_profiles_restore_400_when_missing_field(client):
    resp = client.post("/api/v1/profiles/restore", json={})
    assert resp.status_code == 400


def test_delete_profile_204_and_subsequent_get_is_404(client):
    uid = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
    client.post("/api/v1/profiles", json={"anonymous_user_id": uid})
    resp = client.delete(f"/api/v1/profiles/{uid}")
    assert resp.status_code == 204
    resp = client.get(f"/api/v1/profiles/{uid}")
    assert resp.status_code == 404
