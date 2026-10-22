"""
backend/tests/test_phase4.py — Unit and Integration Tests for Phase 4:
- 10-minute Alert Sliding Window Deduplication & Comments
- Transactional Webhook Outbox, SSRF Defense, and Payload Adapters
- Tamper-Evident SHA-256 Cryptographic Audit Log Chain Verification
- Live Realtime Telemetry Event Bus and WebSocket Feeds
"""

import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.db.models.alert import Alert, AlertComment
from app.db.models.webhook import WebhookEndpoint, WebhookDelivery
from app.db.models.audit import AuditLog
from app.services.alerts import AlertService
from app.services.audit import AuditService, GENESIS_HASH, compute_audit_hash
from app.workers.webhook_worker import (
    is_safe_webhook_url,
    webhook_worker,
    format_slack_payload,
    format_discord_payload,
    format_pagerduty_payload,
)
from app.realtime.bus import telemetry_bus


def test_alert_deduplication_sliding_window(client: TestClient, admin_token: str):
    """Verifies that duplicate threats within 10 minutes increment the existing alert count."""
    jwt_headers = {"Authorization": f"Bearer {admin_token}"}

    # Generate an API key for action telemetry
    key_res = client.post(
        "/api/v1/api-keys",
        headers=jwt_headers,
        json={"name": "Dedup Test Key", "is_test": False},
    )
    assert key_res.status_code == 200
    api_key = key_res.json()["api_key"]
    key_headers = {"X-API-Key": api_key}

    # 1. First threat action: Unauthorized File Access
    res1 = client.post(
        "/api/v1/actions",
        headers=key_headers,
        json={
            "agent_id": "AGT-DEDUP-01",
            "action_type": "file_read",
            "tool_name": "filesystem",
            "parameters": {"path": "/etc/shadow"},
        },
    )
    assert res1.status_code == 200

    # Verify initial alert created with count = 1
    alerts_res = client.get("/api/v1/alerts", headers=jwt_headers)
    assert alerts_res.status_code == 200
    alerts = [a for a in alerts_res.json() if a.get("agent_id") == "AGT-DEDUP-01"]
    assert len(alerts) >= 1
    initial_alert = alerts[0]
    initial_count = initial_alert.get("count", 1)
    alert_id = initial_alert.get("alert_id") or initial_alert.get("id")

    # 2. Second identical threat action within 10 minutes
    res2 = client.post(
        "/api/v1/actions",
        headers=key_headers,
        json={
            "agent_id": "AGT-DEDUP-01",
            "action_type": "file_read",
            "tool_name": "filesystem",
            "parameters": {"path": "/etc/shadow"},
        },
    )
    assert res2.status_code == 200

    # Verify no new alert was created; count was incremented
    alerts_res2 = client.get("/api/v1/alerts", headers=jwt_headers)
    matching_alerts = [a for a in alerts_res2.json() if a.get("agent_id") == "AGT-DEDUP-01"]
    assert len(matching_alerts) == len(alerts)
    updated_alert = [a for a in matching_alerts if (a.get("alert_id") or a.get("id")) == alert_id][0]
    assert updated_alert.get("count", 1) == initial_count + 1


def test_alert_comments_thread(client: TestClient, admin_token: str):
    """Verifies analyst investigation notes can be attached to alerts."""
    jwt_headers = {"Authorization": f"Bearer {admin_token}"}

    key_res = client.post(
        "/api/v1/api-keys",
        headers=jwt_headers,
        json={"name": "Comment Test Key", "is_test": False},
    )
    assert key_res.status_code == 200
    api_key = key_res.json()["api_key"]

    # Create an alert via threat action
    action_res = client.post(
        "/api/v1/actions",
        headers={"X-API-Key": api_key},
        json={
            "agent_id": "AGT-COMMENT-01",
            "action_type": "file_read",
            "tool_name": "filesystem",
            "parameters": {"path": "/etc/passwd"},
        },
    )
    assert action_res.status_code == 200

    alerts_res = client.get("/api/v1/alerts", headers=jwt_headers)
    alert = [a for a in alerts_res.json() if a.get("agent_id") == "AGT-COMMENT-01"][0]
    alert_id = alert.get("alert_id") or alert.get("id")

    # Post an analyst comment
    comment_res = client.post(
        f"/api/v1/alerts/{alert_id}/comments",
        headers=jwt_headers,
        json={"body": "Investigating unauthorized access. Agent container isolated."},
    )
    assert comment_res.status_code == 200
    comment_data = comment_res.json()
    assert comment_data["body"] == "Investigating unauthorized access. Agent container isolated."
    assert comment_data["alert_id"] == alert_id

    # List comments
    list_comments = client.get(f"/api/v1/alerts/{alert_id}/comments", headers=jwt_headers)
    assert list_comments.status_code == 200
    comments = list_comments.json()
    assert len(comments) >= 1
    assert any("isolated" in c["body"] for c in comments)


def test_ssrf_protection_filters():
    """Verifies SSRF filter blocks private IPs, metadata endpoints, and non-http schemes."""
    # Loopbacks and localhost
    safe, msg = is_safe_webhook_url("http://localhost:8080/hook", allow_local=False)
    assert not safe
    assert "prohibited" in msg.lower() or "blocked" in msg.lower()

    safe, _ = is_safe_webhook_url("http://127.0.0.1:9000/hook", allow_local=False)
    assert not safe

    # Private RFC 1918 networks
    safe, _ = is_safe_webhook_url("http://10.0.1.5:8000/callback", allow_local=False)
    assert not safe

    safe, _ = is_safe_webhook_url("http://192.168.1.100/webhook", allow_local=False)
    assert not safe

    # Cloud metadata endpoint
    safe, _ = is_safe_webhook_url("http://169.254.169.254/latest/meta-data/", allow_local=False)
    assert not safe

    # Non-HTTP protocols
    safe, _ = is_safe_webhook_url("ftp://internal.server/data", allow_local=False)
    assert not safe

    # Allowed with override (for local tests)
    safe_local, _ = is_safe_webhook_url("http://127.0.0.1:8000/hook", allow_local=True)
    assert safe_local


def test_webhook_adapters_format():
    """Verifies payload structure for Slack, Discord, and PagerDuty."""
    alert_payload = {
        "alert_id": "ALT-TEST-ADAPTER",
        "title": "High Risk Action Detected",
        "severity": "CRITICAL",
        "risk_score": 95.0,
        "agent_id": "AGT-SEC-01",
        "rule_id": "RUL-001",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Slack
    slack = format_slack_payload(alert_payload)
    assert "blocks" in slack
    assert len(slack["blocks"]) >= 2
    assert "CRITICAL" in slack["text"]

    # Discord
    discord = format_discord_payload(alert_payload)
    assert "embeds" in discord
    assert discord["embeds"][0]["color"] == 0xEF4444

    # PagerDuty
    pd = format_pagerduty_payload(alert_payload, routing_key="pd_key_123")
    assert pd["routing_key"] == "pd_key_123"
    assert pd["payload"]["severity"] == "critical"
    assert pd["event_action"] == "trigger"


def test_audit_log_cryptographic_hash_chain(client: TestClient, admin_token: str, db: Session):
    """
    Verifies that audit log entries form an unbroken cryptographic SHA-256 chain,
    and that unauthorized database modifications are reliably flagged.
    """
    headers = {"Authorization": f"Bearer {admin_token}"}
    org_id = "org_default"

    # 1. Clean existing test audit logs for this org
    db.query(AuditLog).filter(AuditLog.org_id == org_id).delete()
    db.commit()

    # 2. Add sequence of 3 audit events using AuditService
    entry1 = AuditService.log_event(
        db=db,
        org_id=org_id,
        action="policy.created",
        target_type="rule",
        target_id="RUL-TEST-01",
        actor_id="admin-user",
        details={"rule_name": "Block /etc access"},
    )
    assert entry1.prev_hash == GENESIS_HASH

    entry2 = AuditService.log_event(
        db=db,
        org_id=org_id,
        action="agent.quarantine",
        target_type="agent",
        target_id="AGT-009",
        actor_id="admin-user",
        details={"reason": "Excessive prompt injections"},
    )
    assert entry2.prev_hash == entry1.hash

    entry3 = AuditService.log_event(
        db=db,
        org_id=org_id,
        action="api_key.create",
        target_type="api_key",
        target_id="KEY-123",
        actor_id="admin-user",
        details={"prefix": "ashield_live_abc"},
    )
    assert entry3.prev_hash == entry2.hash
    db.commit()

    # 3. Verify valid chain via service
    verify_res = AuditService.verify_chain(db, org_id)
    assert verify_res["verified"] is True
    assert verify_res["total_records"] == 3
    assert verify_res["latest_hash"] == entry3.hash

    # 4. Verify valid chain via REST endpoint
    api_res = client.get("/api/v1/audit/verify", headers=headers)
    assert api_res.status_code == 200
    assert api_res.json()["verified"] is True
    assert api_res.json()["total_records"] == 3

    # 5. Tampering Test: alter details of entry2 in DB
    entry2.details = {"reason": "TAMPERED DETAILS"}
    db.commit()

    tampered_res = AuditService.verify_chain(db, org_id)
    assert tampered_res["verified"] is False
    assert tampered_res["tampered_at_id"] == entry2.id
    assert "detected" in tampered_res["reason"].lower()

    # Check tamper detection via REST endpoint
    api_tampered = client.get("/api/v1/audit/verify", headers=headers)
    assert api_tampered.status_code == 200
    assert api_tampered.json()["verified"] is False
    assert api_tampered.json()["tampered_at_id"] == entry2.id


@pytest.mark.asyncio
async def test_telemetry_event_bus_pubsub():
    """Verifies async pub/sub broadcast and subscriber queue isolation."""
    queue = await telemetry_bus.subscribe("org:org_test_channel")
    try:
        test_event = {"type": "ACTION_RECORDED", "agent_id": "AGT-BUS-01", "risk_score": 42.0}
        await telemetry_bus.broadcast_org_event("org_test_channel", test_event)

        received = await asyncio.wait_for(queue.get(), timeout=2.0)
        assert received["type"] == "ACTION_RECORDED"
        assert received["agent_id"] == "AGT-BUS-01"
    finally:
        await telemetry_bus.unsubscribe("org:org_test_channel", queue)
