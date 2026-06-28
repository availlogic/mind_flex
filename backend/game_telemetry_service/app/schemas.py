"""Pydantic schemas for the game-telemetry-service API."""
from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class ClickPayload(BaseModel):
    roundNumber: int = Field(ge=1)
    clickSequence: int = Field(ge=1)
    isCorrect: bool
    latencyMs: int = Field(ge=0)


class RawMetrics(BaseModel):
    clicks: List[ClickPayload] = Field(default_factory=list)


class SubmitGameRequest(BaseModel):
    anonymous_user_id: str
    score: int = Field(ge=0)
    accuracy: float = Field(ge=0.0)
    responseTimeMs: int = Field(ge=0)
    roundsCompleted: int = Field(ge=0)
    client_tx_id: str
    rawMetrics: RawMetrics = Field(default_factory=RawMetrics)

    @field_validator("anonymous_user_id", "client_tx_id")
    @classmethod
    def _validate_uuid(cls, v: str) -> str:
        try:
            UUID(v)
        except (TypeError, ValueError) as exc:
            raise ValueError("must be a valid UUID") from exc
        return v


class UpdatedScores(BaseModel):
    memory: int
    focus: int
    logic: int
    speed: int
    spatial: int


class UnlockedBadge(BaseModel):
    badge_type: str
    unlocked_at: str


class SubmitGameResponse(BaseModel):
    status: str
    updatedScores: UpdatedScores
    newBadgeUnlocked: bool
    unlockedBadges: List[UnlockedBadge]
    current_streak: int


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    error: ErrorDetail
