#!/bin/sh
set -e

echo "[entrypoint.sh] Running database migrations (alembic upgrade head)..."
alembic upgrade head

echo "[entrypoint.sh] Starting AgentShield API server with uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'
