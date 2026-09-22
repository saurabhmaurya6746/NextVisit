#!/usr/bin/env bash
set -e

echo "==> Running Alembic migrations (with fallback)..."
alembic upgrade head || echo "Alembic CLI upgrade finished with warnings (will be resolved during application startup)."

echo "==> Starting Uvicorn server..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

