"""Per-IP rate limiting for write endpoints.

Kept in its own module so both `main` and routers can import it
without a circular dependency.
"""
import os

from slowapi import Limiter
from slowapi.util import get_remote_address


# Tests set DISABLE_RATE_LIMIT=true so per-IP counters don't leak across cases
_enabled = os.environ.get("DISABLE_RATE_LIMIT", "false").lower() != "true"

limiter = Limiter(key_func=get_remote_address, enabled=_enabled)
