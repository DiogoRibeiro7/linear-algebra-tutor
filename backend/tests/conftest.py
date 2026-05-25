"""Shared pytest fixtures.

This module sets required env vars and stubs heavy external clients
(SentenceTransformer, anthropic.Anthropic) *before* any `app.*` import,
because both are instantiated at module load time as singletons.
"""
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock

import numpy as np

os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-prod")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("DEBUG", "false")
# Disable per-IP rate limiting so the module-level Limiter singleton doesn't
# leak counters across tests sharing the same simulated client IP.
os.environ.setdefault("DISABLE_RATE_LIMIT", "true")

import sentence_transformers  # noqa: E402

_fake_st_instance = MagicMock()
_fake_st_instance.encode = MagicMock(
    return_value=np.zeros((1, 384), dtype="float32")
)
sentence_transformers.SentenceTransformer = MagicMock(
    return_value=_fake_st_instance
)

import anthropic  # noqa: E402

anthropic.Anthropic = MagicMock()
anthropic.AsyncAnthropic = MagicMock()

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402


@pytest_asyncio.fixture
async def db_engine():
    """Per-test in-memory sqlite engine; StaticPool keeps the same connection."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine):
    Session = sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_engine):
    Session = sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with Session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_headers(client):
    """Register + login a test user; return Authorization header."""
    await client.post(
        "/api/v1/auth/register",
        json={
            "username": "tester",
            "email": "tester@example.com",
            "password": "password123",
            "full_name": "Test User",
        },
    )
    resp = await client.post(
        "/api/v1/auth/login",
        data={"username": "tester", "password": "password123"},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def second_user_headers(client):
    """A second registered user, for cross-user isolation tests."""
    await client.post(
        "/api/v1/auth/register",
        json={
            "username": "alice",
            "email": "alice@example.com",
            "password": "wonderland",
            "full_name": "Alice",
        },
    )
    resp = await client.post(
        "/api/v1/auth/login",
        data={"username": "alice", "password": "wonderland"},
    )
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}
