# AgentShield AI — System Architecture (As-Is & Target)

## 1. Executive Summary

AgentShield AI is designed to monitor, analyze, and enforce runtime security boundaries on autonomous AI agent workflows. As AI agents gain tool execution capabilities (file system access, database queries, web requests, shell commands), they become vulnerable to prompt injections, goal hijacking, context poisoning, and privilege abuse. AgentShield sits as a behavioural guardrail providing passive telemetry observation and synchronous pre-flight enforcement.

---

## 2. As-Is Architecture (Phase 0 Baseline)

At the start of this transformation, AgentShield AI existed as a working prototype with the following components:
- **Backend**: FastAPI with synchronous SQLAlchemy ORM connecting to a local SQLite database (`agentshield.db`).
- **Telemetry Ingestion**: Synchronous endpoint `POST /api/v1/actions` and pre-flight evaluation `POST /api/v1/actions/evaluate`.
- **Detection**:
  - `RuleEngine`: In-memory regex and substring matching against 6 hardcoded rules (unauthorized file access, rate burst, prompt injection, privilege escalation, outbound exfiltration, unsafe shell command).
  - `MLEngine`: Scikit-learn `IsolationForest` fitted on a 5-dimensional feature vector `[action_type_encoded, param_count, call_frequency, session_duration, time_of_day]`.
  - `RiskCalculator`: Simple linear combination $\text{Risk} = 0.4 \times \text{RuleScore} + 0.6 \times \text{AnomalyScore} \times 100$.
- **Realtime**: WebSockets at `/ws` and `/ws/agent/{agent_id}` using an in-process connection manager without authentication.
- **Frontend**: React 18, Vite, Tailwind CSS, Chart.js, React Router v6.
- **Identified Gaps**:
  - Self-simulating loop (`simulator.py`) generating fake events directly into the database.
  - Lack of multi-tenant isolation, user accounts, and proper API key authentication.
  - No background outbox or external webhook integrations (Slack, Discord, PagerDuty).
  - Absence of framework integrations (LangChain, CrewAI, OpenAI Agents SDK).
  - No production Docker containerization or CI pipeline.

---

## 3. Target Production Architecture

### 3.1 Data Flow Pipeline
1. **Agent Action Ingress**: Client agents record actions via the AgentShield Python SDK.
   - **Observe Mode**: Enqueues action events to a bounded thread-safe buffer; dispatched in batches to `POST /api/v1/actions/batch` without blocking agent execution.
   - **Enforce Mode**: Synchronously dispatches tool calls to `POST /api/v1/evaluate` with strict timeout ($<50\text{ms}$).
2. **Security Gateway**: Ingress requests are authenticated via Argon2id JWT tokens (dashboard users) or HMAC-SHA256 indexed API keys (`ashield_live_...`). Per-key sliding-window rate limiters prevent denial of service.
3. **Normalization & Deobfuscation**: Raw parameter strings and tool outputs undergo Unicode NFKC normalization, zero-width character stripping, whitespace reduction, and bounded base64/hex/URL decoding.
4. **Hybrid Detection Engine**:
   - **Rule DSL**: Evaluates normalized payloads against 20 default rules mapped to OWASP ASI 2026 and MITRE ATLAS.
   - **Window Aggregator**: Tracks rolling 60s and 5m agent metrics (distinct tools, error rates, frequency).
   - **Hierarchical Isolation Forest**: Scores behavioral anomalies using calibrated empirical percentiles across agent, organization, or baseline models.
   - **Explainable Scoring**: Calculates composite risk score and generates human-readable attribution reasons.
5. **Realtime & Alerting Engine**:
   - Matches trigger alerts grouped by 10-minute buckets.
   - Outbox pattern commits alert deliveries to `webhook_deliveries` within the database transaction.
   - Dedicated webhook worker delivers signed payloads to Slack, Discord, PagerDuty, or generic HTTP endpoints.
   - Realtime event bus fans out telemetry across tenant-scoped WebSockets.

---

## 4. Known Constraints & Tradeoffs

- **Single-Worker In-Memory Bus**: In default single-container dev mode, WebSockets and rate limits use in-memory state. For distributed multi-worker deployments, `EVENT_BUS=postgres` provides `LISTEN/NOTIFY` coordination.
- **Pattern Matching Limits**: Static rules cannot catch every novel semantic variation of prompt injection. The hybrid architecture combines rules with behavioral anomaly detection to mitigate this limitation.
- **Cold-Start Anomaly Scoring**: New agents without sufficient event history fallback to organization-level or global baseline Isolation Forest models until $\ge 200$ samples are accumulated.
