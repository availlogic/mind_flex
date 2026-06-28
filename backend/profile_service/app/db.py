"""Storage-layer abstraction.

Two implementations:
  - InMemoryProfileStore: used by tests / local dev
  - PostgresProfileStore: production, connects via asyncpg using common_svc role
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

try:
    import asyncpg  # type: ignore
except ImportError:  # pragma: no cover
    asyncpg = None  # type: ignore


class ProfileStore:
    async def create_profile(self, user_id: UUID, recovery_token: str) -> Dict[str, Any]: ...
    async def get_profile(self, user_id: UUID) -> Optional[Dict[str, Any]]: ...
    async def get_by_recovery_token(self, token: str) -> Optional[Dict[str, Any]]: ...
    async def delete_profile(self, user_id: UUID) -> bool: ...
    async def apply_play_to_daily_tracker(self, user_id: UUID) -> None: ...
    async def update_streak(self, user_id: UUID, streak: int, today_iso: str) -> None: ...
    async def list_badges(self, user_id: UUID) -> List[Dict[str, Any]]: ...
    async def add_badge(self, user_id: UUID, badge_type: str) -> None: ...


@dataclass
class InMemoryProfileStore(ProfileStore):
    _profiles: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    _badges: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)

    async def create_profile(self, user_id: UUID, recovery_token: str) -> Dict[str, Any]:
        key = str(user_id)
        if key in self._profiles:
            raise ProfileConflictError(f"profile {key} already exists")
        now = datetime.now(timezone.utc)
        record = {
            "anonymous_user_id": key,
            "recovery_token": recovery_token,
            "score_memory": 0,
            "score_focus": 0,
            "score_logic": 0,
            "score_speed": 0,
            "score_spatial": 0,
            "current_streak": 0,
            "daily_games_played": 0,
            "daily_goal": 3,
            "daily_goal_date": None,
            "last_active_at": None,
            "created_at": now,
        }
        self._profiles[key] = record
        return record

    async def get_profile(self, user_id: UUID) -> Optional[Dict[str, Any]]:
        return self._profiles.get(str(user_id))

    async def get_by_recovery_token(self, token: str) -> Optional[Dict[str, Any]]:
        for record in self._profiles.values():
            if record["recovery_token"] == token:
                return record
        return None

    async def delete_profile(self, user_id: UUID) -> bool:
        return self._profiles.pop(str(user_id), None) is not None

    async def apply_play_to_daily_tracker(self, user_id: UUID) -> None:
        key = str(user_id)
        rec = self._profiles.get(key)
        if not rec:
            return
        today_iso = datetime.now(timezone.utc).date().isoformat()
        if rec.get("daily_goal_date") != today_iso:
            rec["daily_games_played"] = 0
            rec["daily_goal_date"] = today_iso
        rec["daily_games_played"] = rec.get("daily_games_played", 0) + 1

    async def update_streak(self, user_id: UUID, streak: int, today_iso: str) -> None:
        key = str(user_id)
        rec = self._profiles.get(key)
        if rec is None:
            return
        rec["current_streak"] = streak
        rec["daily_goal_date"] = today_iso
        rec["last_active_at"] = datetime.now(timezone.utc)

    async def list_badges(self, user_id: UUID) -> List[Dict[str, Any]]:
        return list(self._badges.get(str(user_id), []))

    async def add_badge(self, user_id: UUID, badge_type: str) -> None:
        key = str(user_id)
        self._badges.setdefault(key, []).append({
            "badge_id": f"badge-{len(self._badges.get(key, [])) + 1}",
            "badge_type": badge_type,
            "unlocked_at": datetime.now(timezone.utc).isoformat(),
        })

    def override_profile(self, user_id: UUID, fields: Dict[str, Any]) -> None:
        key = str(user_id)
        if key not in self._profiles:
            raise KeyError(key)
        self._profiles[key].update(fields)


class ProfileConflictError(Exception):
    pass


class ProfileNotFoundError(Exception):
    pass


def build_store_from_env() -> ProfileStore:
    """Factory used by the FastAPI app. Switches to Postgres if MINDFLEX_DB_HOST is set."""
    if os.environ.get("MINDFLEX_DB_HOST"):
        return PostgresProfileStore(
            host=os.environ["MINDFLEX_DB_HOST"],
            port=int(os.environ.get("MINDFLEX_DB_PORT", "5432")),
            database=os.environ.get("MINDFLEX_DB_NAME", "mindflex"),
            user=os.environ["MINDFLEX_DB_USER"],
            password=os.environ["MINDFLEX_DB_PASSWORD"],
        )
    return InMemoryProfileStore()


class PostgresProfileStore(ProfileStore):
    def __init__(self, host: str, port: int, database: str, user: str, password: str) -> None:
        if asyncpg is None:
            raise RuntimeError("asyncpg is required for PostgresProfileStore")
        self._dsn = f"postgresql://{user}:{password}@{host}:{port}/{database}"
        self._pool: Optional[asyncpg.Pool] = None

    async def connect(self) -> None:
        self._pool = await asyncpg.create_pool(self._dsn, min_size=1, max_size=5)

    async def close(self) -> None:
        if self._pool:
            await self._pool.close()

    async def create_profile(self, user_id: UUID, recovery_token: str) -> Dict[str, Any]:
        async with self._pool.acquire() as conn:  # type: ignore[union-attr]
            async with conn.transaction():
                try:
                    row = await conn.fetchrow(
                        """
                        INSERT INTO schema_common.user_profiles
                          (anonymous_user_id, recovery_token)
                        VALUES ($1, $2)
                        RETURNING *
                        """,
                        user_id,
                        recovery_token,
                    )
                except asyncpg.UniqueViolationError as exc:
                    raise ProfileConflictError(str(exc)) from exc
                return dict(row)

    async def get_profile(self, user_id: UUID) -> Optional[Dict[str, Any]]:
        async with self._pool.acquire() as conn:  # type: ignore[union-attr]
            row = await conn.fetchrow(
                "SELECT * FROM schema_common.user_profiles WHERE anonymous_user_id = $1",
                user_id,
            )
            return dict(row) if row else None

    async def get_by_recovery_token(self, token: str) -> Optional[Dict[str, Any]]:
        async with self._pool.acquire() as conn:  # type: ignore[union-attr]
            row = await conn.fetchrow(
                "SELECT * FROM schema_common.user_profiles WHERE recovery_token = $1",
                token,
            )
            return dict(row) if row else None

    async def delete_profile(self, user_id: UUID) -> bool:
        async with self._pool.acquire() as conn:  # type: ignore[union-attr]
            result = await conn.execute(
                "DELETE FROM schema_common.user_profiles WHERE anonymous_user_id = $1",
                user_id,
            )
            return result.endswith(" 1")

    async def apply_play_to_daily_tracker(self, user_id: UUID) -> None:
        async with self._pool.acquire() as conn:  # type: ignore[union-attr]
            await conn.execute(
                """
                UPDATE schema_common.user_profiles
                SET daily_games_played = CASE
                        WHEN daily_goal_date = CURRENT_DATE THEN daily_games_played + 1
                        ELSE 1
                    END,
                    daily_goal_date = CURRENT_DATE
                WHERE anonymous_user_id = $1
                """,
                user_id,
            )

    async def update_streak(self, user_id: UUID, streak: int, today_iso: str) -> None:
        async with self._pool.acquire() as conn:  # type: ignore[union-attr]
            await conn.execute(
                """
                UPDATE schema_common.user_profiles
                SET current_streak = $2,
                    daily_goal_date = $3,
                    last_active_at = CURRENT_TIMESTAMP
                WHERE anonymous_user_id = $1
                """,
                user_id,
                streak,
                today_iso,
            )

    async def list_badges(self, user_id: UUID) -> List[Dict[str, Any]]:
        async with self._pool.acquire() as conn:  # type: ignore[union-attr]
            rows = await conn.fetch(
                """
                SELECT badge_id, badge_type, unlocked_at
                FROM schema_common.user_badges
                WHERE anonymous_user_id = $1
                ORDER BY unlocked_at DESC
                """,
                user_id,
            )
            return [dict(r) for r in rows]

    async def add_badge(self, user_id: UUID, badge_type: str) -> None:
        async with self._pool.acquire() as conn:  # type: ignore[union-attr]
            await conn.execute(
                """
                INSERT INTO schema_common.user_badges (anonymous_user_id, badge_type)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
                """,
                user_id,
                badge_type,
            )
