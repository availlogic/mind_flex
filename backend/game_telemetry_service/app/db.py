"""Storage layer for game telemetry.

Two implementations:
  - InMemoryTelemetryStore: for tests / local dev
  - PostgresTelemetryStore:  production, connects via asyncpg using
                             game_memory_matrix_svc role.
"""
from __future__ import annotations

import json
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

try:
    import asyncpg  # type: ignore
except ImportError:  # pragma: no cover
    asyncpg = None  # type: ignore


class TelemetryStore:
    async def submit_session(self, payload: Dict[str, Any]) -> Dict[str, Any]: ...
    async def lookup_existing_session(self, client_tx_id: str) -> Optional[Dict[str, Any]]: ...


class ProfileLookup:
    """Used by the telemetry service to read the user's current memory score.

    In production this is implemented by calling schema_common.update_memory_score()
    via the SECURE DEFINER procedure and reading back the new rating using the
    game svc role's column-level SELECT permission on user_profiles.
    """

    async def apply_memory_score_and_read(self, user_id: str, game_score: int, tz_offset_minutes: int = 0) -> int: ...
    async def read_full_scores(self, user_id: str) -> Dict[str, int]: ...
    async def read_streak(self, user_id: str) -> int: ...


@dataclass
class InMemoryProfileLookup(ProfileLookup):
    initial_scores: Dict[str, int] = field(default_factory=dict)
    scores: Dict[str, int] = field(default_factory=dict)
    current_streak: int = 0
    last_tz_offset_minutes: Optional[int] = None

    def __post_init__(self):
        base = {"memory": 0, "focus": 0, "logic": 0, "speed": 0, "spatial": 0}
        base.update(self.initial_scores)
        self.scores = base

    async def apply_memory_score_and_read(self, user_id: str, game_score: int, tz_offset_minutes: int = 0) -> int:
        from .services.scoring import compute_memory_rating_delta
        current = self.scores.get("memory", 0)
        new_rating = compute_memory_rating_delta(current=current, game=game_score)
        self.scores["memory"] = new_rating
        self.last_tz_offset_minutes = tz_offset_minutes
        self.current_streak = 1  # Mock updated streak
        return new_rating

    async def read_full_scores(self, user_id: str) -> Dict[str, int]:
        return dict(self.scores)

    async def read_streak(self, user_id: str) -> int:
        return self.current_streak


@dataclass
class InMemoryTelemetryStore(TelemetryStore):
    sessions: List[Dict[str, Any]] = field(default_factory=list)
    clicks: List[Dict[str, Any]] = field(default_factory=list)
    inject_clicks_failure: bool = False

    async def submit_session(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        if await self.lookup_existing_session(payload["client_tx_id"]):
            # Idempotent return: re-read previous session.
            existing = await self.lookup_existing_session(payload["client_tx_id"])
            return existing  # type: ignore[return-value]

        session_id = str(uuid.uuid4())
        session = {
            "session_id": session_id,
            "anonymous_user_id": payload["anonymous_user_id"],
            "score": payload["score"],
            # Convert proportion (0..1) -> percentage (0..100) per conflict C1.
            "accuracy": float(payload["accuracy"]) * 100.0,
            "avg_response_time_ms": payload["responseTimeMs"],
            "rounds_completed": payload["roundsCompleted"],
            "client_tx_id": payload["client_tx_id"],
            "created_at": datetime.now(timezone.utc),
        }

        if self.inject_clicks_failure:
            # Simulate the DB failing during click insert; we MUST not
            # have added the session yet.
            raise RuntimeError("simulated click insert failure")

        # Click insert path (would normally be inside a Postgres transaction
        # with the session insert).
        for click in payload.get("rawMetrics", {}).get("clicks", []):
            self.clicks.append({
                "session_id": session_id,
                "round_number": click["roundNumber"],
                "click_sequence": click["clickSequence"],
                "is_correct": click["isCorrect"],
                "latency_ms": click["latencyMs"],
            })

        self.sessions.append(session)
        return session

    async def lookup_existing_session(self, client_tx_id: str) -> Optional[Dict[str, Any]]:
        for s in self.sessions:
            if s["client_tx_id"] == client_tx_id:
                return s
        return None


def build_telemetry_store_from_env() -> TelemetryStore:
    if os.environ.get("MINDFLEX_DB_HOST"):
        return PostgresTelemetryStore(
            host=os.environ["MINDFLEX_DB_HOST"],
            port=int(os.environ.get("MINDFLEX_DB_PORT", "5432")),
            database=os.environ.get("MINDFLEX_DB_NAME", "mindflex"),
            user=os.environ["MINDFLEX_DB_USER"],
            password=os.environ["MINDFLEX_DB_PASSWORD"],
        )
    return InMemoryTelemetryStore()


def build_profile_lookup_from_env() -> ProfileLookup:
    if os.environ.get("MINDFLEX_DB_HOST"):
        return PostgresProfileLookup(
            host=os.environ["MINDFLEX_DB_HOST"],
            port=int(os.environ.get("MINDFLEX_DB_PORT", "5432")),
            database=os.environ.get("MINDFLEX_DB_NAME", "mindflex"),
            user=os.environ["MINDFLEX_DB_USER"],
            password=os.environ["MINDFLEX_DB_PASSWORD"],
        )
    return InMemoryProfileLookup(initial_scores={"memory": 0, "focus": 0, "logic": 0,
                                                 "speed": 0, "spatial": 0})


class PostgresTelemetryStore(TelemetryStore):
    def __init__(self, host: str, port: int, database: str, user: str, password: str) -> None:
        if asyncpg is None:
            raise RuntimeError("asyncpg is required for PostgresTelemetryStore")
        self._dsn = f"postgresql://{user}:{password}@{host}:{port}/{database}"
        self._pool: Optional[asyncpg.Pool] = None

    async def connect(self) -> None:
        self._pool = await asyncpg.create_pool(self._dsn, min_size=1, max_size=5)

    async def close(self) -> None:
        if self._pool:
            await self._pool.close()

    async def submit_session(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        async with self._pool.acquire() as conn:  # type: ignore[union-attr]
            async with conn.transaction():
                existing = await conn.fetchrow(
                    """
                    SELECT * FROM schema_memory_matrix.game_sessions
                    WHERE client_tx_id = $1
                    """,
                    payload["client_tx_id"],
                )
                if existing:
                    return dict(existing)
                row = await conn.fetchrow(
                    """
                    INSERT INTO schema_memory_matrix.game_sessions
                      (anonymous_user_id, score, accuracy,
                       avg_response_time_ms, rounds_completed, client_tx_id)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING *
                    """,
                    uuid.UUID(payload["anonymous_user_id"]),
                    payload["score"],
                    float(payload["accuracy"]) * 100.0,
                    payload["responseTimeMs"],
                    payload["roundsCompleted"],
                    uuid.UUID(payload["client_tx_id"]),
                )
                session_id = row["session_id"]
                clicks = payload.get("rawMetrics", {}).get("clicks", [])
                if clicks:
                    await conn.executemany(
                        """
                        INSERT INTO schema_memory_matrix.game_clicks
                          (session_id, round_number, click_sequence, is_correct, latency_ms)
                        VALUES ($1, $2, $3, $4, $5)
                        """,
                        [
                            (
                                session_id,
                                c["roundNumber"],
                                c["clickSequence"],
                                c["isCorrect"],
                                c["latencyMs"],
                            )
                            for c in clicks
                        ],
                    )
                return dict(row)

    async def lookup_existing_session(self, client_tx_id: str) -> Optional[Dict[str, Any]]:
        async with self._pool.acquire() as conn:  # type: ignore[union-attr]
            row = await conn.fetchrow(
                """
                SELECT * FROM schema_memory_matrix.game_sessions
                WHERE client_tx_id = $1
                """,
                uuid.UUID(client_tx_id),
            )
            return dict(row) if row else None


class PostgresProfileLookup(ProfileLookup):
    def __init__(self, host: str, port: int, database: str, user: str, password: str) -> None:
        if asyncpg is None:
            raise RuntimeError("asyncpg is required for PostgresProfileLookup")
        self._dsn = f"postgresql://{user}:{password}@{host}:{port}/{database}"
        self._pool: Optional[asyncpg.Pool] = None

    async def connect(self) -> None:
        self._pool = await asyncpg.create_pool(self._dsn, min_size=1, max_size=5)

    async def close(self) -> None:
        if self._pool:
            await self._pool.close()

    async def apply_memory_score_and_read(self, user_id: str, game_score: int, tz_offset_minutes: int = 0) -> int:
        async with self._pool.acquire() as conn:  # type: ignore[union-attr]
            await conn.execute(
                "SELECT schema_common.update_memory_score($1, $2, $3)",
                uuid.UUID(user_id),
                game_score,
                tz_offset_minutes,
            )
            row = await conn.fetchrow(
                """
                SELECT score_memory FROM schema_common.user_profiles
                WHERE anonymous_user_id = $1
                """,
                uuid.UUID(user_id),
            )
            return int(row["score_memory"]) if row else 0

    async def read_full_scores(self, user_id: str) -> Dict[str, int]:
        async with self._pool.acquire() as conn:  # type: ignore[union-attr]
            row = await conn.fetchrow(
                """
                SELECT score_memory, score_focus, score_logic, score_speed, score_spatial
                FROM schema_common.user_profiles
                WHERE anonymous_user_id = $1
                """,
                uuid.UUID(user_id),
            )
            if row is None:
                return {"memory": 0, "focus": 0, "logic": 0, "speed": 0, "spatial": 0}
            return {
                "memory": row["score_memory"],
                "focus": row["score_focus"],
                "logic": row["score_logic"],
                "speed": row["score_speed"],
                "spatial": row["score_spatial"],
            }

    async def read_streak(self, user_id: str) -> int:
        async with self._pool.acquire() as conn:  # type: ignore[union-attr]
            row = await conn.fetchrow(
                """
                SELECT current_streak FROM schema_common.user_profiles
                WHERE anonymous_user_id = $1
                """,
                uuid.UUID(user_id),
            )
            return int(row["current_streak"]) if row else 0
