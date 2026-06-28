"""Unit tests for score decay calculation.

Spec source:
  - docs/PRD.md §13.1: "Scores decay by 2% after 72 hours of inactivity"
"""
import pytest

from profile_service.app.services.score_decay import apply_decay


def _profile(score_memory=0, score_focus=0, score_logic=0,
             score_speed=0, score_spatial=0, last_active_at=None):
    return {
        "score_memory": score_memory,
        "score_focus": score_focus,
        "score_logic": score_logic,
        "score_speed": score_speed,
        "score_spatial": score_spatial,
        "last_active_at": last_active_at,
    }


def test_apply_decay_is_noop_when_no_last_active():
    p = _profile(score_memory=500, last_active_at=None)
    out = apply_decay(p, now_ms=1_700_000_000_000)
    assert out["score_memory"] == 500


def test_apply_decay_is_noop_within_72h():
    p = _profile(score_memory=500, last_active_at=1_700_000_000_000)
    now = 1_700_000_000_000 + (71 * 3600 * 1000)  # +71h
    out = apply_decay(p, now_ms=now)
    assert out["score_memory"] == 500


def test_apply_decay_at_72h_applies_2_percent_decay():
    p = _profile(score_memory=1000, last_active_at=1_700_000_000_000)
    now = 1_700_000_000_000 + (72 * 3600 * 1000)
    out = apply_decay(p, now_ms=now)
    assert out["score_memory"] == 980


def test_apply_decay_caps_at_zero_after_extended_inactivity():
    # 5 / 0.02 = 250 windows * 72h = 18000h to floor to 0 via integer decay.
    p = _profile(score_memory=5, last_active_at=1_700_000_000_000)
    now = 1_700_000_000_000 + (20_000 * 3600 * 1000)
    out = apply_decay(p, now_ms=now)
    assert out["score_memory"] == 0


def test_apply_decay_only_affects_dimensions_with_a_score():
    p = _profile(score_memory=600, score_focus=400, score_logic=0,
                 score_speed=0, score_spatial=0,
                 last_active_at=1_700_000_000_000)
    now = 1_700_000_000_000 + (72 * 3600 * 1000)
    out = apply_decay(p, now_ms=now)
    assert out["score_memory"] == 588  # 600 * 0.98
    assert out["score_focus"] == 392   # 400 * 0.98
    assert out["score_logic"] == 0
    assert out["score_speed"] == 0
    assert out["score_spatial"] == 0
