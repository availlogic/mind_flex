"""Scoring math, mirroring the SECURE DEFINER stored procedure.

Stored procedure (docs/Database.md §5.3):
    rating_increment := (new_game_score - current_rating) / 10
    clamp to [0, 1000]
"""
from __future__ import annotations


def compute_memory_rating_delta(
    *, current: int, game: int, upper: int = 1000, lower: int = 0
) -> int:
    delta = (game - current) // 10
    new_rating = current + delta
    if new_rating > upper:
        return upper
    if new_rating < lower:
        return lower
    return new_rating
