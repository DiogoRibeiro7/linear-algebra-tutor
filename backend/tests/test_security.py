"""Tests for password hashing and JWT token utilities."""
from datetime import timedelta

import pytest
from jose import jwt

from app.config import get_settings
from app.core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)

settings = get_settings()


def test_password_hash_roundtrip():
    pw = "correct horse battery staple"
    hashed = get_password_hash(pw)
    assert hashed != pw
    assert verify_password(pw, hashed)


def test_verify_password_rejects_wrong():
    hashed = get_password_hash("right")
    assert not verify_password("wrong", hashed)


def test_password_hash_uses_salt():
    """Same plaintext should produce different hashes (bcrypt salt)."""
    a = get_password_hash("same")
    b = get_password_hash("same")
    assert a != b
    assert verify_password("same", a)
    assert verify_password("same", b)


def test_create_access_token_encodes_subject():
    token = create_access_token({"sub": "alice"})
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == "alice"
    assert "exp" in payload


def test_create_access_token_honours_expires_delta():
    short = create_access_token({"sub": "bob"}, expires_delta=timedelta(seconds=1))
    payload = jwt.decode(short, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    long = create_access_token({"sub": "bob"}, expires_delta=timedelta(hours=1))
    long_payload = jwt.decode(long, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert long_payload["exp"] > payload["exp"]


def test_token_rejects_wrong_secret():
    token = create_access_token({"sub": "carol"})
    with pytest.raises(jwt.JWTError):
        jwt.decode(token, "not-the-real-secret", algorithms=[settings.ALGORITHM])
