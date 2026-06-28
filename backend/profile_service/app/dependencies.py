"""FastAPI dependencies."""
from __future__ import annotations

from functools import lru_cache

from .db import ProfileStore, build_store_from_env


@lru_cache(maxsize=1)
def _cached_store() -> ProfileStore:
    return build_store_from_env()


def get_profile_store() -> ProfileStore:
    return _cached_store()
