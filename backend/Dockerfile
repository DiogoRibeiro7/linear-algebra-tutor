FROM python:3.11-slim

WORKDIR /app

# System deps that some pip wheels (psycopg2-binary, bcrypt) need to build
# if they fall back to source on the slim base image.
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
    && rm -rf /var/lib/apt/lists/*

# Install poetry pinned to a known-good version so prod builds are
# reproducible even if pypi publishes a new poetry tomorrow.
ENV POETRY_VERSION=2.4.1 \
    POETRY_HOME=/opt/poetry \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=false
RUN pip install --no-cache-dir "poetry==${POETRY_VERSION}"

# Install dependencies first for better layer caching. With
# virtualenvs.create=false poetry installs straight into the image's
# site-packages — no extra layer of venv indirection.
COPY pyproject.toml poetry.lock ./
RUN poetry install --only main --no-root

# Copy application code last so iterating on source doesn't bust the
# (much heavier) dependency layer.
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
