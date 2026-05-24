# Next Steps

This file tracks prioritized improvements for the Linear Algebra Tutor repository.

## 1. Testing Foundation (Highest Priority)

- Add backend test structure under `backend/tests/` with:
  - API smoke tests for auth and chat routes
  - Unit tests for `TutorService`
  - Mocks for Anthropic calls
- Add frontend test setup (Vitest + React Testing Library) and initial tests for:
  - `ChatInterface`
  - Login and register forms
  - Markdown/LaTeX rendering path

## 2. Developer Experience

- Add `Makefile` (or cross-platform task runner) for common commands:
  - `make setup`, `make lint`, `make test`, `make dev`
- Add pre-commit hooks for `ruff`, `black`, and frontend linting.
- Add `.env` validation at startup with clear errors for missing keys.

## 3. API and Data Quality

- Add Pydantic request/response schemas where implicit dicts are used.
- Add consistent error response model (`code`, `message`, `details`).
- Introduce DB migrations for all evolving models and document migration flow.

## 4. Security and Reliability

- Enforce stricter CORS defaults in production configuration.
- Add basic request rate limiting for auth and chat endpoints.
- Add health check endpoint and readiness checks for deployment.

## 5. Product Improvements

- Add conversation search/filter and pinning in frontend.
- Improve RAG chunking strategy and metadata filtering by chapter/topic.
- Add a "hint level" control to tune Socratic guidance depth.

## 6. CI/CD Evolution

- Split CI into reusable workflows (backend/frontend/docker).
- Add coverage reporting and fail under threshold once tests exist.
- Add release workflow for semantic tags and changelog generation.
