"""Anti-cheat scoring bounds.

Spec: docs/PRD.md §17 risk row
       "Discard scores that exceed realistic human limits (e.g., reaction
        times under 100ms)."
Spec: docs/Integration-Test-Cases.md IT-AFC-02
       "Submit a game session with values exceeding anti-cheat parameters
        (e.g., response latency of 5ms or accuracy of 150.00%)."
Spec: docs/Database.md §3.1
       score 0..1000, accuracy 0.00..100.00, response_time >=0, rounds >=0.
"""
from __future__ import annotations

from ..schemas import SubmitGameRequest


MIN_HUMAN_REACTION_MS = 100  # < 100ms is treated as robotic
MIN_SCORE = 0
MAX_SCORE = 1000


class OutOfBoundsError(ValueError):
    """Raised when a submitted score violates anti-cheat bounds."""


def validate_score_payload(payload: SubmitGameRequest) -> None:
    if not (MIN_SCORE <= payload.score <= MAX_SCORE):
        raise OutOfBoundsError(
            f"score {payload.score} out of bounds [{MIN_SCORE}, {MAX_SCORE}]"
        )
    if payload.accuracy < 0.0 or payload.accuracy > 1.0:
        raise OutOfBoundsError(
            f"accuracy {payload.accuracy} out of bounds [0.0, 1.0]"
        )
    if payload.responseTimeMs < MIN_HUMAN_REACTION_MS:
        raise OutOfBoundsError(
            f"responseTimeMs {payload.responseTimeMs} below human minimum "
            f"{MIN_HUMAN_REACTION_MS}"
        )
