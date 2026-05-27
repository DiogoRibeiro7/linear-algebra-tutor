"""Tests for the uniform error envelope.

Cover each of the three handlers (HTTPException, RequestValidationError,
RateLimitExceeded) so the public error shape can't drift unnoticed.
"""
from app.core.errors import code_for_status


def test_code_for_status_overrides():
    assert code_for_status(422) == "validation_error"
    assert code_for_status(429) == "rate_limited"


def test_code_for_status_canonical():
    assert code_for_status(404) == "not_found"
    assert code_for_status(401) == "unauthorized"
    assert code_for_status(403) == "forbidden"
    assert code_for_status(400) == "bad_request"


def test_code_for_status_unknown_falls_back():
    assert code_for_status(999) == "unknown_error"


async def test_http_exception_handler_shape(client):
    """A plain HTTPException should come back as the envelope."""
    # Unauthenticated request -> 401 from oauth2 dep
    resp = await client.get("/api/v1/auth/me")
    body = resp.json()
    assert resp.status_code == 401
    assert body["code"] == "unauthorized"
    assert isinstance(body["message"], str) and body["message"]
    assert "details" in body


async def test_validation_error_handler_shape(client):
    """Pydantic validation errors should land in `details.errors`."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={"username": "x"},  # missing email/password/full_name
    )
    body = resp.json()
    assert resp.status_code == 422
    assert body["code"] == "validation_error"
    assert body["message"] == "Request validation failed"
    assert isinstance(body["details"]["errors"], list)
    assert len(body["details"]["errors"]) >= 1


async def test_rate_limit_handler_shape():
    """Unit-test the handler with a minimal stand-in.

    Constructing a real slowapi.wrappers.Limit takes 9 args; the handler
    only reads `exc.detail`, so a stand-in with that attribute is enough.
    End-to-end exercising would need module reloads that trash the
    shared in-memory test DB.
    """
    import json
    from types import SimpleNamespace
    from starlette.requests import Request
    from app.core.errors import rate_limit_handler

    fake_exc = SimpleNamespace(detail="10 per 1 minute")
    scope = {"type": "http", "method": "GET", "path": "/", "headers": []}
    request = Request(scope)

    resp = await rate_limit_handler(request, fake_exc)  # type: ignore[arg-type]
    body = json.loads(resp.body)
    assert resp.status_code == 429
    assert body["code"] == "rate_limited"
    assert body["message"] == "Rate limit exceeded: 10 per 1 minute"
