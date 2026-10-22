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
