"""Unit tests for the 4-word recovery mnemonic generator.

Spec source:
  - docs/PRD.md §11.1 (Recovery Token: 12-word mnemonic or UUID token)
  - docs/User-Flows.md §2.2 (12-Word Recovery Mnemonic)
  - docs/Screen-Specs.md §3.3 (Paste input box must contain exactly 4 dash-separated words.)
  - docs/Functional-Test-Cases.md FT-PBR-02 (Invalid token format. Must be 4 dash-separated words.)

The implementation produces a fixed 4-word mnemonic in the canonical format
`adjective-noun-adjective-noun`. The PRD allows either a 12-word or UUID token;
User-Flows references 12 words, but the Frontend Input Validation rule
(Screen-Specs §3.3 + Functional-Test-Cases FT-PBR-02) explicitly constrains
the paste input to exactly 4 dash-separated words. SSOT resolution:
the dashboard paste field is 4 words, and the persistence/recovery flow uses
the same 4-word representation (this is also what tests exercise).
"""
import pytest

from profile_service.app.services.recovery_token import (
    generate_recovery_token,
    is_valid_format,
    parse_recovery_token,
)


def test_generate_recovery_token_returns_four_dash_separated_words():
    token = generate_recovery_token()
    parts = token.split("-")
    assert len(parts) == 4
    for p in parts:
        assert p.isalpha()
        assert p == p.lower()


def test_generate_recovery_token_is_unique_with_high_probability():
    tokens = {generate_recovery_token() for _ in range(1000)}
    assert len(tokens) == 1000


def test_is_valid_format_accepts_well_formed_token():
    assert is_valid_format("crimson-tiger-autumn-breeze") is True


def test_is_valid_format_rejects_wrong_arity():
    assert is_valid_format("tiger") is False
    assert is_valid_format("a-b-c") is False
    assert is_valid_format("a-b-c-d-e") is False


def test_is_valid_format_rejects_non_alpha_or_uppercase():
    assert is_valid_format("crimson-tiger-autumn-breeze!") is False
    assert is_valid_format("Crimson-tiger-autumn-breeze") is False
    assert is_valid_format("crimson123-tiger-autumn-breeze") is False


def test_is_valid_format_rejects_empty_and_whitespace_segments():
    assert is_valid_format("--") is False
    assert is_valid_format("") is False


def test_parse_recovery_token_returns_word_tuple():
    parts = parse_recovery_token("crimson-tiger-autumn-breeze")
    assert parts == ("crimson", "tiger", "autumn", "breeze")


def test_parse_recovery_token_rejects_invalid():
    with pytest.raises(ValueError):
        parse_recovery_token("not-valid")
