from fastapi.testclient import TestClient
from app.services.webhook_dispatcher import webhook_dispatcher
import hmac
import hashlib

def test_webhook_crud(client: TestClient):
    # 1. Register Webhook
    payload = {
        "name": "Security Operations Slack",
        "url": "https://hooks.slack.com/services/T00/B00/XXXX",
        "target_type": "slack",
        "min_severity": "Critical",
        "secret": "super_secret_test_key_123",
        "enabled": True,
    }
    create_res = client.post("/api/v1/webhooks", json=payload)
    assert create_res.status_code == 200
    data = create_res.json()
    assert data["name"] == "Security Operations Slack"
    assert data["target_type"] == "slack"
    assert data["min_severity"] == "Critical"
    assert data["has_secret"] is True
    endpoint_id = data["endpoint_id"]

    # 2. List Webhooks
    list_res = client.get("/api/v1/webhooks")
    assert list_res.status_code == 200
    endpoints = list_res.json()
    assert any(ep["endpoint_id"] == endpoint_id for ep in endpoints)

    # 3. Update Webhook
    update_res = client.put(
        f"/api/v1/webhooks/{endpoint_id}",
        json={"name": "SecOps Primary Slack", "enabled": False},
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "SecOps Primary Slack"
    assert update_res.json()["enabled"] is False

    # 4. Delete Webhook
    del_res = client.delete(f"/api/v1/webhooks/{endpoint_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"

    # Confirm deletion
    list_res2 = client.get("/api/v1/webhooks")
    assert not any(ep["endpoint_id"] == endpoint_id for ep in list_res2.json())

def test_hmac_signature_generation():
    secret = "my_wh_secret_key"
    timestamp = 1729600000
    raw_payload = b'{"event":"alert.created"}'
    
    sig_header = webhook_dispatcher.compute_hmac_signature(secret, timestamp, raw_payload)
    assert sig_header.startswith(f"t={timestamp},v1=")
    
    # Verify signature manually
    expected_hash = hmac.new(
        secret.encode("utf-8"),
        f"{timestamp}.".encode("utf-8") + raw_payload,
        hashlib.sha256
    ).hexdigest()
    
    assert sig_header == f"t={timestamp},v1={expected_hash}"

def test_payload_formatters():
    alert_data = {
        "alert_id": "ALT-9999",
        "agent_id": "AGT-SEC-99",
        "severity": "Critical",
        "risk_score": 92.5,
        "trigger_type": "rule_match",
        "notes": "Directory traversal blocked",
    }
    action_data = {
        "action_id": "ACT-111",
        "action_type": "file_read",
        "parameters": {"path": "/etc/shadow"},
    }

    # Slack format
    slack_payload = webhook_dispatcher.format_slack_payload(alert_data, action_data)
    assert "blocks" in slack_payload
    assert "CRITICAL" in slack_payload["text"]

    # Discord format
    discord_payload = webhook_dispatcher.format_discord_payload(alert_data, action_data)
    assert "embeds" in discord_payload
    assert discord_payload["embeds"][0]["color"] == 0xEF4444

    # Generic format
    generic_payload = webhook_dispatcher.format_generic_payload(alert_data, action_data, "org_default")
    assert generic_payload["event"] == "alert.created"
    assert generic_payload["alert"]["alert_id"] == "ALT-9999"
