# Linear Algebra AI Tutor — task runner.
#
# Install: https://github.com/casey/just#installation
# Usage:   `just --list` to see all recipes; `just <recipe>` to run one.
#
# Recipes assume:
#  - Your Python venv is active so `python` resolves to the right
#    interpreter (or set $VIRTUAL_ENV and just let the shell PATH win).
#  - Node 20+ with Corepack enabled so `yarn` works in frontend/.

# Default recipe: show the list. Running `just` with no args triggers it.
default:
    @just --list --unsorted

# --- backend ---------------------------------------------------------

# Backend test suite with coverage gate.
test-backend:
    cd backend && python -m pytest

# Apply all pending alembic migrations.
migrate:
    cd backend && python -m alembic upgrade head

# Create a new alembic revision via autogenerate.
# Usage: just migration name="add foo column"
migration name:
    cd backend && python -m alembic revision --autogenerate -m "{{name}}"

# Generate the RAG embeddings index from data/materials/.
embeddings:
    python scripts/generate_embeddings.py

# Run the FastAPI dev server (uvicorn with reload).
dev-backend:
    cd backend && python -m app.main

# --- frontend --------------------------------------------------------

# Vitest run (one-shot).
test-frontend:
    cd frontend && yarn test

# Vitest watch mode.
test-frontend-watch:
    cd frontend && yarn test:watch

# Vite dev server (http://localhost:5173).
dev-frontend:
    cd frontend && yarn dev

# Production build.
build-frontend:
    cd frontend && yarn build

# --- combined gates --------------------------------------------------

# Ruff (backend) + ESLint (frontend).
lint:
    cd backend && python -m ruff check app
    cd frontend && yarn lint

# mypy (backend) + tsc (frontend).
typecheck:
    cd backend && python -m mypy app --ignore-missing-imports
    cd frontend && yarn tsc --noEmit

# Backend + frontend tests.
test: test-backend test-frontend

# Everything CI runs, in the same order. Match this before pushing.
check: lint typecheck test

# --- setup -----------------------------------------------------------

# Install backend (pip) and frontend (yarn) dependencies.
install:
    cd backend && python -m pip install -r requirements.txt
    cd frontend && yarn install --immutable
