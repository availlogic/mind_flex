"""Score decay applied at read time.

Spec: docs/PRD.md §13.1
  - "Scores decay by 2% after 72 hours of inactivity to encourage persistent training."
  - Ratings range from 0 to 1000 (enforced by DB CHECK constraints; we mirror here).
"""
from __future__ import annotations

from typing import Mapping

INACTIVITY_THRESHOLD_MS = 72 * 3600 * 1000
DECAY_FACTOR = 0.98  # 2% decay per inactivity window


def apply_decay(profile: Mapping[str, object], now_ms: int) -> dict:
    """Return a copy of the profile with score_* fields decayed as needed."""
    out = dict(profile)
    last_active_at = profile.get("last_active_at")
    if last_active_at is None:
        return out

    last_ms = _to_ms(last_active_at)
    elapsed_ms = now_ms - last_ms
    if elapsed_ms < INACTIVITY_THRESHOLD_MS:
        return out

    # Number of full 72h windows elapsed. Each window decays 2%.
    windows = elapsed_ms // INACTIVITY_THRESHOLD_MS
    factor = DECAY_FACTOR ** windows

    for key in ("score_memory", "score_focus", "score_logic", "score_speed", "score_spatial"):
        current = int(out.get(key, 0) or 0)
        if current == 0:
            continue
        decayed = int(current * factor)
        if decayed < 0:
            decayed = 0
        out[key] = decayed
    return out


def _to_ms(value) -> int:
    """Coerce a datetime/ISO string/numeric ms value to an integer ms timestamp."""
    if isinstance(value, (int, float)):
        return int(value)
    if hasattr(value, "timestamp"):
        return int(value.timestamp() * 1000)
    if isinstance(value, str):
        from datetime import datetime
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return 0
        return int(dt.timestamp() * 1000)
    return 0
