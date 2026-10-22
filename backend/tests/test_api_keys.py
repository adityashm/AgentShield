from fastapi.testclient import TestClient

def test_api_key_generation_and_auth(client: TestClient):
    # 1. Generate an API Key
    payload = {
        "name": "Production Agent Fleet Key",
        "is_test": False,
        "scopes": "actions:write,alerts:read",
    }
    create_res = client.post("/api/v1/api-keys", json=payload)
    assert create_res.status_code == 200
    key_data = create_res.json()
    assert "api_key" in key_data
    assert key_data["api_key"].startswith("ashield_live_")
    raw_key = key_data["api_key"]

    # 2. Use the generated API Key to ingest an action
    action_payload = {
        "agent_id": "AGT-KEY-TEST-01",
        "action_type": "database_query",
        "parameters": {"query": "SELECT count(*) FROM metrics"},
    }
    ingest_res = client.post(
        "/api/v1/actions",
        json=action_payload,
        headers={"X-API-Key": raw_key},
    )
    assert ingest_res.status_code == 200
    assert ingest_res.json()["agent_id"] == "AGT-KEY-TEST-01"

    # 3. Test synchronous pre-flight evaluate endpoint (SDK enforce mode)
    eval_payload = {
        "agent_id": "AGT-KEY-TEST-01",
        "action_type": "file_read",
        "parameters": {"path": "/etc/shadow"},
    }
    eval_res = client.post(
        "/api/v1/actions/evaluate",
        json=eval_payload,
        headers={"Authorization": f"Bearer {raw_key}"},
    )
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert eval_data["decision"] == "deny"
    assert "RUL-001" in eval_data["violated_rules"]

def test_invalid_api_key_rejected(client: TestClient):
    action_payload = {
        "agent_id": "AGT-KEY-TEST-02",
        "action_type": "heartbeat_ok",
        "parameters": {},
    }
    res = client.post(
        "/api/v1/actions",
        json=action_payload,
        headers={"X-API-Key": "ashield_live_fake_invalid_token_999"},
    )
    assert res.status_code == 401

def test_api_key_rotation_and_grace_period(client: TestClient):
    # 1. Create initial key
    create_res = client.post("/api/v1/api-keys", json={
        "name": "Rotation Fleet Key",
        "scopes": "ingest,evaluate",
    })
    assert create_res.status_code == 200
    key1_data = create_res.json()
    key1_raw = key1_data["api_key"]
    key1_id = key1_data["key_id"]

    # 2. Ingest with key1 works
    res1 = client.post(
        "/api/v1/actions",
        json={"agent_id": "AGT-ROT-01", "action_type": "heartbeat", "parameters": {}},
        headers={"X-API-Key": key1_raw},
    )
    assert res1.status_code == 200

    # 3. Rotate key1 -> key2
    rotate_res = client.post(f"/api/v1/api-keys/{key1_id}/rotate")
    assert rotate_res.status_code == 200
    key2_data = rotate_res.json()
    key2_raw = key2_data["api_key"]
    assert key2_raw != key1_raw

    # 4. Grace overlap: BOTH key1 and key2 work
    res_key1_grace = client.post(
        "/api/v1/actions",
        json={"agent_id": "AGT-ROT-01", "action_type": "heartbeat", "parameters": {}},
        headers={"X-API-Key": key1_raw},
    )
    assert res_key1_grace.status_code == 200

    res_key2_grace = client.post(
        "/api/v1/actions",
        json={"agent_id": "AGT-ROT-01", "action_type": "heartbeat", "parameters": {}},
        headers={"X-API-Key": key2_raw},
    )
    assert res_key2_grace.status_code == 200

    # 5. Revoke key1
    rev_res = client.post(f"/api/v1/api-keys/{key1_id}/revoke")
    assert rev_res.status_code == 200

    # 6. key1 is rejected with 401, key2 still works
    res_key1_rev = client.post(
        "/api/v1/actions",
        json={"agent_id": "AGT-ROT-01", "action_type": "heartbeat", "parameters": {}},
        headers={"X-API-Key": key1_raw},
    )
    assert res_key1_rev.status_code == 401

    res_key2_after = client.post(
        "/api/v1/actions",
        json={"agent_id": "AGT-ROT-01", "action_type": "heartbeat", "parameters": {}},
        headers={"X-API-Key": key2_raw},
    )
    assert res_key2_after.status_code == 200

def test_batch_ingest_idempotency(client: TestClient):
    create_res = client.post("/api/v1/api-keys", json={
        "name": "Batch Key",
        "scopes": "ingest,evaluate",
    })
    raw_key = create_res.json()["api_key"]

    batch_payload = {
        "events": [
            {"event_id": "evt-idemp-01", "agent_id": "AGT-IDEMP-01", "action_type": "ping", "parameters": {}},
            {"event_id": "evt-idemp-02", "agent_id": "AGT-IDEMP-01", "action_type": "pong", "parameters": {}},
            {"event_id": "evt-idemp-01", "agent_id": "AGT-IDEMP-01", "action_type": "ping", "parameters": {}},  # duplicate
        ]
    }
    batch_res = client.post(
        "/api/v1/actions/batch",
        json=batch_payload,
        headers={"X-API-Key": raw_key},
    )
    assert batch_res.status_code == 202
    data = batch_res.json()
    assert data["accepted"] == 2
    assert data["duplicates"] == 1

    # Send again: all duplicates
    res2 = client.post(
        "/api/v1/actions/batch",
        json=batch_payload,
        headers={"X-API-Key": raw_key},
    )
    assert res2.status_code == 202
    assert res2.json()["accepted"] == 0
    assert res2.json()["duplicates"] == 3

def test_quarantine_halt_and_evaluate_enforcement(client: TestClient):
    # Setup key and agent
    create_res = client.post("/api/v1/api-keys", json={
        "name": "Enforce Key",
        "scopes": "ingest,evaluate",
    })
    raw_key = create_res.json()["api_key"]

    # Initial benign evaluate -> allow
    eval_res = client.post(
        "/api/v1/evaluate",
        json={"agent_id": "AGT-ENF-01", "action_type": "calc", "parameters": {"expr": "1+1"}},
        headers={"Authorization": f"Bearer {raw_key}"},
    )
    assert eval_res.status_code == 200
    assert eval_res.json()["decision"] == "allow"

    # Quarantine agent
    q_res = client.post("/api/v1/agents/AGT-ENF-01/quarantine", json={"reason": "Suspicious activity detected"})
    assert q_res.status_code == 200
    assert q_res.json()["status"] == "quarantined"

    # Evaluate now denied
    eval_q = client.post(
        "/api/v1/evaluate",
        json={"agent_id": "AGT-ENF-01", "action_type": "calc", "parameters": {"expr": "1+1"}},
        headers={"Authorization": f"Bearer {raw_key}"},
    )
    assert eval_q.status_code == 200
    assert eval_q.json()["decision"] == "deny"
    assert "agent_quarantined" in eval_q.json()["reasons"]

    # Release agent
    rel_res = client.post("/api/v1/agents/AGT-ENF-01/release", json={"reason": "Analyst verified benign"})
    assert rel_res.status_code == 200
    assert rel_res.json()["state"] == "active"

    # Evaluate allowed again
    eval_rel = client.post(
        "/api/v1/evaluate",
        json={"agent_id": "AGT-ENF-01", "action_type": "calc", "parameters": {"expr": "1+1"}},
        headers={"Authorization": f"Bearer {raw_key}"},
    )
    assert eval_rel.status_code == 200
    assert eval_rel.json()["decision"] == "allow"

    # Halt agent
    halt_res = client.post("/api/v1/agents/AGT-ENF-01/halt", json={"reason": "Emergency freeze"})
    assert halt_res.status_code == 200
    assert halt_res.json()["state"] == "halted"

    # Evaluate denied due to halt
    eval_halt = client.post(
        "/api/v1/evaluate",
        json={"agent_id": "AGT-ENF-01", "action_type": "calc", "parameters": {"expr": "1+1"}},
        headers={"Authorization": f"Bearer {raw_key}"},
    )
    assert eval_halt.status_code == 200
    assert eval_halt.json()["decision"] == "deny"
    assert "agent_halted" in eval_halt.json()["reasons"]

