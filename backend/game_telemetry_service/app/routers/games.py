"""Game-telemetry-service HTTP routes.

Spec: docs/API_Spec.md §2.3
  POST /games/{game_name}/submit
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, status, Header
from fastapi.responses import JSONResponse

from ..db import ProfileLookup, TelemetryStore
from ..dependencies import get_profile_lookup, get_telemetry_store
from ..schemas import (
    SubmitGameRequest,
    SubmitGameResponse,
    UpdatedScores,
    UnlockedBadge,
)
from ..services.anti_cheat import OutOfBoundsError, validate_score_payload


router = APIRouter(prefix="/api/v1/games")


def _err(status_code: int, code: str, message: str, details: Dict[str, Any] | None = None) -> HTTPException:
    payload = {"error": {"code": code, "message": message, "details": details or {}}}
    return HTTPException(status_code=status_code, detail=payload)


@router.post("/{game_name}/submit")
async def submit_game(
    game_name: str = Path(...),
    payload: SubmitGameRequest = ...,
    x_client_timezone_offset: str | None = Header(None, alias="X-Client-Timezone-Offset"),
    store: TelemetryStore = Depends(get_telemetry_store),
    profile_lookup: ProfileLookup = Depends(get_profile_lookup),
):
    # Validate game name string to prevent basic SQL injection
    import re
    if not re.match(r"^[a-zA-Z0-9_-]+$", game_name):
        raise _err(
            status.HTTP_400_BAD_REQUEST,
            "INVALID_PARAMETER",
            f"Invalid game name format: '{game_name}'. Must be alphanumeric with hyphens or underscores.",
            {"game_name": game_name},
        )

    category = payload.category
    if category not in {"memory", "focus", "logic", "speed", "spatial"}:
        raise _err(
            status.HTTP_400_BAD_REQUEST,
            "INVALID_PARAMETER",
            f"Invalid game category '{category}'. Must be one of memory, focus, logic, speed, spatial.",
            {"category": category},
        )

    try:
        validate_score_payload(payload)
    except OutOfBoundsError as exc:
        raise _err(
            status.HTTP_400_BAD_REQUEST,
            "OUT_OF_BOUNDS_SCORE",
            str(exc),
            {"anonymous_user_id": payload.anonymous_user_id, "game_name": game_name},
        )

    try:
        user_id = UUID(payload.anonymous_user_id)
    except ValueError:
        raise _err(
            status.HTTP_400_BAD_REQUEST,
            "INVALID_PARAMETER",
            "anonymous_user_id must be a valid UUID",
            {"anonymous_user_id": payload.anonymous_user_id},
        )

    # Parse timezone offset
    tz_offset = 0
    if x_client_timezone_offset is not None:
        try:
            tz_offset = int(x_client_timezone_offset)
        except ValueError:
            pass
        if tz_offset < -14 * 60 or tz_offset > 14 * 60:
            tz_offset = 0

    # 1) Persist session atomically (transaction in store impl).
    was_new = True
    payload_dict = payload.model_dump()
    payload_dict["game_id"] = game_name
    try:
        existing = await store.lookup_existing_session(payload.client_tx_id)
        if existing is not None:
            was_new = False
        else:
            await store.submit_session(payload_dict)
    except Exception as exc:  # surface as 500 with INTERNAL_SERVER_ERROR
        raise _err(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "INTERNAL_SERVER_ERROR",
            f"Failed to persist telemetry: {exc}",
            {"game_name": game_name, "client_tx_id": payload.client_tx_id},
        )

    # 2) Invoke the SECURE DEFINER score procedure (or fallback).
    if was_new:
        await profile_lookup.apply_user_score_and_read(
            str(user_id), payload.score, category, tz_offset
        )

    # 3) Read back the full score vector for the response payload.
    scores = await profile_lookup.read_full_scores(str(user_id))
    current_streak = await profile_lookup.read_streak(str(user_id))

    new_score = scores.get(category, 0)
    badge_unlocked = new_score >= 800 and payload.score >= 800
    unlocked_badges: List[UnlockedBadge] = []
    if badge_unlocked:
        unlocked_badges.append(
            UnlockedBadge(
                badge_type=f"{category.upper()}_SPEED_DEMON",
                unlocked_at=datetime.now(timezone.utc).isoformat(),
            )
        )

    response = SubmitGameResponse(
        status="success",
        updatedScores=UpdatedScores(**scores),
        newBadgeUnlocked=badge_unlocked,
        unlockedBadges=unlocked_badges,
        current_streak=current_streak,
    )
    return JSONResponse(status_code=200, content=response.model_dump())

