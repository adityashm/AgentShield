"""
backend/tests/test_compliance.py — Tests for Compliance & Governance Dossier API.
"""

import pytest
from fastapi.testclient import TestClient

DEMO_KEY = "ashield_test_default_demo_key_12345"

def test_compliance_report_soc2(client: TestClient):
    """Verifies generation of SOC 2 compliance report with audit chain verification."""
    headers = {"Authorization": f"Bearer {DEMO_KEY}"}
    res = client.get("/api/v1/compliance/report?framework=soc2", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["framework"] == "SOC2"
    assert "cryptographic_audit_chain_valid" in data
    assert "human_oversight_controls" in data
    assert "owasp_coverage" in data
    assert "ASI01" in data["owasp_coverage"]

def test_compliance_report_eu_ai_act(client: TestClient):
    """Verifies generation of EU AI Act Article 14 human oversight compliance dossier."""
    headers = {"Authorization": f"Bearer {DEMO_KEY}"}
    res = client.get("/api/v1/compliance/report?framework=eu_ai_act", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["framework"] == "EU_AI_ACT"
    assert data["human_oversight_controls"]["preflight_fail_closed"] is True
    assert data["human_oversight_controls"]["manual_quarantine_available"] is True
