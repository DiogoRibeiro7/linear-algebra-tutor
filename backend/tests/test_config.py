"""Tests for the friendlier ConfigError surfaced on bad env state."""

import importlib

import pytest


def _reload_config():
    """Drop the lru_cache+module state so each test sees fresh env reads."""
    import app.config as config_module

    importlib.reload(config_module)
    return config_module


def test_missing_required_env_raises_config_error(monkeypatch):
    """When required keys are absent, get_settings() should raise a
    ConfigError with a message that names the missing field(s)."""
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    # Point env_file at something nonexistent so the test isn't satisfied
    # by a real .env on disk.
    monkeypatch.setenv("PYDANTIC_SETTINGS_NO_ENV_FILE", "1")

    config_module = _reload_config()

    with pytest.raises(config_module.ConfigError) as excinfo:
        config_module.get_settings()

    msg = str(excinfo.value)
    assert "SECRET_KEY" in msg
    assert "ANTHROPIC_API_KEY" in msg
    assert "Configuration error" in msg


def test_localhost_cors_blocked_when_debug_false(monkeypatch):
    """Production-shaped config with the dev CORS allowlist should fail."""
    monkeypatch.setenv("DEBUG", "false")
    monkeypatch.setenv(
        "CORS_ORIGINS", '["http://localhost:5173", "https://example.com"]'
    )

    config_module = _reload_config()

    with pytest.raises(config_module.ConfigError) as excinfo:
        config_module.get_settings()

    msg = str(excinfo.value)
    assert "CORS_ORIGINS" in msg
    assert "localhost" in msg


def test_localhost_cors_allowed_in_debug_mode(monkeypatch):
    """Dev mode keeps the localhost-friendly default usable."""
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("CORS_ORIGINS", '["http://localhost:5173"]')

    config_module = _reload_config()

    settings = config_module.get_settings()
    assert settings.CORS_ORIGINS == ["http://localhost:5173"]
