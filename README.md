# AgentShield AI — Runtime Security & Monitoring for Autonomous AI Agents

[![CI](https://github.com/adityashm/agentshield/actions/workflows/ci.yml/badge.svg)](https://github.com/adityashm/agentshield/actions)
[![Python Version](https://img.shields.io/badge/python-3.11%20%7C%203.12%20%7C%203.13-blue.svg)](https://www.python.org/)
[![React Version](https://img.shields.io/badge/react-18.3-61dafb.svg)](https://react.dev/)
[![OWASP Aligned](https://img.shields.io/badge/OWASP-Agentic%20Top%2010%20(2026)-critical.svg)](https://owasp.org/)
[![MITRE ATLAS](https://img.shields.io/badge/MITRE-ATLAS%20Matrix-orange.svg)](https://atlas.mitre.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**AgentShield AI** is an enterprise-ready, behaviour-based runtime security monitoring and pre-flight policy enforcement platform designed specifically for autonomous AI agents (**LangChain**, **CrewAI**, **OpenAI Agents SDK**, or custom Python agents).

It provides **passive observation** (asynchronous batch telemetry with sub-millisecond host overhead) and **active pre-flight enforcement** (blocking dangerous actions before execution with $p95 < 50\text{ms}$ latency and explicit fail-open/fail-closed semantics).

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph ClientLayer["AI Agent Runtime"]
        Agent["Autonomous Agent (LangChain / CrewAI / OpenAI)"]
        SDK["AgentShield Python SDK (agentshield)"]
        Redact["Secret Redaction (API Keys, Tokens, JWTs)"]
        Guard["Pre-Flight Guard (Enforce Mode)"]
        Queue["Async Batch Queue (Observe Mode)"]
        
        Agent --> SDK
        SDK --> Redact
        Redact --> Guard
        Redact --> Queue
    end

    subgraph EdgeGateway["Single-Origin Reverse Proxy (:8080)"]
        Nginx["Nginx 1.27 Reverse Proxy"]
        Dashboard["Mission Control React 18 SPA"]
    end

    subgraph CoreBackend["AgentShield Core (FastAPI / Python 3.13)"]
        Auth["Multi-Tenant Gateway (API Keys / Argon2id)"]
        Norm["Normalization & Deobfuscation (NFKC / Homoglyphs)"]
        DSL["AST JSON-DSL Rules Engine (OWASP ASI 2026)"]
        ML["Calibrated Isolation Forest Anomaly Engine"]
        Scorer["Composite Risk Scorer"]
        Bus["Realtime Telemetry Event Bus"]
        Worker["Transactional Webhook Outbox Worker"]
    end

    subgraph StorageLayer["Persistence & Cryptographic Verification"]
        Postgres[("PostgreSQL 16 Relational Store")]
        AuditChain[("Cryptographic SHA-256 Audit Hash Chain")]
    end

    subgraph IncidentResponse["Incident Response Integrations"]
        Slack["Slack Block Kit"]
        Discord["Discord Embeds"]
        PagerDuty["PagerDuty Events v2"]
        Webhook["Generic HMAC-Signed"]
    end

    Queue -->|POST /actions/batch| Nginx
    Guard -->|POST /evaluate (p95 < 50ms)| Nginx
    Nginx --> Dashboard
    Nginx -->|Proxy /api/* & /ws| Auth

    Auth --> Norm
    Norm --> DSL
    Norm --> ML
    DSL --> Scorer
    ML --> Scorer
    Scorer --> Postgres
    Scorer --> AuditChain
    Scorer --> Bus
    Scorer --> Worker

    Bus -->|WebSocket /ws| Dashboard
    Worker --> Slack
    Worker --> Discord
    Worker --> PagerDuty
    Worker --> Webhook
```

---

## ⚡ Quickstart (Under 5 Minutes)

### 1. Launch Production Stack with Docker Compose
```bash
git clone https://github.com/adityashm/agentshield.git
cd agentshield

# Copy canonical environment defaults
cp .env.example .env

# Build and start PostgreSQL, FastAPI Core, and Nginx Web Gateway
docker compose up --build -d
```
Open **[http://localhost:8080](http://localhost:8080)** to access the **Mission Control Dashboard**.
- **Admin Credentials**: `admin@agentshield.ai` / `AdminPass123!`
- **Pre-Seeded API Key**: `ashield_test_default_demo_key_12345`

---

### 2. Instrument Your AI Agents with the Python SDK
Install the SDK in your agent environment:
```bash
pip install ./sdk/python[all]
```

#### Enforce Mode (Pre-Flight Guardrails)
```python
from agentshield import AgentShield
from agentshield.guard import ShieldSecurityViolationException

shield = AgentShield(
    base_url="http://localhost:8080",
    api_key="ashield_test_default_demo_key_12345",
    mode="enforce",
    fail_open=False,
)

# Intercept and evaluate a tool call synchronously
try:
    shield.evaluate(
        agent_id="my-agent-01",
        action_type="bash_exec",
        parameters={"command": "rm -rf /sys/root && /bin/sh -i"},
    )
except ShieldSecurityViolationException as e:
    print(f"🛑 [BLOCKED] Action denied by AgentShield policy! Risk: {e.risk_score}")
```

#### Observe Mode (Passive Non-Blocking Telemetry)
```python
# Decorate existing functions — zero slowdown
@shield.monitor(action_type="database_query", tool_name="fetch_records")
def query_db(table: str):
    return db.query(f"SELECT * FROM {table}")
```

---

### 3. Run Real Offline Demos (Zero Paid API Keys Required)
The repository provides 4 self-contained offline demonstrations:
```bash
# Real LangChain agent handling queries and catching prompt injection
python examples/langchain_agent_demo.py

# CrewAI multi-agent crew blocking inter-agent data exfiltration
python examples/crewai_demo.py

# OpenAI Agents SDK tool execution and bash code protection
python examples/openai_agents_demo.py

# 5 targeted attack scenarios across OWASP ASI01-ASI05 (5/5 blocked)
python examples/attack_scenarios.py
```

---

## 🎯 Threat Detection Engine

AgentShield provides defense-in-depth across 4 progressive layers:

1. **Normalization & Deobfuscation (`normalize.py`)**:
   - Unicode NFKC canonical normalization.
   - Zero-width character stripping (`\u200B`, `\uFEFF`, etc.).
   - Confusable homoglyph translation (Cyrillic and Greek lookalikes normalized to Latin).
   - Recursive decoding (URL percent-encoding, Hex, and Base64 segments up to depth $\le 3$).
2. **Safe AST JSON-DSL Rules Engine (`dsl.py`, `rules_engine.py`)**:
   - 20 default production security rules mapped to **OWASP Top 10 for Agentic Applications 2026** (`ASI01`–`ASI10`) and **MITRE ATLAS** (`AML.T0051`–`AML.T0110`).
   - Evaluates boolean trees (`and`, `or`, `not`), containment, regexes, and Shannon entropy without `eval()` or `exec()`.
3. **Calibrated Hierarchical Isolation Forest (`ml.py`)**:
   - Scores 9-dimensional behavioral feature vectors.
   - Maps raw path length scores to an intuitive $[0.0, 1.0]$ probability scale using empirical median ($p_{50}$) and 99th percentile ($p_{99}$) quantiles of normal traffic.
   - Hierarchical model fallback: Agent-specific model $\to$ Organization model $\to$ Global baseline.
4. **Composite Recency-Weighted Scoring (`scoring.py`)**:
   $$\text{Risk Score} = 0.4 \times \text{RuleScore} + 0.6 \times (\text{AnomalyScore} \times 100)$$
   - Guardrail block floor: Critical rule violations immediately floor risk at $90.0$.
   - Rolling recency-weighted decay over the agent's last 20 actions.

---

## 🛡️ Enterprise Features

- **Cryptographic API Keys**: 256 bits of entropy, stored exclusively as peppered HMAC-SHA256 hashes, with 24-hour overlap grace windows for zero-downtime key rotation.
- **Transactional Webhook Outbox**: Staged in `webhook_deliveries` within the database transaction; background worker delivers to **Slack Block Kit**, **Discord**, **PagerDuty Events v2**, and **HMAC-signed Generic Webhooks** with built-in SSRF defense filtering.
- **Tamper-Evident SHA-256 Audit Log**: Continuous cryptographic hash chain verifiable via `GET /api/v1/audit-log/verify` and visual Merkle-style parent inspector.
- **Zero Heavy Infrastructure**: Runs entirely on **PostgreSQL 16**. No Redis, Kafka, or Celery required.

---

## 📊 Verification & Test Evidence

All test suites and benchmarks pass cleanly:

```bash
# Run backend test suite (39/39 passed in 2.77s)
make test

# Run Python SDK test suite (25/25 passed with 86% coverage)
make sdk-test

# Run 80-sample attack corpus benchmark (100% precision, 100% recall)
python backend/tests/corpus/test_detection_corpus.py

# Benchmark pre-flight /evaluate latency against target budget (p95 < 50ms)
make loadtest

# Run autonomous agent simulator demo stream
make demo
```

---

## 📚 Documentation Directory

Comprehensive architectural, operational, and academic guides are located in `docs/`:

- [**System Architecture (`docs/ARCHITECTURE.md`)**](docs/ARCHITECTURE.md) — Detailed component breakdown, data flow, ML formulas, and constraints.
- [**REST API & WebSocket Specification (`docs/API.md`)**](docs/API.md) — Complete endpoint reference, schemas, headers, and error codes.
- [**Python SDK Developer Guide (`docs/SDK.md`)**](docs/SDK.md) — SDK installation, `@monitor`, `@enforce`, secret redaction, and framework listeners.
- [**Threat Model & Taxonomy (`docs/THREAT_MODEL.md`)**](docs/THREAT_MODEL.md) — OWASP Top 10 for Agentic Applications 2026 and MITRE ATLAS matrix.
- [**Production Deployment Runbook (`docs/DEPLOYMENT.md`)**](docs/DEPLOYMENT.md) — Multi-stage containers, Nginx reverse proxy, TLS, and disaster recovery.
- [**Academic Defense & Viva Voce Guide (`docs/VIVA.md`)**](docs/VIVA.md) — Examiner Q&A, mathematical proofs, and 7-minute demonstration walkthrough.
- [**Final Engineering Report (`docs/FINAL_REPORT.md`)**](docs/FINAL_REPORT.md) — Complete technical program delivery report.
- [**Architectural Decisions Log (`docs/DECISIONS.md`)**](docs/DECISIONS.md) — Dated record of all architectural tradeoffs.
- [**Engineering Progress Log (`docs/PROGRESS.md`)**](docs/PROGRESS.md) — Chronological test outputs and phase completion logs.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
