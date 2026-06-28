"""Streak calculation resolved per client timezone (AUD-02).

Spec:
  - docs/Test-Strategy.md AUD-02 (MEDIUM):
    "Define streak increments as calendar-day boundaries based on the
     client's timezone offset transmitted in the payload header."

Behavior:
  - First play ever         -> streak becomes 1
  - Same calendar day       -> streak unchanged
  - Next calendar day       -> streak + 1
  - Gap of 2+ days          -> streak resets to 1
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional, Tuple


def _local_date(now_utc: datetime, tz_offset_minutes: int) -> date:
    offset = timedelta(minutes=tz_offset_minutes)
    local = now_utc.astimezone(timezone(offset))
    return local.date()


def compute_streak_after_play(
    *,
    previous_streak: int,
    previous_date: Optional[date],
    client_tz_offset_minutes: int,
    now_utc: datetime,
) -> Tuple[int, date]:
    """Compute the new streak value and the local calendar date of the play."""
    today = _local_date(now_utc, client_tz_offset_minutes)
    if previous_date is None:
        return 1, today
    if previous_date == today:
        return max(1, previous_streak), today
    delta_days = (today - previous_date).days
    if delta_days == 1:
        return previous_streak + 1, today
    # delta_days >= 2 or delta_days == 0 (already handled) -> streak broken
    return 1, today
