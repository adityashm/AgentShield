# AGENTS.md — AgentShield Developer & AI Agent Guidelines

> **IMPORTANT**: Read `docs/PROGRESS.md` and `docs/DECISIONS.md` before starting any work.

---

## 1. Project Overview

**AgentShield AI** is a production-grade, behaviour-based security monitoring and runtime enforcement platform for autonomous AI agents (LangChain, CrewAI, OpenAI Agents SDK, or custom Python agents).

It provides:
- **Observe Mode**: Non-blocking asynchronous telemetry ingest with batching, sliding windows, and sub-millisecond host overhead.
- **Enforce Mode**: Synchronous pre-flight policy evaluation (`/evaluate`) capable of blocking dangerous actions (p95 latency < 50ms) with explicit fail-open/fail-closed semantics.
- **Layered Threat Detection**: Deep normalization (deobfuscation, zero-width stripping), a safe JSON-DSL rule engine mapped to **OWASP Top 10 for Agentic Applications 2026** and **MITRE ATLAS**, and hierarchical **Isolation Forest** anomaly detection.
- **Incident Response**: WebSocket telemetry feeds, smart alert deduplication/grouping, and an outbox webhook worker supporting Slack Block Kit, Discord embeds, PagerDuty Events API v2, and HMAC-signed generic webhooks.
- **Mission Control Dashboard**: Dark-mode React 18 / TypeScript frontend using Stitch design tokens with live event streams, virtualized log explorer, interactive rule testing, and tenant/key administration.

---

## 2. Repository Layout

```
agentshield/
├── AGENTS.md                 # Cross-tool agent rules and repository guide
├── GEMINI.md                 # Short pointer to AGENTS.md
├── README.md                 # Project README, quickstart, and architecture
├── LICENSE                   # MIT License
├── Makefile                  # Automation commands
├── .env.example              # Canonical environment variables
├── .gitignore                # Git ignore configuration
├── docker-compose.yml        # Docker compose stack (db, api, web, simulator)
├── backend/
│   ├── Dockerfile            # Multi-stage Python 3.13 backend image
│   ├── entrypoint.sh         # Startup script: alembic upgrade head -> uvicorn
│   ├── pyproject.toml        # Pinned backend dependencies
│   ├── alembic.ini           # Alembic migration configuration
│   ├── alembic/              # Async migration scripts with SQLite batch mode support
│   │   ├── env.py
│   │   └── versions/
│   ├── app/
│   │   ├── main.py           # FastAPI lifespan: migrations, model load, worker
│   │   ├── core/             # config, security, logging, errors, ratelimit, crypto, deps
│   │   ├── db/               # SQLAlchemy 2.0 async engine, session, and models
│   │   ├── api/v1/           # auth, users, api_keys, ingest, evaluate, agents, etc.
│   │   ├── services/         # ingest, evaluate, agents, alerts, webhooks, audit, scoring
│   │   ├── detection/        # normalize, dsl, rules_engine, features, ml, taxonomy.json
│   │   ├── realtime/         # bus.py, ws.py
│   │   ├── workers/          # webhook_worker.py
│   │   └── simulator/        # client.py, scenarios.py, cli.py
│   └── tests/                # Unit, integration, and security corpus tests
├── frontend/                 # React 18, Vite, TypeScript, Tailwind CSS, TanStack Query
├── sdk/python/               # agentshield-sdk Python package
│   ├── pyproject.toml        # Hatchling build specification
│   ├── src/agentshield/      # Core client, monitor decorator, integrations
│   └── tests/                # SDK test suite
├── examples/                 # Offline-runnable demos and attack scenarios
├── scripts/                  # loadtest.py, seed_demo.py, gen_api_types.sh
├── deploy/nginx/             # nginx.conf reverse proxy configuration
├── docs/                     # ARCHITECTURE.md, API.md, SDK.md, THREAT_MODEL.md,
│                             # DEPLOYMENT.md, VIVA.md, PROGRESS.md, DECISIONS.md
└── .github/workflows/ci.yml  # Continuous integration workflow
```

---

## 3. Standard Commands

All operations should be invoked via the `Makefile` or equivalent commands:

| Target | Description |
|---|---|
| `make setup` | Install backend dependencies, editable SDK with extras, and frontend npm packages |
| `make dev` | Run FastAPI backend and Vite frontend development server concurrently |
| `make migrate` | Execute database migrations (`alembic upgrade head`) |
| `make test` | Run all test suites: backend pytest, SDK pytest, frontend vitest |
| `make lint` | Run code quality checks: ruff, mypy, eslint, tsc |
| `make sdk-test` | Run the Python SDK test suite across test runners |
| `make e2e` | Launch local stack, execute smoke checks and attack scenarios |
| `make up` | Start production stack with Docker Compose (`docker compose up --build -d`) |
| `make down` | Stop stack and teardown containers (`docker compose down -v`) |
| `make demo` | Start stack with demo simulator profile enabled |
| `make loadtest` | Run `scripts/loadtest.py` to benchmark pre-flight evaluation latency |
| `make gen-api` | Regenerate frontend TypeScript types from backend OpenAPI specification |

---

## 4. Coding Standards

1. **Type Hints Everywhere**: Every Python function and method must be typed with complete annotations. Maintain PEP 561 compliance (`py.typed` in SDK).
2. **SQLAlchemy 2.0 Style**: Use `Mapped[...]`, `mapped_column`, and typed select statements. Never construct raw unparameterized SQL strings.
3. **Tenant Isolation**: Every database query touching tenant-owned tables must filter explicitly by `org_id`.
4. **Timezone Handling**: All database timestamps and API dates must use UTC (`datetime.now(timezone.utc)`) and serialize with ISO-8601 `Z` format.
5. **Security Error Handling**: All HTTP errors must follow RFC 7807 `application/problem+json` format with a unique `request_id`.
6. **No Secret Leakage**: API keys, passwords, webhook secrets, and full sensitive payloads must never be logged or returned in plaintext.
7. **Conventional Commits**: Commit messages must follow the Conventional Commits specification (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).

---

## 5. Prohibited Practices ("Do Not" List)

- **Do NOT** rewrite working modules purely for style; refactor only where required for requirements.
- **Do NOT** leave `TODO`, `pass`, `NotImplementedError`, mock responses, or hard-coded fake data on production paths.
- **Do NOT** add Redis, Kafka, Celery, or extra infrastructure beyond PostgreSQL.
- **Do NOT** store or log plaintext API keys, passwords, webhook secrets, or full un-redacted request payloads.
- **Do NOT** claim anything works without running the verification command in the current session.
- **Do NOT** advance from Phase N to Phase N+1 while Phase N has failing tests.
- **Do NOT** hide limitations; document them transparently in `docs/ARCHITECTURE.md` and `docs/THREAT_MODEL.md`.
- **Do NOT** call external services in automated unit tests; use mocked HTTP transports or fake local servers.
- **Do NOT** publish packages or push commits to remote Git repositories.
