# AgentShield AI — Architectural Decisions Log

Format: `[YYYY-MM-DD] Decision: Reason`

- **[2026-10-22] Dual Database Engine Support (aiosqlite + asyncpg)**: SQLite with aiosqlite for single-node zero-config local development; asyncpg for production PostgreSQL multi-tenant deployments.
- **[2026-10-22] Dual Endpoint Aliasing for Backwards Compatibility**: Support both `/api/v1/actions/evaluate` and canonical `/api/v1/evaluate` to ensure zero disruption to existing tests and SDK clients.
- **[2026-10-22] HMAC-SHA256 Peppered Hash Storage for API Keys**: API keys are hashed with a server-side pepper and stored as unique hex digests; plaintext keys are returned strictly once upon generation.
- **[2026-10-22] Calibrated Empirical Isolation Forest Anomaly Scoring**: Normalizes raw `IsolationForest.score_samples` against baseline training quantiles (p50, p99) to provide bounded $[0, 1]$ anomaly probability.
- **[2026-10-22] Outbox Pattern for Webhooks**: Webhook deliveries are staged in `webhook_deliveries` within the alert creation transaction to guarantee delivery without blocking the action processing path.
- **[2026-10-22] Re-check MITRE ATLAS IDs at atlas.mitre.org**: Kept all taxonomy IDs in `backend/app/detection/taxonomy.json` so additions and changes to agent threat techniques can be updated without code modifications.
