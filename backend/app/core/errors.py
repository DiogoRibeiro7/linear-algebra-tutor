"""Uniform error envelope for the public API.

All error responses share this shape regardless of which framework
raised them:

    {
        "code":    "<short_slug>",
        "message": "<human-readable summary>",
        "details": <object|null>
    }

The handlers below wrap FastAPI's HTTPException, pydantic's
RequestValidationError, and slowapi's RateLimitExceeded so the
frontend only ever has to know about this one shape.
"""
from http import HTTPStatus
from typing import Any, Optional

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException


class ErrorResponse(BaseModel):
    """Public-facing error body. Documented in OpenAPI."""

    code: str
    message: str
    details: Optional[dict[str, Any]] = None


# A couple of HTTP statuses have unfriendly canonical names; override
# them with shorter slugs that read better in client error handling.
_CODE_OVERRIDES = {
    422: "validation_error",
    429: "rate_limited",
}


def code_for_status(status_code: int) -> str:
    """Return a short lowercase slug for an HTTP status code."""
    if status_code in _CODE_OVERRIDES:
        return _CODE_OVERRIDES[status_code]
    try:
        return HTTPStatus(status_code).name.lower()
    except ValueError:
        return "unknown_error"


def _envelope(
    status_code: int,
    message: str,
    details: Optional[dict[str, Any]] = None,
) -> JSONResponse:
    body = ErrorResponse(
        code=code_for_status(status_code),
        message=message,
        details=details,
    )
    return JSONResponse(status_code=status_code, content=body.model_dump())


async def http_exception_handler(
    request: Request,  # noqa: ARG001 -- handler signature required by FastAPI
    exc: StarletteHTTPException,
) -> JSONResponse:
    """Convert any HTTPException into the envelope shape."""
    # exc.detail may be a string, dict, or list depending on the caller.
    if isinstance(exc.detail, str):
        message = exc.detail
        details = None
    else:
        # Non-string detail (e.g. list/dict from a custom raise) lands in
        # `details` so the message stays a plain summary.
        message = HTTPStatus(exc.status_code).phrase
        details = {"detail": exc.detail}
    return _envelope(exc.status_code, message, details)


async def validation_exception_handler(
    request: Request,  # noqa: ARG001
    exc: RequestValidationError,
) -> JSONResponse:
    """Convert pydantic's 422 errors into the envelope shape."""
    return _envelope(
        status_code=422,
        message="Request validation failed",
        details={"errors": exc.errors()},
    )


async def rate_limit_handler(
    request: Request,  # noqa: ARG001
    exc: RateLimitExceeded,
) -> JSONResponse:
    """slowapi raises RateLimitExceeded; reshape to the envelope."""
    return _envelope(
        status_code=429,
        message=f"Rate limit exceeded: {exc.detail}",
    )
