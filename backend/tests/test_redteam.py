"""
backend/tests/test_redteam.py — Tests for Automated Adversarial Red Teaming & Fuzzing Engine.
Verifies probe catalog retrieval, single probe evaluation, batch assessment execution,
and defense rate calculation.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

DEMO_KEY = "ashield_test_default_demo_key_12345"
HEADERS = {"Authorization": f"Bearer {DEMO_KEY}"}


def test_list_probes_catalog(client: TestClient):
    """Verifies that the full 30+ probe catalog can be listed and filtered by category."""
    # 1. Full catalog
    res = client.get("/api/v1/redteam/probes", headers=HEADERS)
    assert res.status_code == 200
    probes = res.json()
    assert len(probes) >= 30

    expected_categories = {
        "direct_jailbreak",
        "evasion_encoding",
        "indirect_injection",
        "privilege_probing",
        "crescendo_velocity",
    }
    present_categories = {p["category"] for p in probes}
    assert expected_categories.issubset(present_categories)

    # 2. Filter by category
    res_filtered = client.get("/api/v1/redteam/probes?category=direct_jailbreak", headers=HEADERS)
    assert res_filtered.status_code == 200
    filtered = res_filtered.json()
    assert len(filtered) >= 5
    assert all(p["category"] == "direct_jailbreak" for p in filtered)


def test_evaluate_single_probe(client: TestClient):
    """Verifies synchronous single probe evaluation."""
    # Test valid probe
    payload = {"probe_id": "PROBE-JB-001", "agent_id": "AGT-TEST-01"}
    res = client.post("/api/v1/redteam/evaluate-single", json=payload, headers=HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["probe_id"] == "PROBE-JB-001"
    assert data["status"] in ("BLOCKED", "VULNERABLE")
    assert "latency_ms" in data
    assert data["confidence"] > 0.0

    # Test unknown probe ID returns RFC 7807 problem details
    res_bad = client.post("/api/v1/redteam/evaluate-single", json={"probe_id": "NON_EXISTENT"}, headers=HEADERS)
    assert res_bad.status_code == 404
    data_bad = res_bad.json()
    assert "title" in data_bad
    assert "detail" in data_bad
    assert data_bad["status"] == 404
    assert "request_id" in data_bad


def test_execute_redteam_assessment(client: TestClient):
    """Verifies running a batch red team assessment against a target agent."""
    payload = {
        "target_agent_id": "AGT-TARGET-99",
        "categories": ["direct_jailbreak", "evasion_encoding"],
        "broadcast_live": False,
    }
    res = client.post("/api/v1/redteam/execute", json=payload, headers=HEADERS)
    assert res.status_code == 200
    report = res.json()

    assert "run_id" in report
    assert report["target_agent_id"] == "AGT-TARGET-99"
    assert report["total_probes"] >= 10
    assert report["defense_rate"] >= 0.0
    assert report["risk_grade"] in ("A+", "A", "B", "C", "F")
    assert len(report["results"]) == report["total_probes"]
    assert len(report["recommendations"]) >= 1


def test_crescendo_multi_turn_dynamic_evaluation(client: TestClient):
    """Verifies that multi-turn crescendo probes are dynamically evaluated and blocked."""
    payload = {"probe_id": "PROBE-CRES-001", "agent_id": "AGT-CRESCENDO-TEST"}
    res = client.post("/api/v1/redteam/evaluate-single", json=payload, headers=HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["probe_id"] == "PROBE-CRES-001"
    assert data["category"] == "crescendo_velocity"
    assert data["status"] == "BLOCKED"
    assert "CR-01" in data["matched_rule"]


def test_get_redteam_reports(client: TestClient):
    """Verifies retrieving historical red team vulnerability reports."""
    res = client.get("/api/v1/redteam/reports", headers=HEADERS)
    assert res.status_code == 200
    reports = res.json()
    assert isinstance(reports, list)
    assert len(reports) >= 1
    baseline = reports[0]
    assert "run_id" in baseline
    assert "defense_rate" in baseline


def test_redteam_reports_cross_tenant_isolation(db: Session):
    """Verifies that red team assessment reports are strictly tenant-isolated."""
    from app.services.redteam import RedTeamService

    # 1. Run assessment for Org Alpha
    import asyncio
    rep_alpha = asyncio.run(RedTeamService.run_assessment(
        target_agent_id="AGT-ALPHA-01",
        db=db,
        categories=["direct_jailbreak"],
        broadcast_live=False,
        org_id="org_alpha_redteam",
    ))
    assert rep_alpha["org_id"] == "org_alpha_redteam"

    # 2. Query reports for Org Beta: should NOT see Alpha's assessment report
    reports_beta = RedTeamService.get_reports(org_id="org_beta_redteam")
    assert all(r.get("run_id") != rep_alpha["run_id"] for r in reports_beta)

    # 3. Query reports for Org Alpha: must see rep_alpha
    reports_alpha = RedTeamService.get_reports(org_id="org_alpha_redteam")
    assert any(r.get("run_id") == rep_alpha["run_id"] for r in reports_alpha)

