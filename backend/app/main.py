"""Main FastAPI application."""
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.db.session import init_db, close_db
from app.api import auth, chat
from app.core.errors import (
    http_exception_handler,
    rate_limit_handler,
    validation_exception_handler,
)
from app.core.rag import rag_system
from app.core.limiter import limiter
from pathlib import Path

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    print("Starting up...")
    await init_db()
    
    # Load RAG embeddings if they exist
    embeddings_dir = Path("data/embeddings")
    if embeddings_dir.exists() and (embeddings_dir / "embeddings.npy").exists():
        try:
            rag_system.load_embeddings(embeddings_dir)
            print("RAG system loaded successfully")
        except Exception as e:
            print(f"Warning: Could not load RAG embeddings: {e}")
            print("The system will work but without course material retrieval")
    else:
        print("No pre-generated embeddings found. Run scripts/generate_embeddings.py first")
    
    yield
    
    # Shutdown
    print("Shutting down...")
    await close_db()


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan
)

# Wire rate limiting + the uniform error envelope. The starlette
# HTTPException is what FastAPI's HTTPException inherits from, so a
# single handler covers both.
app.state.limiter = limiter
app.add_exception_handler(
    StarletteHTTPException,
    http_exception_handler,  # type: ignore[arg-type]
)
app.add_exception_handler(
    RequestValidationError,
    validation_exception_handler,  # type: ignore[arg-type]
)
app.add_exception_handler(
    RateLimitExceeded,
    rate_limit_handler,  # type: ignore[arg-type]
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(
    auth.router,
    prefix=f"{settings.API_V1_PREFIX}/auth",
    tags=["Authentication"]
)

app.include_router(
    chat.router,
    prefix=f"{settings.API_V1_PREFIX}/chat",
    tags=["Chat"]
)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "rag_loaded": rag_system.embeddings is not None
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
