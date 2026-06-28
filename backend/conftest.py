"""pytest configuration.

Adds the two service source trees to sys.path so tests can `import
profile_service.app...` and `import game_telemetry_service.app...` without
needing to install the packages first.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
for svc in ("profile_service", "game_telemetry_service"):
    p = (ROOT / svc).resolve()
    if p.exists():
        sys.path.insert(0, str(p))
