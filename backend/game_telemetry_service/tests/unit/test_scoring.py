"""Unit tests for the scoring service.

Stored procedure (docs/Database.md §5.3):
    rating_increment := (new_game_score - current_rating) / 10
    new_rating := clamp(current_rating + rating_increment, 0, 1000)
"""
import pytest

from game_telemetry_service.app.services.scoring import compute_memory_rating_delta


def test_new_rating_applies_one_tenth_increment():
    # (850-500)/10 = 35; new = 500 + 35 = 535
    assert compute_memory_rating_delta(current=500, game=850) == 535


def test_new_rating_can_decrease():
    # (600-800)/10 = -20; new = 800 - 20 = 780
    assert compute_memory_rating_delta(current=800, game=600) == 780


def test_new_rating_clamps_to_upper_bound():
    # delta would push to 650, well under 1000 -> not clamped.
    new = compute_memory_rating_delta(current=500, game=2000, upper=1000, lower=0)
    assert new == 650


def test_new_rating_clamps_to_lower_bound():
    new = compute_memory_rating_delta(current=100, game=-1000, upper=1000, lower=0)
    assert new == 0


def test_new_rating_clamps_to_zero_when_negative_increment_is_large():
    new = compute_memory_rating_delta(current=50, game=-5000, upper=1000, lower=0)
    assert new == 0


def test_new_rating_zero_when_equal_and_zero():
    assert compute_memory_rating_delta(current=0, game=0) == 0
