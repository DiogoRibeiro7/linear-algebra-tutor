"""Application configuration using Pydantic Settings."""
import sys
from functools import lru_cache
from urllib.parse import urlparse

from pydantic import ValidationError, model_validator
from pydantic_settings import BaseSettings

_LOCAL_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}


class Settings(BaseSettings):
    """Application settings."""
    
    # Application
    APP_NAME: str = "Linear Algebra AI Tutor"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    
    # API
    API_V1_PREFIX: str = "/api/v1"
    
    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./linalg_tutor.db"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Anthropic
    ANTHROPIC_API_KEY: str
    CLAUDE_MODEL: str = "claude-sonnet-4-20250514"
    MAX_TOKENS: int = 4096
    TEMPERATURE: float = 0.7

    # Embedding Model
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 10
    
    # Tutoring Settings
    MAX_CONVERSATION_HISTORY: int = 10
    USE_HINTS_MODE: bool = True  # Socratic method, don't give direct answers
    
    class Config:
        env_file = ".env"
        case_sensitive = True

    @model_validator(mode="after")
    def _reject_localhost_cors_in_prod(self) -> "Settings":
        """Refuse to start in prod with the dev CORS allowlist still in place.

        Why: it's easy to deploy with DEBUG=false but forget to override
        CORS_ORIGINS, which would silently leave the dev origins trusted.
        """
        if self.DEBUG:
            return self
        leaked = [
            o for o in self.CORS_ORIGINS
            if (urlparse(o).hostname or "").lower() in _LOCAL_HOSTS
        ]
        if leaked:
            raise ValueError(
                "CORS_ORIGINS contains localhost entries while DEBUG=false: "
                f"{leaked}. Set CORS_ORIGINS to your real frontend origin(s)."
            )
        return self


class ConfigError(RuntimeError):
    """Raised at startup when required env vars are missing or invalid."""


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance, with a friendly error on misconfig."""
    try:
        # SECRET_KEY and ANTHROPIC_API_KEY are loaded from the environment
        # (.env) at runtime; mypy can't see that, so the call-arg check is
        # suppressed.
        return Settings()  # type: ignore[call-arg]
    except ValidationError as exc:
        lines = ["Configuration error — check your .env or environment vars:"]
        for err in exc.errors():
            field = ".".join(str(p) for p in err["loc"])
            lines.append(f"  - {field}: {err['msg']}")
        lines.append(
            "See .env.example for the full set of supported settings."
        )
        message = "\n".join(lines)
        # Print to stderr so it appears even if the caller swallows the
        # exception; then raise a clean ConfigError without the long
        # pydantic stack trace.
        print(message, file=sys.stderr)
        raise ConfigError(message) from None
