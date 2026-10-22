# AgentShield AI — REST API & WebSocket Specification

> **Base URL**: `http://localhost:8080/api/v1` (via Nginx) or `http://localhost:8000/api/v1` (direct API)  
> **OpenAPI Specification**: `frontend/src/api/openapi.json`  
> **Standard Error Format**: RFC 7807 (`application/problem+json`)  

---

## 1. Authentication & Common Headers

### 1.1 API Key Authentication (AI Agents & SDKs)
Include your organization API key in the `X-API-Key` or `Authorization: Bearer` header:
```http
X-API-Key: ashield_live_a1b2c3d4_8f9e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9
```

### 1.2 User JWT Authentication (Dashboard & Admin APIs)
Interactive dashboard routes authenticate via standard Bearer tokens or HttpOnly `access_token` cookies:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 1.3 RFC 7807 Error Response Schema
All errors return uniform problem details:
```json
{
  "type": "https://agentshield.ai/errors/rate-limit-exceeded",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "Rate limit of 600 req/min exceeded. Please retry after 12 seconds.",
  "instance": "/api/v1/actions",
  "request_id": "req_f839a0c2e4b1",
  "retry_after": 12
}
```

---

## 2. Telemetry Ingestion & Policy Evaluation

### 2.1 Pre-Flight Policy Evaluation (Enforce Mode)
Synchronously evaluates an intended tool call or prompt action prior to execution.

- **Method**: `POST`
- **Path**: `/api/v1/evaluate` (alias `/api/v1/actions/evaluate`)
- **Required Header**: `X-API-Key` with `evaluate` or `all` scope
- **Latency SLA**: $p95 < 50\text{ms}$

#### Request Payload:
```json
{
  "agent_id": "AGT-042",
  "action_type": "database_query",
  "tool_name": "sql_query_executor",
  "parameters": {
    "query": "SELECT username, password_hash FROM users WHERE role = 'admin'",
    "target_table": "users"
  },
  "session_id": "sess_89a0b1c2",
  "persist": true
}
```

#### Response Payload (200 OK — Allowed):
```json
{
  "decision": "ALLOW",
  "risk_score": 14.2,
  "severity": "low",
  "reasons": ["Action matches expected baseline database querying patterns."],
  "matched_rules": [],
  "agent_status": "active",
  "evaluation_id": "eval_38c92a11b0e4",
  "persisted": true,
  "anomaly_score": 0.08
}
```

#### Response Payload (200 OK — Denied / Blocked):
```json
{
  "decision": "DENY",
  "risk_score": 92.5,
  "severity": "critical",
  "reasons": [
    "Blocked by Rule: System File Access Attempt (OWASP ASI03)",
    "ML Anomaly score exceeded high severity threshold (0.84)"
  ],
  "matched_rules": [
    {
      "id": "RULE-SYS-001",
      "name": "System File Access Attempt",
      "severity": "critical",
      "owasp_category": "ASI03",
      "mitre_technique": "AML.T0098"
    }
  ],
  "agent_status": "active",
  "evaluation_id": "eval_7f9a12c4d8e0",
  "persisted": true,
  "anomaly_score": 0.84,
  "violated_rules": ["RULE-SYS-001"]
}
```

---

### 2.2 Batch Action Ingestion (Observe Mode)
Asynchronously ingests batches of completed agent actions for passive monitoring and audit logging.

- **Method**: `POST`
- **Path**: `/api/v1/actions/batch`
- **Required Header**: `X-API-Key` with `ingest` or `all` scope

#### Request Payload:
```json
[
  {
    "event_id": "evt_001",
    "agent_id": "AGT-009",
    "agent_name": "Security Research Agent",
    "framework": "langchain",
    "action_type": "file_read",
    "parameters": {
      "path": "/var/log/audit.log",
      "bytes": 2048
    },
    "timestamp": "2026-10-22T12:00:00Z"
  },
  {
    "event_id": "evt_002",
    "agent_id": "AGT-001",
    "agent_name": "Financial Data Sync",
    "framework": "crewai",
    "action_type": "data_sync",
    "parameters": {
      "records_synced": 150,
      "table": "customer_ledger"
    },
    "timestamp": "2026-10-22T12:00:01Z"
  }
]
```

#### Response Payload (200 OK):
```json
{
  "accepted": 2,
  "duplicates": 0,
  "agent_status": "active",
  "results": [
    {
      "event_id": "evt_001",
      "risk_score": 12.0,
      "severity": "low",
      "decision": "allow",
      "matched_rules": []
    },
    {
      "event_id": "evt_002",
      "risk_score": 8.5,
      "severity": "low",
      "decision": "allow",
      "matched_rules": []
    }
  ]
}
```

---

## 3. Agent Administration & Containment

### 3.1 List Monitored Agents
- **Method**: `GET`
- **Path**: `/api/v1/agents`
- **Query Params**: `status` (`active`, `quarantined`, `halted`), `search`, `limit`, `offset`

```http
GET /api/v1/agents?status=active HTTP/1.1
Authorization: Bearer <token>
```

#### Response (200 OK):
```json
[
  {
    "id": "org_default_AGT-042",
    "external_id": "AGT-042",
    "name": "Customer Support LLM",
    "framework": "langchain",
    "environment": "production",
    "status": "active",
    "risk_score": 18.4,
    "first_seen": "2026-10-20T08:30:00Z",
    "last_seen": "2026-10-22T12:15:30Z",
    "is_synthetic": false,
    "actions_count": 1420,
    "alerts_count": 2
  }
]
```

---

### 3.2 Containment Actions (Quarantine & Emergency Halt)
Security analysts can immediately isolate compromised agents:

| Action | Endpoint | Resulting Status | Evaluation Behavior |
|---|---|---|---|
| **Quarantine** | `POST /api/v1/agents/{id}/quarantine` | `quarantined` | All write/tool actions denied; read-only permitted |
| **Emergency Halt** | `POST /api/v1/agents/{id}/halt` | `halted` | **100% of actions denied immediately** |
| **Release** | `POST /api/v1/agents/{id}/release` | `active` | Normal policy evaluation restored |

#### Request Example (Quarantine):
```http
POST /api/v1/agents/org_default_AGT-014/quarantine HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Suspicious reverse shell invocation detected in bash tool executor."
}
```

*Note: All containment status changes write a cryptographic entry to the tamper-evident audit log.*

---

## 4. Alert Triage & Incident Response

### 4.1 List Security Alerts
- **Method**: `GET`
- **Path**: `/api/v1/alerts`
- **Query Params**: `status` (`Open`, `Acknowledged`, `Resolved`), `severity` (`Critical`, `High`, `Medium`, `Low`), `agent_id`

### 4.2 Analyst Discussion Thread
Analysts can post notes and coordinate response directly on an alert:
- **Method**: `POST`
- **Path**: `/api/v1/alerts/{alert_id}/comments`

#### Request Payload:
```json
{
  "content": "Quarantined agent AGT-014 while investigating upstream model provider output."
}
```

#### Response (201 Created):
```json
{
  "id": "cmt_98a7b6c5",
  "alert_id": "ALT-A9B1C2",
  "user_name": "Aditya Sharma",
  "user_email": "admin@agentshield.ai",
  "content": "Quarantined agent AGT-014 while investigating upstream model provider output.",
  "created_at": "2026-10-22T12:20:00Z"
}
```

---

## 5. Security Detection Rules & Test Sandbox

### 5.1 Interactive Rule Sandbox Evaluation
Test custom rules or sample payloads in real time without storing actions:
- **Method**: `POST`
- **Path**: `/api/v1/rules/sandbox/evaluate`

#### Request Payload:
```json
{
  "rule_id": "RULE-SYS-001",
  "action_payload": {
    "action_type": "file_read",
    "parameters": {
      "path": "/etc/shadow"
    }
  }
}
```

#### Response (200 OK):
```json
{
  "matched": true,
  "rule_id": "RULE-SYS-001",
  "rule_name": "System File Access Attempt",
  "severity": "critical",
  "reason": "String match: path contains '/etc/shadow'",
  "evaluation_time_ms": 0.42
}
```

---

## 6. Cryptographic Audit Log & Verification

### 6.1 Cryptographic Hash Chain Verification
Verifies the unbroken Merkle-style hash chain across all security-sensitive operations:
- **Method**: `GET`
- **Path**: `/api/v1/audit-log/verify`

#### Response (200 OK):
```json
{
  "status": "verified",
  "is_valid": true,
  "total_records": 184,
  "genesis_hash": "0000000000000000000000000000000000000000000000000000000000000000",
  "latest_block_hash": "7f9a2b4c6e8d1029384756abcdef0123456789abcdef0123456789abcdef0123",
  "message": "Cryptographic hash chain is completely unbroken. Zero tampering detected."
}
```

---

## 7. Webhook Integrations & Outbox

### 7.1 Register Destination Webhook
- **Method**: `POST`
- **Path**: `/api/v1/webhooks`

#### Request Payload (Slack Example):
```json
{
  "name": "SOC Slack Channel",
  "type": "slack",
  "url": "https://hooks.slack.com/services/T000/B000/XXXX",
  "min_severity": "High",
  "event_types": ["alert.created", "agent.quarantined"]
}
```

#### Request Payload (Generic HMAC-Signed Webhook Example):
```json
{
  "name": "Enterprise SIEM Webhook",
  "type": "generic",
  "url": "https://siem.corp.internal/webhook/agentshield",
  "secret": "super_secret_signing_key_32_bytes",
  "min_severity": "Medium",
  "event_types": ["alert.created"]
}
```

#### Signature Verification:
For generic webhooks, AgentShield includes the `X-AgentShield-Signature` header:
```
X-AgentShield-Signature: t=1761134400,v1=3b7d829cf...
```
Verify the signature:
$$\text{Signature} = \text{HMAC-SHA256}(\text{secret}, \text{"t="} \parallel t \parallel \text{"."} \parallel \text{raw\_body})$$

---

## 8. Autonomous Demo & Simulation Management

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/demo/start` | `POST` | Starts continuous autonomous agent simulator task |
| `/api/v1/demo/stop` | `POST` | Halts continuous autonomous agent simulator task |
| `/api/v1/demo/status` | `GET` | Returns running state, actions dispatched, uptime |
| `/api/v1/demo/seed` | `POST` | Idempotently seeds 6 simulated agents and baseline telemetry |

---

## 9. Real-Time WebSocket Streaming

AgentShield provides real-time event streaming over WebSockets:

| Path | Description |
|---|---|
| `/ws` | Global organization telemetry stream |
| `/ws/agent/{agent_id}` | Isolated stream dedicated to a specific agent |

### In-Message Authentication
Clients can authenticate immediately upon connection by sending an initial authentication frame:
```json
{
  "type": "AUTH",
  "token": "<JWT_ACCESS_TOKEN>"
}
```
Or with an API key:
```json
{
  "type": "AUTH",
  "api_key": "<ORGANIZATION_API_KEY>"
}
```

### Event Payload Schema
```json
{
  "type": "ACTION_EVENT",
  "action_id": "act_89a0b1c2",
  "agent": "AGT-042",
  "action": "database_query",
  "risk": 18.5,
  "anomaly": 0.08,
  "tone": "success",
  "time": "12:34:56.789",
  "status": "Normal",
  "alert": null
}
```
