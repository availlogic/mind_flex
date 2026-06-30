"""Integration tests for game-telemetry-service API.

Spec coverage:
  - docs/Functional-Test-Cases.md   FT-SSB-01 (game submission contract)
  - docs/Integration-Test-Cases.md  IT-AFC-02 (out-of-bounds & unknown game)
  - docs/Integration-Test-Cases.md  IT-ADB-01 (rollback on click insert failure)
  - docs/Acceptance-Criteria.md      AC-3.4, AC-4.1, AC-4.2, AC-4.3
"""
import os
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

os.environ.pop("MINDFLEX_DB_HOST", None)

from game_telemetry_service.app.main import create_app
from game_telemetry_service.app.db import (
    InMemoryTelemetryStore,
    InMemoryProfileLookup,
)
from game_telemetry_service.app.dependencies import (
    get_telemetry_store,
    get_profile_lookup,
)
from game_telemetry_service.app.services.scoring import compute_memory_rating_delta


@pytest.fixture
def store():
    return InMemoryTelemetryStore()


@pytest.fixture
def profile_lookup():
    return InMemoryProfileLookup(initial_scores={"memory": 500})


@pytest.fixture
def client(store, profile_lookup):
    app = create_app()
    app.dependency_overrides[get_telemetry_store] = lambda: store
    app.dependency_overrides[get_profile_lookup] = lambda: profile_lookup
    return TestClient(app)


def _payload(**overrides):
    base = {
        "anonymous_user_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "score": 850,
        "accuracy": 0.94,
        "responseTimeMs": 312,
        "roundsCompleted": 8,
        "client_tx_id": "11111111-2222-3333-4444-555555555555",
        "rawMetrics": {
            "clicks": [
                {"roundNumber": 1, "clickSequence": 1, "isCorrect": True, "latencyMs": 140},
                {"roundNumber": 1, "clickSequence": 2, "isCorrect": True, "latencyMs": 220},
            ]
        },
    }
    base.update(overrides)
    return base


def test_submit_returns_200_and_updated_scores(client):
    resp = client.post("/api/v1/games/flashmatrix/submit", json=_payload())
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "success"
    assert "updatedScores" in body
    # delta = (850 - 500) / 10 = 35 -> memory = 535
    assert body["updatedScores"]["memory"] == 535
    assert "current_streak" in body


def test_submit_unknown_game_returns_404(client):
    resp = client.post("/api/v1/games/nonexistentgame/submit", json=_payload())
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_submit_out_of_bounds_score_returns_400(client):
    resp = client.post("/api/v1/games/flashmatrix/submit",
                       json=_payload(score=1001))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "OUT_OF_BOUNDS_SCORE"


def test_submit_out_of_bounds_accuracy_returns_400(client):
    resp = client.post("/api/v1/games/flashmatrix/submit",
                       json=_payload(accuracy=150.0))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "OUT_OF_BOUNDS_SCORE"


def test_submit_under_min_reaction_time_returns_400(client):
    resp = client.post("/api/v1/games/flashmatrix/submit",
                       json=_payload(responseTimeMs=5))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "OUT_OF_BOUNDS_SCORE"


def test_submit_idempotent_on_duplicate_client_tx_id(client, store):
    p = _payload()
    client.post("/api/v1/games/flashmatrix/submit", json=p)
    # Second submit with same client_tx_id should not duplicate.
    resp = client.post("/api/v1/games/flashmatrix/submit", json=p)
    assert resp.status_code == 200
    assert len(store.sessions) == 1


def test_submit_missing_client_tx_id_returns_400(client):
    p = _payload()
    p.pop("client_tx_id")
    resp = client.post("/api/v1/games/flashmatrix/submit", json=p)
    assert resp.status_code == 400


def test_submit_invalid_uuid_returns_400(client):
    resp = client.post("/api/v1/games/flashmatrix/submit",
                       json=_payload(anonymous_user_id="bad"))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_PARAMETER"


def test_submit_rolls_back_when_clicks_invalid(client, store):
    # Inject a click with a None latency to force a DB constraint failure.
    bad = _payload()
    bad["rawMetrics"]["clicks"] = [{"roundNumber": 1, "clickSequence": 1,
                                    "isCorrect": True, "latencyMs": None}]
    resp = client.post("/api/v1/games/flashmatrix/submit", json=bad)
    # Pydantic catches the null latency at the schema level -> 400.
    assert resp.status_code == 400
    # Verify no session leaked into the store
    assert len(store.sessions) == 0


def test_submit_rolls_back_when_store_raises_during_click_insert(client, store, profile_lookup):
    # Force a runtime failure in the click insert path so we exercise
    # transaction rollback in InMemoryTelemetryStore.
    store.inject_clicks_failure = True
    resp = client.post("/api/v1/games/flashmatrix/submit", json=_payload())
    assert resp.status_code in (400, 500)
    # The session was never persisted.
    assert len(store.sessions) == 0
    # The profile memory score must NOT have been mutated.
    assert profile_lookup.scores.get("memory") == 500


def test_submit_passes_timezone_offset_header(client, profile_lookup):
    headers = {"X-Client-Timezone-Offset": "480"}
    resp = client.post("/api/v1/games/flashmatrix/submit", json=_payload(), headers=headers)
    assert resp.status_code == 200
    assert profile_lookup.last_tz_offset_minutes == 480
    assert resp.json()["current_streak"] == 1
