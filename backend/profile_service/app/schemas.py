"""Pydantic schemas for the profile-service API."""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class CreateProfileRequest(BaseModel):
    anonymous_user_id: str

    @field_validator("anonymous_user_id")
    @classmethod
    def _validate_uuid(cls, v: str) -> str:
        try:
            UUID(v)
        except (TypeError, ValueError) as exc:
            raise ValueError("anonymous_user_id must be a valid UUID") from exc
        return v


class ScoresPayload(BaseModel):
    memory: int
    focus: int
    logic: int
    speed: int
    spatial: int


class BadgePayload(BaseModel):
    badge_id: str
    badge_type: str
    unlocked_at: datetime


class ProfileResponse(BaseModel):
    anonymous_user_id: str
    recovery_token: str
    scores: ScoresPayload
    current_streak: int
    daily_games_played: int
    daily_goal: int
    badges: list[BadgePayload] = Field(default_factory=list)
    last_active_at: Optional[datetime] = None
    created_at: datetime


class RestoreRequest(BaseModel):
    recovery_token: str

    @field_validator("recovery_token")
    @classmethod
    def _validate(cls, v: str) -> str:
        from .services.recovery_token import is_valid_format

        if not is_valid_format(v):
            raise ValueError(
                "Invalid token format. Must be 4 dash-separated words."
            )
        return v


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    error: ErrorDetail
