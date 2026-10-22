"""
Unit and integration tests for decoupled Simulator Client, Scenarios, and Demo API.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

from app.main import app
from app.simulator.scenarios import (
    THREAT_SCENARIOS,
    SIMULATED_AGENTS,
    NORMAL_ACTIONS,
    get_scenario,
    generate_random_action,
    generate_batch,
)
from app.simulator.client import SimulatorClient

def test_simulator_scenarios_integrity():
    """Verify all predefined attack scenarios map correctly to OWASP ASI and MITRE ATLAS."""
    assert len(THREAT_SCENARIOS) >= 7
    expected_scenarios = [
        "prompt_injection",
        "db_privilege",
        "sudo_escalation",
        "rate_flood",
        "data_exfil",
        "context_poison",
        "rogue_directive",
    ]
    for sc_key in expected_scenarios:
        assert sc_key in THREAT_SCENARIOS
        sc = THREAT_SCENARIOS[sc_key]
        assert "agent_id" in sc
        assert "action_type" in sc
        assert "parameters" in sc
        assert "owasp_id" in sc
        assert sc["owasp_id"].startswith("ASI")
        assert "mitre_id" in sc
        assert sc["mitre_id"].startswith("AML.T")

def test_get_scenario_lookup():
    sc = get_scenario("prompt_injection")
    assert sc["agent_id"] == "AGT-042"
    with pytest.raises(KeyError):
        get_scenario("non_existent_scenario_123")

def test_random_action_and_batch_generation():
    action = generate_random_action(threat_probability=0.0)
    assert action["is_threat"] is False
    assert "agent_id" in action
    assert "action_type" in action

    threat_action = generate_random_action(threat_probability=1.0)
    assert threat_action["is_threat"] is True
    assert threat_action["scenario_key"] in THREAT_SCENARIOS

    batch = generate_batch(size=5, threat_probability=0.2)
    assert len(batch) == 5
    for item in batch:
        assert "agent_id" in item
        assert "action_type" in item
        assert "parameters" in item

def test_simulator_client_initialization():
    client = SimulatorClient(
        base_url="https://api.example.com",
        api_key="ashield_live_testprefix_secret1234567890",
    )
    assert client.base_url == "https://api.example.com"
    assert client.headers["X-API-Key"] == "ashield_live_testprefix_secret1234567890"
    assert client.is_running is False
    status = client.get_status()
    assert status["running"] is False
    assert status["actions_sent"] == 0

def test_demo_api_endpoints_integration(client: TestClient):
    """Test /api/v1/demo seed and status endpoints."""
    # 1. Seed demo data
    seed_res = client.post("/api/v1/demo/seed")
    assert seed_res.status_code == 200
    data = seed_res.json()
    assert data["status"] == "seeded"
    assert "agents_seeded" in data

    # 2. Check demo status
    status_res = client.get("/api/v1/demo/status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert "running" in status_data
    assert "actions_sent" in status_data
    assert status_data["simulated_agents_count"] == 6

def test_simulator_direct_injection_through_pipeline(client: TestClient):
    """Verify injection directly flows through the real detection pipeline."""
    # Test triggering a scenario through the system simulator inject endpoint
    res = client.post("/api/v1/system/simulator/inject?scenario_index=1")
    assert res.status_code == 200
    res_data = res.json()
    assert "injected_scenario" in res_data
    assert "event" in res_data
    assert res_data["event"]["type"] == "ACTION_EVENT"
    assert "risk" in res_data["event"]
