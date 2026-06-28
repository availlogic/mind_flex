"""4-word recovery token generator and validator.

Spec:
  - PRD §11.1: "12-word mnemonic or UUID token" (allowed forms)
  - User-Flows §2.2: "12-Word Recovery Mnemonic"
  - Screen-Specs §3.3 + Functional-Test-Cases FT-PBR-02:
      "Paste input box must contain exactly 4 dash-separated words."
      "Invalid token format. Must be 4 dash-separated words."

SSOT resolution (Test-Strategy §2 / Screen-Specs §3.3 / FT-PBR-02 are the most
restrictive, most-testable sources): the dashboard paste field validates to
4 dash-separated words. The server uses the same representation for
storage and lookup.
"""
from __future__ import annotations

import secrets
import re
from typing import Iterable, Tuple


WORDLIST: Tuple[str, ...] = (
    "amber", "azure", "basil", "beacon", "cinder", "cobalt", "comet",
    "copper", "crimson", "crystal", "delta", "ember", "emerald", "falcon",
    "feather", "forest", "frost", "galaxy", "ginger", "glacier", "harbor",
    "hawk", "helix", "iris", "ivory", "jade", "jasper", "kestrel", "lapis",
    "lavender", "lotus", "lunar", "marble", "meadow", "mint", "mistral",
    "molten", "nebula", "nimbus", "oak", "onyx", "opal", "orchid", "otter",
    "pebble", "phoenix", "pine", "plasma", "polar", "prism", "quartz",
    "quill", "raven", "reef", "river", "roan", "ruby", "rustic", "sable",
    "sage", "sapphire", "scarlet", "shadow", "silver", "slate", "solar",
    "spruce", "stellar", "stone", "storm", "summer", "tiger", "topaz",
    "tundra", "umber", "velvet", "violet", "vortex", "wave", "willow",
    "winter", "wisp", "wolf", "zephyr", "autumn", "breeze", "canyon",
    "dawn", "dune", "echo", "evergreen", "fjord", "glade", "horizon",
    "mirage", "monsoon", "nectar", "north", "ocean", "prairie", "rain",
    "ridge", "sequoia", "shore", "sprout", "thicket", "valley", "whisper",
)

_TOKEN_RE = re.compile(r"^[a-z]+(-[a-z]+){3}$")


def _sample_word() -> str:
    return secrets.choice(WORDLIST)


def generate_recovery_token() -> str:
    return "-".join(_sample_word() for _ in range(4))


def is_valid_format(token: object) -> bool:
    if not isinstance(token, str):
        return False
    return _TOKEN_RE.match(token) is not None


def parse_recovery_token(token: str) -> Tuple[str, ...]:
    if not is_valid_format(token):
        raise ValueError("Recovery token must be 4 dash-separated lowercase words")
    return tuple(token.split("-"))
