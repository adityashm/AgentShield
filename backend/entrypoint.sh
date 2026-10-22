#!/bin/sh
set -e

echo "[entrypoint.sh] Initializing AgentShield API environment..."

# Wait for PostgreSQL host connectivity if postgresql is in DATABASE_URL
if [ -n "$DATABASE_URL" ] && echo "$DATABASE_URL" | grep -q "postgresql"; then
    echo "[entrypoint.sh] Probing PostgreSQL connectivity..."
    python -c '
import sys, time, os, socket
from urllib.parse import urlparse

db_url = os.environ.get("DATABASE_URL", "")
try:
    clean = db_url.replace("postgresql+asyncpg://", "http://").replace("postgresql://", "http://")
    parsed = urlparse(clean)
    host = parsed.hostname or "db"
    port = parsed.port or 5432
    print(f"[entrypoint.sh] Connecting to {host}:{port}...")
    for attempt in range(30):
        try:
            s = socket.create_connection((host, port), timeout=2)
            s.close()
            print("[entrypoint.sh] Database host is reachable!")
            sys.exit(0)
        except OSError:
            time.sleep(1)
    print("[entrypoint.sh] Warning: Database probe timed out, attempting migrations anyway.")
except Exception as e:
    print(f"[entrypoint.sh] Note: Connection check bypassed ({e}).")
'
fi

echo "[entrypoint.sh] Running database migrations (alembic upgrade head)..."
alembic upgrade head

echo "[entrypoint.sh] Starting AgentShield API server on port 8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'
