"""Tests for the hint-level prompt resolver."""
from app.core.prompts import (
    HINT_LEVEL_SUFFIXES,
    TUTOR_SYSTEM_PROMPT,
    system_prompt_for,
)


def test_medium_returns_baseline_prompt():
    assert system_prompt_for("medium") == TUTOR_SYSTEM_PROMPT


def test_low_appends_minimal_suffix():
    prompt = system_prompt_for("low")
    assert prompt.startswith(TUTOR_SYSTEM_PROMPT)
    assert "HINT LEVEL: minimal" in prompt


def test_high_appends_generous_suffix():
    prompt = system_prompt_for("high")
    assert prompt.startswith(TUTOR_SYSTEM_PROMPT)
    assert "HINT LEVEL: generous" in prompt


def test_unknown_level_falls_back_to_baseline():
    """Typos in the DB column must not crash the chat path."""
    assert system_prompt_for("unrecognised") == TUTOR_SYSTEM_PROMPT


def test_suffix_table_covers_three_levels():
    """Guard against a level being removed without conversation."""
    assert set(HINT_LEVEL_SUFFIXES) == {"low", "medium", "high"}
