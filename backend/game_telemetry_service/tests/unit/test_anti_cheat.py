"""Unit tests for anti-cheat scoring bounds.

Spec: docs/Integration-Test-Cases.md IT-AFC-02
  - latency of 5ms or accuracy of 150% should be flagged.
  - Returns 400 with code OUT_OF_BOUNDS_SCORE.

Spec: docs/Acceptance-Criteria.md AC-4.3
  - Scores must be capped between 0 and 1000.

Spec: docs/PRD.md §17 (Risk: Cheat / Score Forgery):
  - "Discard scores that exceed realistic human limits (e.g., reaction times
    under 100ms)."
"""
import pytest

from game_telemetry_service.app.services.anti_cheat import (
    MIN_HUMAN_REACTION_MS,
    validate_score_payload,
)
from game_telemetry_service.app.schemas import SubmitGameRequest


def _payload(**overrides):
    base = {
        "anonymous_user_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "score": 850,
        "accuracy": 0.94,
        "responseTimeMs": 312,
        "roundsCompleted": 8,
        "client_tx_id": "11111111-2222-3333-4444-555555555555",
        "rawMetrics": {"clicks": []},
    }
    base.update(overrides)
    return SubmitGameRequest(**base)


def test_validate_accepts_a_normal_payload():
    validate_score_payload(_payload())  # no exception


def test_validate_rejects_negative_score():
    with pytest.raises(ValueError):
        validate_score_payload(_payload(score=-1))


def test_validate_rejects_score_above_one_thousand():
    with pytest.raises(ValueError):
        validate_score_payload(_payload(score=1001))


def test_validate_rejects_accuracy_above_one():
    with pytest.raises(ValueError):
        validate_score_payload(_payload(accuracy=1.5))


def test_validate_rejects_accuracy_below_zero():
    with pytest.raises(ValueError):
        validate_score_payload(_payload(accuracy=-0.1))


def test_validate_rejects_response_time_under_100ms():
    with pytest.raises(ValueError):
        validate_score_payload(_payload(responseTimeMs=MIN_HUMAN_REACTION_MS - 1))


def test_validate_rejects_invalid_uuid():
    with pytest.raises(ValueError):
        validate_score_payload(_payload(anonymous_user_id="not-a-uuid"))


def test_validate_rejects_missing_client_tx_id():
    with pytest.raises(ValueError):
        validate_score_payload(_payload(client_tx_id="not-a-uuid"))
