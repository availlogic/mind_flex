"""FastAPI dependencies for game-telemetry-service."""
from __future__ import annotations

from functools import lru_cache

from .db import (
    ProfileLookup,
    TelemetryStore,
    build_profile_lookup_from_env,
    build_telemetry_store_from_env,
)


@lru_cache(maxsize=1)
def _cached_telemetry_store() -> TelemetryStore:
    return build_telemetry_store_from_env()


@lru_cache(maxsize=1)
def _cached_profile_lookup() -> ProfileLookup:
    return build_profile_lookup_from_env()


def get_telemetry_store() -> TelemetryStore:
    return _cached_telemetry_store()


def get_profile_lookup() -> ProfileLookup:
    return _cached_profile_lookup()
