"""Unit tests for streak calculation.

Spec source:
  - docs/Test-Strategy.md AUD-02 (MEDIUM):
      "Define streak increments as calendar-day boundaries based on the
       client's timezone offset transmitted in the payload header."

The streak:
  - Increments when the user plays a game on a NEW calendar day in their
    local timezone.
  - Resets to 1 when the user plays again after >= 2 days have elapsed
    (a missed day breaks the streak).
  - Stays the same when the user plays again on the same calendar day.
"""
from datetime import datetime, timezone, timedelta

from profile_service.app.services.streak import compute_streak_after_play


def _client_local_yesterday(tz_offset_minutes):
    return datetime.now(timezone(timedelta(minutes=tz_offset_minutes)))


def test_first_play_sets_streak_to_one():
    new_streak, new_date = compute_streak_after_play(
        previous_streak=0,
        previous_date=None,
        client_tz_offset_minutes=0,
        now_utc=datetime(2026, 6, 27, 12, 0, tzinfo=timezone.utc),
    )
    assert new_streak == 1


def test_same_day_play_keeps_streak():
    # First play earlier today UTC.
    today_local = datetime(2026, 6, 27, 8, 0, tzinfo=timezone(timedelta(minutes=0)))
    new_streak, _ = compute_streak_after_play(
        previous_streak=4,
        previous_date=today_local.date(),
        client_tz_offset_minutes=0,
        now_utc=datetime(2026, 6, 27, 20, 0, tzinfo=timezone.utc),
    )
    assert new_streak == 4


def test_consecutive_day_increments_streak():
    yesterday_local = datetime(2026, 6, 26, 22, 0, tzinfo=timezone(timedelta(minutes=0)))
    new_streak, _ = compute_streak_after_play(
        previous_streak=4,
        previous_date=yesterday_local.date(),
        client_tz_offset_minutes=0,
        now_utc=datetime(2026, 6, 27, 12, 0, tzinfo=timezone.utc),
    )
    assert new_streak == 5


def test_skipped_day_resets_to_one():
    three_days_ago = datetime(2026, 6, 24, 12, 0, tzinfo=timezone(timedelta(minutes=0)))
    new_streak, _ = compute_streak_after_play(
        previous_streak=10,
        previous_date=three_days_ago.date(),
        client_tz_offset_minutes=0,
        now_utc=datetime(2026, 6, 27, 12, 0, tzinfo=timezone.utc),
    )
    assert new_streak == 1


def test_timezone_offset_shifts_calendar_day():
    # Client is UTC+8 (480 min). At UTC 2026-06-27 00:30 their local date
    # is 2026-06-27 already (08:30 local), while previous play was stored
    # as 2026-06-26 local date. Consecutive -> increment.
    yesterday_local = datetime(2026, 6, 26, 23, 30, tzinfo=timezone(timedelta(minutes=480)))
    new_streak, _ = compute_streak_after_play(
        previous_streak=2,
        previous_date=yesterday_local.date(),
        client_tz_offset_minutes=480,
        now_utc=datetime(2026, 6, 27, 0, 30, tzinfo=timezone.utc),
    )
    assert new_streak == 3
