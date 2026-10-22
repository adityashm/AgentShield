"""
Automated unit & integration tests for /healthz, /readyz, and Prometheus /metrics endpoints.
"""

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings

def test_liveness_healthz_endpoint(client: TestClient):
    """Verify /healthz returns 200 OK and reports uptime."""
    res = client.get("/healthz")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["service"] == "agentshield-api"
    assert "uptime_seconds" in data

    # Test v1 alias
    v1_res = client.get("/api/v1/healthz")
    assert v1_res.status_code == 200
    assert v1_res.json()["status"] == "ok"

def test_readiness_readyz_endpoint(client: TestClient):
    """Verify /readyz probe tests database connectivity, ML engine, and worker."""
    res = client.get("/readyz")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ready"
    assert "checks" in data
    assert data["checks"]["database"]["connected"] is True
    assert "ml_engine" in data["checks"]
    assert "webhook_worker" in data["checks"]

    # Test v1 alias
    v1_res = client.get("/api/v1/readyz")
    assert v1_res.status_code == 200
    assert v1_res.json()["status"] == "ready"

def test_prometheus_metrics_endpoint_unauthorized(client: TestClient):
    """Verify /metrics rejects requests without valid token when METRICS_TOKEN is set."""
    if settings.METRICS_TOKEN:
        res = client.get("/metrics")
        assert res.status_code == 401

def test_prometheus_metrics_endpoint_authorized(client: TestClient):
    """Verify /metrics returns Prometheus text exposition with expected gauge and counter keys."""
    headers = {}
    if settings.METRICS_TOKEN:
        headers["Authorization"] = f"Bearer {settings.METRICS_TOKEN}"

    res = client.get("/metrics", headers=headers)
    assert res.status_code == 200
    assert "text/plain" in res.headers["content-type"]
    text_content = res.text
    assert "agentshield_uptime_seconds" in text_content
    assert "agentshield_database_status 1" in text_content
    assert "agentshield_actions_total" in text_content
    assert "agentshield_open_alerts" in text_content
    assert "agentshield_ml_engine_ready" in text_content
