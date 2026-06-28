"""Profile service HTTP routes.

Spec: docs/API_Spec.md §2 (Endpoints)
  - POST   /profiles
  - GET    /profiles/{anonymous_user_id}
  - DELETE /profiles/{anonymous_user_id}
  - POST   /profiles/restore
"""
from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Request, status
from fastapi.responses import JSONResponse

from ..db import ProfileConflictError, ProfileNotFoundError, ProfileStore
from ..dependencies import get_profile_store
from ..schemas import (
    BadgePayload,
    CreateProfileRequest,
    ProfileResponse,
    RestoreRequest,
    ScoresPayload,
)
from ..services.recovery_token import (
    generate_recovery_token,
    is_valid_format,
)
from ..services.score_decay import apply_decay

router = APIRouter(prefix="/api/v1/profiles")


def _tz_offset_minutes(value: str | None) -> int:
    """Parse X-Client-Timezone-Offset (minutes). Default 0 (UTC)."""
    if value is None:
        return 0
    try:
        v = int(value)
    except ValueError:
        return 0
    # Bound to +/- 14h to keep tests sane and to avoid overflow on day math.
    if v < -14 * 60 or v > 14 * 60:
        return 0
    return v


def _serialize_profile(record: Dict[str, Any], badges: List[Dict[str, Any]] | None = None) -> ProfileResponse:
    badges = badges or []
    return ProfileResponse(
        anonymous_user_id=str(record["anonymous_user_id"]),
        recovery_token=record["recovery_token"],
        scores=ScoresPayload(
            memory=record.get("score_memory", 0),
            focus=record.get("score_focus", 0),
            logic=record.get("score_logic", 0),
            speed=record.get("score_speed", 0),
            spatial=record.get("score_spatial", 0),
        ),
        current_streak=record.get("current_streak", 0),
        daily_games_played=record.get("daily_games_played", 0),
        daily_goal=record.get("daily_goal", 3),
        badges=[
            BadgePayload(
                badge_id=str(b["badge_id"]),
                badge_type=b["badge_type"],
                unlocked_at=b["unlocked_at"],
            )
            for b in badges
        ],
        last_active_at=record.get("last_active_at"),
        created_at=record["created_at"],
    )


def _err(status_code: int, code: str, message: str, details: Dict[str, Any] | None = None) -> HTTPException:
    payload = {"error": {"code": code, "message": message, "details": details or {}}}
    return HTTPException(status_code=status_code, detail=payload)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_profile(
    payload: CreateProfileRequest,
    store: ProfileStore = Depends(get_profile_store),
):
    user_id = UUID(payload.anonymous_user_id)
    token = generate_recovery_token()
    try:
        record = await store.create_profile(user_id, token)
    except ProfileConflictError:
        raise _err(
            status.HTTP_409_CONFLICT,
            "DATABASE_CONFLICT",
            "Anonymous user ID is already registered.",
            {"anonymous_user_id": payload.anonymous_user_id},
        )
    badges = await store.list_badges(user_id)
    return JSONResponse(status_code=status.HTTP_201_CREATED,
                        content=_serialize_profile(record, badges).model_dump(mode="json"))


@router.get("/{anonymous_user_id}")
async def get_profile(
    anonymous_user_id: str = Path(...),
    store: ProfileStore = Depends(get_profile_store),
):
    try:
        user_id = UUID(anonymous_user_id)
    except ValueError:
        raise _err(status.HTTP_400_BAD_REQUEST, "INVALID_PARAMETER",
                   "anonymous_user_id must be a valid UUID",
                   {"anonymous_user_id": anonymous_user_id})

    record = await store.get_profile(user_id)
    if record is None:
        raise _err(status.HTTP_404_NOT_FOUND, "RESOURCE_NOT_FOUND",
                   "Profile not found",
                   {"anonymous_user_id": anonymous_user_id})

    # Apply read-time 2%/72h decay (PRD §13.1)
    record = apply_decay(record, now_ms=int(time.time() * 1000))
    badges = await store.list_badges(user_id)
    return _serialize_profile(record, badges).model_dump(mode="json")


@router.delete("/{anonymous_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(
    anonymous_user_id: str,
    store: ProfileStore = Depends(get_profile_store),
):
    try:
        user_id = UUID(anonymous_user_id)
    except ValueError:
        raise _err(status.HTTP_400_BAD_REQUEST, "INVALID_PARAMETER",
                   "anonymous_user_id must be a valid UUID",
                   {"anonymous_user_id": anonymous_user_id})
    deleted = await store.delete_profile(user_id)
    if not deleted:
        raise _err(status.HTTP_404_NOT_FOUND, "RESOURCE_NOT_FOUND",
                   "Profile not found",
                   {"anonymous_user_id": anonymous_user_id})
    return JSONResponse(status_code=status.HTTP_204_NO_CONTENT, content=None)


@router.post("/restore")
async def restore_profile(
    payload: RestoreRequest,
    store: ProfileStore = Depends(get_profile_store),
):
    if not is_valid_format(payload.recovery_token):
        raise _err(status.HTTP_400_BAD_REQUEST, "INVALID_PARAMETER",
                   "Invalid recovery token format. Must be 4 dash-separated words.")
    record = await store.get_by_recovery_token(payload.recovery_token)
    if record is None:
        raise _err(status.HTTP_404_NOT_FOUND, "RESOURCE_NOT_FOUND",
                   "Invalid recovery token")
    badges = await store.list_badges(UUID(str(record["anonymous_user_id"])))
    return _serialize_profile(record, badges).model_dump(mode="json")
