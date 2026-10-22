"""
backend/tests/test_playbooks.py — Tests for Automated Incident Remediation Playbooks.
Verifies playbook CRUD, threshold evaluation, and autonomous agent quarantine.
"""

import pytest
import asyncio
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Playbook, Agent, Alert, Action, Organization, AuditLog
from app.services.playbook_engine import PlaybookEngine

DEMO_KEY = "ashield_test_default_demo_key_12345"

def test_list_and_create_playbook(client: TestClient):
    """Verifies listing and creating incident remediation playbooks."""
    headers = {"Authorization": f"Bearer {DEMO_KEY}"}
    
    # 1. List seeded playbooks
    res = client.get("/api/v1/playbooks", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert any("Auto-Quarantine" in p["name"] for p in data)

    # 2. Create custom playbook
    new_pb = {
        "name": "Custom Team Notification on Critical Threat",
        "description": "Custom automated security response",
        "trigger_event": "alert.created",
        "severity_threshold": "Critical",
        "count_threshold": 1,
        "time_window_seconds": 120,
        "action_type": "quarantine_agent",
        "enabled": True,
    }
    res2 = client.post("/api/v1/playbooks", json=new_pb, headers=headers)
    assert res2.status_code == 200
    pb_data = res2.json()
    assert pb_data["name"] == new_pb["name"]

    # 3. Toggle playbook
    res3 = client.patch(f"/api/v1/playbooks/{pb_data['id']}/toggle", headers=headers)
    assert res3.status_code == 200
    assert res3.json()["enabled"] is False

@pytest.mark.asyncio
async def test_auto_quarantine_playbook_execution(client: TestClient, db: Session):
    """Verifies that an agent is autonomously quarantined when alert threshold is crossed."""
    now = datetime.now(timezone.utc)
    org_id = "org_default"
    agent_id = "test_playbook_target_bot"

    # 1. Create target agent
    agent = db.query(Agent).filter(Agent.external_id == agent_id).first()
    if not agent:
        agent = Agent(
            id=agent_id,
            org_id=org_id,
            external_id=agent_id,
            name="Playbook Target Agent",
            framework="LangChain",
            environment="production",
            status="active",
            risk_score=10.0,
            first_seen=now,
            last_seen=now,
        )
        db.add(agent)
        db.commit()
    else:
        agent.status = "active"
        db.commit()

    # 2. Ensure auto-quarantine playbook is active
    pb = db.query(Playbook).filter(
        Playbook.org_id == org_id,
        Playbook.action_type == "quarantine_agent"
    ).first()
    if not pb:
        pb = Playbook(
            id="pb_test_quarantine",
            org_id=org_id,
            name="Test Auto Quarantine",
            trigger_event="alert.created",
            severity_threshold="Critical",
            count_threshold=2,
            time_window_seconds=300,
            action_type="quarantine_agent",
            enabled=True,
        )
        db.add(pb)
        db.commit()
    else:
        pb.count_threshold = 2
        pb.enabled = True
        db.commit()

    # 3. Create two Critical alerts in rapid succession for the agent
    a1 = Alert(
        id="ALT_TEST_PB_1",
        org_id=org_id,
        agent_id=agent.id,
        severity="Critical",
        status="Open",
        risk_score=95.0,
        trigger_type="prompt_injection",
        notes="Critical injection alert 1",
        created_at=now,
    )
    a2 = Alert(
        id="ALT_TEST_PB_2",
        org_id=org_id,
        agent_id=agent.id,
        severity="Critical",
        status="Open",
        risk_score=98.0,
        trigger_type="prompt_injection",
        notes="Critical injection alert 2",
        created_at=now,
    )
    db.add_all([a1, a2])
    db.commit()

    # 4. Trigger Playbook Evaluation
    await PlaybookEngine.evaluate_alert(a2, db)

    # 5. Verify agent was autonomously quarantined
    db.refresh(agent)
    assert agent.status == "quarantined"
    assert "quarantined_by_playbook" in (agent.metadata_json or {})

    # 6. Verify audit log entry was generated
    audit_entry = (
        db.query(AuditLog)
        .filter(AuditLog.action == "playbook.execute", AuditLog.target_id == agent.id)
        .first()
    )
    assert audit_entry is not None
    assert audit_entry.details["action_type"] == "quarantine_agent"
