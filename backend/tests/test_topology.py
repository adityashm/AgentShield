"""
backend/tests/test_topology.py — Tests for Multi-Agent Topology & Dynamic Containment.
Verifies topology graph generation, blast-radius reachability calculation,
and dynamic channel containment/restoration.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models.agent import Agent

DEMO_KEY = "ashield_test_default_demo_key_12345"
HEADERS = {"Authorization": f"Bearer {DEMO_KEY}"}


def test_get_topology_graph(client: TestClient):
    """Verifies that the multi-agent mesh graph is returned with nodes, edges, and resilience metrics."""
    res = client.get("/api/v1/topology/graph", headers=HEADERS)
    assert res.status_code == 200
    data = res.json()

    assert "nodes" in data
    assert "edges" in data
    assert "stats" in data

    nodes = data["nodes"]
    assert len(nodes) >= 6
    for node in nodes:
        assert "id" in node
        assert "role" in node
        assert "status" in node
        assert "risk_score" in node
        assert "blast_radius_score" in node

    edges = data["edges"]
    assert len(edges) >= 5
    for edge in edges:
        assert "source" in edge
        assert "target" in edge
        assert "status" in edge
        assert "protocol" in edge

    stats = data["stats"]
    assert stats["total_nodes"] == len(nodes)
    assert stats["total_edges"] == len(edges)


def test_contain_and_restore_agent(client: TestClient, db: Session):
    """Verifies that containing an agent severs its communication edges and restoring reconnects them."""
    target_id = "AGT-CODE-03"

    # 1. Contain the agent
    contain_payload = {
        "agent_id": target_id,
        "reason": "Suspicious reverse-shell tool call detected",
    }
    res_contain = client.post("/api/v1/topology/contain", json=contain_payload, headers=HEADERS)
    assert res_contain.status_code == 200
    contain_data = res_contain.json()
    assert contain_data["status"] == "contained"
    assert contain_data["severed_channels"] >= 1

    # Verify graph state reflects containment
    res_graph1 = client.get("/api/v1/topology/graph", headers=HEADERS)
    assert res_graph1.status_code == 200
    graph1 = res_graph1.json()
    contained_node = next((n for n in graph1["nodes"] if n["id"] == target_id), None)
    assert contained_node is not None
    assert contained_node["status"] == "quarantined"

    # Check that edges connected to target_id are marked severed
    for edge in graph1["edges"]:
        if edge["source"] == target_id or edge["target"] == target_id:
            assert edge["status"] == "severed"

    # 2. Restore the agent
    restore_payload = {"agent_id": target_id}
    res_restore = client.post("/api/v1/topology/restore", json=restore_payload, headers=HEADERS)
    assert res_restore.status_code == 200
    restore_data = res_restore.json()
    assert restore_data["status"] == "active"
    assert restore_data["restored_channels"] >= 1

    # Verify graph state reflects restoration
    res_graph2 = client.get("/api/v1/topology/graph", headers=HEADERS)
    assert res_graph2.status_code == 200
    graph2 = res_graph2.json()
    restored_node = next((n for n in graph2["nodes"] if n["id"] == target_id), None)
    assert restored_node is not None
    assert restored_node["status"] == "active"


def test_blast_radius_calculation(client: TestClient):
    """Verifies BFS downstream reachability and cascading risk calculation."""
    res = client.get("/api/v1/topology/blast-radius/AGT-COORD-01", headers=HEADERS)
    assert res.status_code == 200
    br = res.json()

    assert br["agent_id"] == "AGT-COORD-01"
    assert "blast_radius_score" in br
    assert br["reachable_agents_count"] >= 1
    assert isinstance(br["reachable_agents"], list)
    assert "containment_recommended" in br


def test_topology_preflight_containment_enforcement(client: TestClient):
    """Verifies that containing an agent via topology blocks pre-flight action evaluation with 403/deny."""
    target_agent = "AGT-TOPOLOGY-ENF"

    # 1. Action is allowed before containment
    eval_pre = client.post(
        "/api/v1/evaluate",
        json={"agent_id": target_agent, "action_type": "read_data", "parameters": {"key": "val"}},
        headers=HEADERS,
    )
    assert eval_pre.status_code == 200
    assert eval_pre.json()["decision"] == "allow"

    # 2. Contain agent via topology
    res_contain = client.post(
        "/api/v1/topology/contain",
        json={"agent_id": target_agent, "reason": "Preflight containment enforcement test"},
        headers=HEADERS,
    )
    assert res_contain.status_code == 200

    # 3. Pre-flight evaluation must now be DENIED
    eval_post = client.post(
        "/api/v1/evaluate",
        json={"agent_id": target_agent, "action_type": "read_data", "parameters": {"key": "val"}},
        headers=HEADERS,
    )
    assert eval_post.status_code == 200
    data = eval_post.json()
    assert data["decision"] == "deny"
    assert "agent_quarantined" in data["reasons"]
    assert data["agent_status"] == "quarantined"

    # 4. Restore agent via topology
    res_restore = client.post(
        "/api/v1/topology/restore",
        json={"agent_id": target_agent},
        headers=HEADERS,
    )
    assert res_restore.status_code == 200

    # 5. Pre-flight evaluation is allowed again
    eval_restored = client.post(
        "/api/v1/evaluate",
        json={"agent_id": target_agent, "action_type": "read_data", "parameters": {"key": "val"}},
        headers=HEADERS,
    )
    assert eval_restored.status_code == 200
    assert eval_restored.json()["decision"] == "allow"


def test_topology_cross_tenant_isolation(client: TestClient, db: Session):
    """Verifies that quarantining an agent in Org A does not quarantine Org B's agent or sever Org B's edges."""
    import asyncio
    from app.services.topology import TopologyService

    # Org A contains AGT-RESEARCH-02
    res_contain = asyncio.run(TopologyService.contain_agent(
        agent_id="AGT-RESEARCH-02",
        reason="Lateral anomaly test in org_test_alpha",
        db=db,
        org_id="org_test_alpha",
    ))
    assert res_contain["status"] == "contained"

    # Org A graph shows quarantined
    graph_a = TopologyService.get_graph(db=db, org_id="org_test_alpha")
    node_a = next(n for n in graph_a["nodes"] if n["id"] == "AGT-RESEARCH-02")
    assert node_a["status"] == "quarantined"

    # Org B graph still shows active!
    graph_b = TopologyService.get_graph(db=db, org_id="org_test_beta")
    node_b = next(n for n in graph_b["nodes"] if n["id"] == "AGT-RESEARCH-02")
    assert node_b["status"] == "active"

