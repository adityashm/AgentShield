# AgentShield AI — Architectural Decisions Log

Format: `[YYYY-MM-DD] Decision: Reason`

- **[2026-10-22] Dual Database Engine Support (aiosqlite + asyncpg)**: SQLite with aiosqlite for single-node zero-config local development; asyncpg for production PostgreSQL multi-tenant deployments.
- **[2026-10-22] Dual Endpoint Aliasing for Backwards Compatibility**: Support both `/api/v1/actions/evaluate` and canonical `/api/v1/evaluate` to ensure zero disruption to existing tests and SDK clients.
- **[2026-10-22] HMAC-SHA256 Peppered Hash Storage for API Keys**: API keys are hashed with a server-side pepper and stored as unique hex digests; plaintext keys are returned strictly once upon generation.
- **[2026-10-22] Calibrated Empirical Isolation Forest Anomaly Scoring**: Normalizes raw `IsolationForest.score_samples` against baseline training quantiles (p50, p99) to provide bounded $[0, 1]$ anomaly probability.
- **[2026-10-22] Outbox Pattern for Webhooks**: Webhook deliveries are staged in `webhook_deliveries` within the alert creation transaction to guarantee delivery without blocking the action processing path.
- **[2026-10-22] Re-check MITRE ATLAS IDs at atlas.mitre.org**: Kept all taxonomy IDs in `backend/app/detection/taxonomy.json` so additions and changes to agent threat techniques can be updated without code modifications.
- **[2026-10-22] In-Batch and Database Deduplication for Batch Ingest**: Maintained an in-batch set of event IDs in addition to DB query checks to guarantee idempotency on `(org_id, event_id)` even when duplicate events appear within a single bulk submission.
- **[2026-10-22] Key Rotation 24-Hour Overlap Window**: Kept replaced API keys active for `KEY_ROTATION_GRACE_HOURS=24` with `replaced_by` pointer to ensure zero agent downtime during fleet credential rollouts.
- **[2026-10-22] Safe AST Evaluator Without eval/exec**: Built a dedicated AST recursive interpreter for JSON-DSL rules with ReDoS safe pattern compilation to avoid code execution vulnerabilities in policy evaluations.
- **[2026-10-22] Layered Deobfuscation Normalization Pipeline**: Applied Unicode NFKC, zero-width stripping, homoglyph translation, and depth-bounded recursive decoding (URL/hex/base64) before rule matching to defeat adversarial evasion.
- **[2026-10-22] Guardrail Block Floor at 90.0**: Any critical rule violation sets action risk score to at least 90.0 to prevent rolling averages from diluting immediate block enforcement.
- **[2026-10-22] SSRF Protection on Webhook Dispatch**: Block private (RFC 1918), loopback, link-local, and cloud metadata IPs (`169.254.169.254`) via IP literal and pre-flight DNS address info resolution.
- **[2026-10-22] 10-Minute Sliding Window Alert Deduplication**: Group alerts by `(org_id, agent_id, rule_id or "anomaly")` within a 10-minute window, incrementing occurrence count and refreshing `last_seen` to prevent alert fatigue.
- **[2026-10-22] Cryptographic SHA-256 Hash Chaining for Audit Log**: Chain each audit entry to the prior record using `SHA256(prev_hash:ts:org_id:actor:action:target:details)` to ensure tamper-evident security compliance verifiable via `GET /api/v1/audit-log/verify`.
- **[2026-10-22] Decoupled Autonomous Simulator as External HTTP Client**: Converted simulation engine from direct database mutations to an external HTTP client using `POST /api/v1/actions/batch` and enterprise API keys, ensuring synthetic traffic exercises the exact same normalization, policy evaluation, ML anomaly detection, alert deduplication, and webhook dispatch pipelines as real customer agents.
- **[2026-10-22] Multi-Stage Container Hardening & Unprivileged Service User**: Standardized backend container on Python 3.13-slim with multi-stage virtualenv isolation, unprivileged non-root user (`agentshield:1000`), pre-flight PostgreSQL TCP readiness probing, and automated Alembic schema upgrades at container startup.

