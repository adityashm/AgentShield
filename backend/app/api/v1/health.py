"""
AgentShield AI — Health, Readiness & Prometheus Metrics Endpoints
Implements /healthz, /readyz, and /metrics per SRS & Architecture specs.
"""

import time
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from ...database import get_db
from ...core.config import settings
from ...services.ml_engine import ml_engine
from ...workers.webhook_worker import webhook_worker
from ...db.models import Agent, Action, Alert

router = APIRouter(tags=["Health & Telemetry"])

APP_START_TIME = time.time()

@router.get("/healthz")
def liveness_check():
    """Liveness probe: returns 200 OK if API server process is alive."""
    return {
        "status": "ok",
        "service": "agentshield-api",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "uptime_seconds": round(time.time() - APP_START_TIME, 1),
    }

@router.get("/readyz")
def readiness_check(db: Session = Depends(get_db)):
    """Readiness probe: validates database connectivity, ML model loading, and worker status."""
    checks: Dict[str, Any] = {}
    is_ready = True

    # 1. Database Connectivity Probe
    try:
        db.execute(text("SELECT 1")).scalar()
        checks["database"] = {"status": "ok", "connected": True}
    except Exception as e:
        is_ready = False
        checks["database"] = {"status": "error", "error": str(e), "connected": False}

    # 2. Machine Learning Anomaly Engine
    try:
        checks["ml_engine"] = {
            "status": "ok" if ml_engine.is_trained else "initializing",
            "is_trained": ml_engine.is_trained,
        }
    except Exception as e:
        checks["ml_engine"] = {"status": "degraded", "error": str(e)}

    # 3. Webhook Outbox Worker
    if settings.RUN_WORKER_INLINE:
        worker_alive = webhook_worker._task is not None and not webhook_worker._task.done()
        checks["webhook_worker"] = {
            "status": "ok" if worker_alive else "stopped",
            "running": worker_alive,
        }
    else:
        checks["webhook_worker"] = {"status": "external"}

    if not is_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "not_ready", "checks": checks},
        )

    return {
        "status": "ready",
        "version": settings.VERSION,
        "checks": checks,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

@router.get("/metrics")
def prometheus_metrics(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Prometheus exposition metrics endpoint.
    Protected by METRICS_TOKEN if configured.
    """
    if settings.METRICS_TOKEN:
        expected = f"Bearer {settings.METRICS_TOKEN}"
        if not authorization or authorization != expected:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing Prometheus metrics bearer token.",
            )

    uptime = round(time.time() - APP_START_TIME, 2)

    try:
        active_agents = db.query(Agent).filter(Agent.status == "active").count()
        total_actions = db.query(Action).count()
        open_alerts = db.query(Alert).filter(Alert.status == "Open").count()
        db_status = 1
    except Exception:
        active_agents = 0
        total_actions = 0
        open_alerts = 0
        db_status = 0

    ml_ready = 1 if ml_engine.is_trained else 0
    worker_running = 1 if (webhook_worker._task is not None and not webhook_worker._task.done()) else 0

    lines = [
        "# HELP agentshield_uptime_seconds Total seconds the API server has been running.",
        "# TYPE agentshield_uptime_seconds gauge",
        f"agentshield_uptime_seconds {uptime}",
        "",
        "# HELP agentshield_database_status Database connectivity health (1=up, 0=down).",
        "# TYPE agentshield_database_status gauge",
        f"agentshield_database_status {db_status}",
        "",
        "# HELP agentshield_active_agents Total count of active monitored agents.",
        "# TYPE agentshield_active_agents gauge",
        f"agentshield_active_agents {active_agents}",
        "",
        "# HELP agentshield_actions_total Total cumulative agent actions ingested.",
        "# TYPE agentshield_actions_total counter",
        f"agentshield_actions_total {total_actions}",
        "",
        "# HELP agentshield_open_alerts Total open security alerts requiring triage.",
        "# TYPE agentshield_open_alerts gauge",
        f"agentshield_open_alerts {open_alerts}",
        "",
        "# HELP agentshield_ml_engine_ready Machine learning anomaly detection model status.",
        "# TYPE agentshield_ml_engine_ready gauge",
        f"agentshield_ml_engine_ready {ml_ready}",
        "",
        "# HELP agentshield_webhook_worker_running Webhook outbox worker status.",
        "# TYPE agentshield_webhook_worker_running gauge",
        f"agentshield_webhook_worker_running {worker_running}",
    ]

    content = "\n".join(lines) + "\n"
    return Response(content=content, media_type="text/plain; version=0.0.4; charset=utf-8")
