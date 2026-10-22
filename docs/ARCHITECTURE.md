# AgentShield AI — System Architecture & Design Specification

> **Version**: 1.0.0-production  
> **Status**: Verified Production-Shaped Architecture  
> **Standards Alignment**: OWASP Top 10 for Agentic Applications 2026, MITRE ATLAS, RFC 7807, RFC 6962  

---

## 1. Executive Summary

Autonomous AI agents powered by Large Language Models (LLMs) operate in probabilistic execution spaces. Unlike traditional deterministic software, an agent's control flow is directed by dynamic reasoning loops (ReAct, plan-and-solve, multi-agent debate). When agents are granted tool execution permissions—such as filesystem access, database operations, shell command execution, and HTTP networking—they expose an expansive attack surface to prompt injections, goal hijacking, privilege abuse, and unauthorized data exfiltration.

**AgentShield AI** is an enterprise-ready, behaviour-based runtime security monitoring and pre-flight policy enforcement platform designed specifically for autonomous AI agents (LangChain, CrewAI, OpenAI Agents SDK, and custom Python agents).

### Key Architectural Pillars
- **Dual Operational Modes**:
  - **Observe Mode**: Asynchronous, non-blocking telemetry ingestion with local client batching, sliding windows, and sub-millisecond host overhead.
  - **Enforce Mode**: Synchronous pre-flight policy evaluation (`/evaluate`) capable of blocking unauthorized or adversarial actions before execution with strict latency budgets ($p95 < 50\text{ms}$) and configurable fail-open/fail-closed semantics.
- **Layered Threat Detection Engine**:
  - Multi-stage input normalization (NFKC Unicode normalization, zero-width stripping, recursive decoding, confusable homoglyph translation).
  - Safe Abstract Syntax Tree (AST) JSON-DSL rules engine with ReDoS protection.
  - Hierarchical, quantile-calibrated **Isolation Forest** anomaly detection ($[0, 1]$ calibrated probability).
  - Explainable composite risk scoring combining deterministic rule violations with probabilistic behavioral anomalies.
- **Enterprise Multi-Tenancy & Incident Response**:
  - Cryptographic API keys (256-bit entropy, peppered HMAC-SHA256 indexing, zero plaintext persistence, 24-hour zero-downtime rotation window).
  - Transactional webhook outbox pattern with Server-Side Request Forgery (SSRF) defense delivering to Slack Block Kit, Discord embeds, PagerDuty Events API v2, and generic HMAC-signed endpoints.
  - Tamper-evident cryptographic SHA-256 hash-chained audit log verifiable via Merkle-style contiguous parent hash trees.
  - Single-origin Nginx gateway proxying React 18 dark-mode Mission Control dashboard, REST APIs, and low-latency WebSockets.

---

## 2. High-Level System Architecture

```mermaid
flowchart TD
    subgraph ClientProcess["Customer AI Agent Environment"]
        Agent["Autonomous Agent (LangChain / CrewAI / OpenAI)"]
        SDK["AgentShield Python SDK (agentshield)"]
        Redact["Secret Redaction (API Keys, JWTs, Tokens)"]
        Guard["Pre-Flight Guard (Enforce Mode)"]
        Queue["Async Batch Queue (Observe Mode)"]
        
        Agent --> SDK
        SDK --> Redact
        Redact --> Guard
        Redact --> Queue
    end

    subgraph EdgeGateway["Single-Origin Reverse Proxy (Port 8080)"]
        Nginx["Nginx 1.27 Gateway"]
        Dashboard["React 18 Mission Control SPA"]
    end

    subgraph CoreBackend["AgentShield Core (FastAPI / Python 3.13)"]
        Auth["Auth & Multi-Tenancy Gateway (Argon2id / API Keys)"]
        Norm["Normalization & Deobfuscation Pipeline"]
        DSL["AST JSON-DSL Rules Engine (OWASP ASI 2026)"]
        ML["Calibrated Isolation Forest (Agent/Org/Global)"]
        Scorer["Composite Risk Scorer (0.4 Rule + 0.6 ML*100)"]
        Bus["Realtime Telemetry Event Bus"]
        Worker["Transactional Webhook Outbox Worker"]
    end

    subgraph StorageLayer["Persistence & Cryptographic Verification"]
        Postgres[("PostgreSQL 16 (Relational + JSONB)")]
        AuditChain[("Cryptographic SHA-256 Audit Log")]
    end

    subgraph IncidentResponse["External Incident Notification"]
        Slack["Slack Block Kit"]
        Discord["Discord Webhooks"]
        PagerDuty["PagerDuty Events API v2"]
        Webhook["HMAC-SHA256 Generic Webhook"]
    end

    Queue -->|HTTPS POST /actions/batch| Nginx
    Guard -->|HTTPS POST /evaluate (p95 < 50ms)| Nginx
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
    
    Bus -->|WebSocket Stream /ws| Dashboard
    Worker --> Slack
    Worker --> Discord
    Worker --> PagerDuty
    Worker --> Webhook
```

---

## 3. Detailed Component Decomposition

### 3.1 Ingress & Multi-Tenancy Layer
- **Authentication Mechanisms**:
  - **Dashboard Users**: Authenticate via `POST /api/v1/auth/login` receiving Argon2id hashed passwords, signed JWT access tokens (15-minute expiration), and HttpOnly cookie refresh tokens with single-use rotation.
  - **Agent Telemetry & Pre-Flight Clients**: Authenticate via `X-API-Key` or `Authorization: Bearer <key>` header.
- **Cryptographic API Key Storage**:
  - Format: `ashield_{env}_{prefix8}_{secret43}`.
  - Keys are generated with 256 bits of cryptographically secure random entropy (`secrets.token_urlsafe(32)`).
  - The plaintext key is returned strictly once upon generation.
  - Database stores only an HMAC-SHA256 hash keyed by a server-side pepper secret (`API_KEY_PEPPER`), with `prefix` indexed for fast $O(1)$ constant-time lookup.
- **Tenant Isolation**:
  - Every tenant entity (`organizations`, `users`, `agents`, `actions`, `alerts`, `rules`, `api_keys`, `webhook_endpoints`, `audit_log`) contains a mandatory `org_id` foreign key.
  - Every SQL query touches only tenant-owned data partitioned by `org_id`.

### 3.2 Threat Detection Engine

The threat detection pipeline evaluates incoming agent actions in three progressive layers:

#### Layer 1: Normalization & Deobfuscation (`normalize.py`)
Adversaries attempt evasion through zero-width characters, homoglyphs, URL encoding, hex encoding, and base64 payloads. The normalization pipeline runs prior to any rule matching:
1. **Unicode NFKC Normalization**: Canonical decomposition followed by canonical composition (`unicodedata.normalize('NFKC', text)`).
2. **Zero-Width Stripping**: Strips zero-width spaces (`\u200B`), non-breaking spaces, word joiners (`\u2060`), and byte order marks (`\uFEFF`).
3. **Confusable Homoglyph Translation**: Normalizes Cyrillic and Greek lookalikes (e.g., Cyrillic 'а', 'е', 'о', 'р' mapped to Latin 'a', 'e', 'o', 'p').
4. **Bounded Recursive Decoding**: Recursively decodes URL percent-encoding, HTML entities, hex escapes (`\x41`), and base64 segments up to a maximum recursion depth of 3 and input size limit of 64KB.

#### Layer 2: Safe AST JSON-DSL Rules Engine (`dsl.py`, `rules_engine.py`)
Static signatures evaluate agent tool parameters against deterministic policy rules:
- Built with an Abstract Syntax Tree (AST) interpreter that does not use `eval()` or `exec()`.
- Implements boolean tree logic (`and`, `or`, `not`) with comparison operators (`==`, `!=`, `<`, `>`, `<=`, `>=`), string operators (`contains`, `icontains`, `contains_any`, `contains_all`, `starts_with`, `ends_with`), regex patterns (with pre-compiled limits preventing Regular Expression Denial of Service / ReDoS), Shannon entropy thresholding (`has_entropy_above`), and length bounds (`length_gt`).
- Mapped to **OWASP Top 10 for Agentic Applications 2026** (`ASI01` through `ASI10`) and **MITRE ATLAS** techniques (`AML.T0051`, `AML.T0053`, `AML.T0086`, `AML.T0101`, `AML.T0080`, `AML.T0098`, `AML.T0010.005`, `AML.T0104`, `AML.T0110`).

#### Layer 3: Hierarchical Quantile-Calibrated Isolation Forest (`ml.py`, `features.py`)
Machine learning anomaly detection flags novel deviations from normal tool behavior:
- **Feature Extraction**:
  - Feature Set v1 (5 dimensions): `[action_type_encoded, parameter_count, call_frequency_1m, session_duration_s, time_of_day_normalized]`.
  - Feature Set v2 (9 dimensions): Extended with parameter Shannon entropy, byte payload size, distinct tool diversity count in window, and recent error rate.
- **Hierarchical Fallback Resolution**:
  $$\text{Model} = \begin{cases} 
  \text{Agent-Specific Model} & \text{if } N_{\text{agent actions}} \ge 200 \\
  \text{Organization Model} & \text{if } N_{\text{org actions}} \ge 200 \\
  \text{Global Baseline Model} & \text{otherwise}
  \end{cases}$$
- **Calibrated Anomaly Scoring**:
  Raw `IsolationForest.score_samples` output values (centered around negative numbers) are mapped onto an intuitive $[0.0, 1.0]$ probability space using empirical training quantiles (median $p_{50}$ and 99th percentile $p_{99}$):
  $$s_{\text{raw}} = \text{score\_samples}(x)$$
  $$\text{Anomaly Score} = \min\left(1.0, \max\left(0.0, \frac{p_{50} - s_{\text{raw}}}{2 \times |p_{99} - p_{50}| + 10^{-6}}\right)\right)$$

#### Layer 4: Recency-Weighted Composite Risk Scoring (`scoring.py`)
The overall action risk score combines rule severity and ML anomaly:
$$\text{Risk Score} = 0.4 \times \text{RuleSeverityScore} + 0.6 \times \text{AnomalyScore} \times 100$$
- **Guardrail Block Floor**: If any critical detection rule is violated (or an action is blocked in Enforce Mode), the action risk score is floored at 90.0, preventing rolling averages from diluting immediate critical threats.
- **Rolling Recency-Weighted Window**: Agent current risk score is maintained as an exponential decay over the agent's last 20 actions:
  $$\bar{R}_t = \frac{\sum_{i=0}^{k-1} w_i R_{t-i}}{\sum_{i=0}^{k-1} w_i}, \quad w_i = e^{-0.1 \times i}$$

---

## 4. Operational Modes: Observe vs. Enforce

| Feature | Observe Mode (`/actions/batch`) | Enforce Mode (`/evaluate`) |
|---|---|---|
| **Primary Intent** | Passive telemetry, audit logging, post-action anomaly detection | Pre-flight security decision before executing tool call |
| **Execution Impact** | Completely non-blocking; background queue | Synchronous inline check |
| **Latency Profile** | Dispatched asynchronously in background | $p95 < 50\text{ms}$ execution budget |
| **Client Behavior** | Queue buffers up to 50 items or 0.5s interval | Blocks until response or timeout |
| **Error Handling** | Silent fail-safe buffering; circuit breaker | Explicit `fail_open=True` or `fail_open=False` |
| **Action Outcome** | Action already completed by agent | Decision returned: `ALLOW`, `DENY`, or `REVIEW` |

---

## 5. Incident Response & Realtime Architecture

### 5.1 Smart Alert Deduplication
To prevent alert fatigue when an agent executes burst tool calls or repetitive loops:
- Alerts are grouped by a **10-minute sliding window** using the compound key:
  $$\text{Key} = (\text{org\_id}, \text{agent\_id}, \text{rule\_id} \lor \text{"anomaly"})$$
- Subsequent matches within the window increment the alert's `count` counter and update `last_seen`, rather than spawning redundant alert records.
- Analysts can collaborate via real-time discussion threads on `POST /api/v1/alerts/{id}/comments`.

### 5.2 Transactional Webhook Outbox Pattern
AgentShield avoids unreliable in-band HTTP webhooks from the request path:
1. When an alert is created, deliveries are staged in `webhook_deliveries` within the database transaction.
2. A background worker (`WebhookWorker`) polls pending deliveries, executes delivery attempts with exponential retry backoff (`[10s, 60s, 300s, 1800s]`), and handles dead-letter tracking after 5 attempts.
3. **SSRF Defense Filters**: Validates destination URLs, rejecting private IP ranges (RFC 1918), loopback, link-local, multicast, and cloud metadata endpoints (`169.254.169.254`) using DNS resolution checks.
4. **Adapter Payload Formatting**:
   - **Slack**: Structured Block Kit messages with severity headers and action links.
   - **Discord**: Rich color-coded embeds.
   - **PagerDuty**: Events API v2 format with `routing_key` and `event_action="trigger"`.
   - **Generic**: HMAC-SHA256 signed JSON payloads (`X-AgentShield-Signature: t={timestamp},v1={hash}`).

---

## 6. Cryptographic Audit Log & Verification

AgentShield implements a tamper-evident audit logging mechanism inspired by RFC 6962:
- Every security-sensitive state change (agent quarantine, emergency halt, agent release, API key generation, key rotation, key revocation) records an immutable entry in `audit_log`.
- **Hash Chain Algorithm**:
  $$\text{Genesis Hash} = \text{"0"}^{64}$$
  $$\text{Payload} = \text{prev\_hash} \parallel \text{timestamp} \parallel \text{org\_id} \parallel \text{actor\_id} \parallel \text{action} \parallel \text{target\_id} \parallel \text{canonical\_json}(\text{details})$$
  $$\text{Record Hash} = \text{SHA256}(\text{Payload})$$
- **Verification (`GET /api/v1/audit-log/verify`)**:
  Iterates through the tenant's contiguous log records in sequential order, recomputing the SHA-256 digest at each step and checking parent pointer integrity. If any record is tampered with, deleted, or out of sequence, verification fails and flags the exact corrupted block index.

---

## 7. Known Constraints & Tradeoffs

In adherence to Section 5 of `AGENTS.md`, all technical constraints and tradeoffs are explicitly documented:
1. **Single-Node In-Memory Event Bus**: The default realtime event bus (`realtime/bus.py`) operates in-memory for single-node FastAPI deployments. Multi-worker clusters running multiple Uvicorn worker processes require PostgreSQL `LISTEN/NOTIFY` coordination (`EVENT_BUS=postgres`).
2. **Static Rule Limitations**: Static signatures and JSON-DSL rules detect known patterns (e.g. reverse shells, system paths, prompt injection DAN templates) but cannot detect entirely novel semantic evasions. This is why AgentShield layers unsupervised Isolation Forest anomaly detection on top of static rules.
3. **Isolation Forest Cold-Start**: A newly instantiated agent has no behavioral baseline. AgentShield mitigates this by falling back hierarchically to organization-wide models or global pretrained baselines until the agent accumulates at least 200 actions.
4. **Outbox Polling Interval**: Webhook delivery uses database polling (default interval 2.0s). While this eliminates external Redis/Celery dependencies, it introduces a predictable 0–2 second delivery latency for outbound alert notifications.
