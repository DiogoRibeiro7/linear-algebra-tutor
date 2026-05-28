# Linear Algebra AI Tutor — task runner.
#
# Install: https://github.com/casey/just#installation
# Usage:   `just --list` to see all recipes; `just <recipe>` to run one.
#
# Recipes assume:
#  - Poetry is installed and on PATH (https://python-poetry.org/docs/#installation).
#  - Node 20+ with Corepack enabled so `yarn` works in frontend/.

# Default recipe: show the list. Running `just` with no args triggers it.
default:
    @just --list --unsorted

# --- backend ---------------------------------------------------------

# Backend test suite with coverage gate.
test-backend:
    cd backend && poetry run pytest

# Apply all pending alembic migrations.
migrate:
    cd backend && poetry run alembic upgrade head

# Create a new alembic revision via autogenerate.
# Usage: just migration name="add foo column"
migration name:
    cd backend && poetry run alembic revision --autogenerate -m "{{name}}"

# Generate the RAG embeddings index from data/materials/.
embeddings:
    cd backend && poetry run python ../scripts/generate_embeddings.py

# Run the FastAPI dev server (uvicorn with reload).
dev-backend:
    cd backend && poetry run python -m app.main

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
    cd backend && poetry run ruff check app
    cd frontend && yarn lint

# mypy (backend) + tsc (frontend).
typecheck:
    cd backend && poetry run mypy app --ignore-missing-imports
    cd frontend && yarn tsc --noEmit

# Backend + frontend tests.
test: test-backend test-frontend

# Everything CI runs, in the same order. Match this before pushing.
check: lint typecheck test

# --- setup -----------------------------------------------------------

# Install backend (poetry) and frontend (yarn) dependencies.
install:
    cd backend && poetry install --no-root --with test,dev
    cd frontend && yarn install --immutable
