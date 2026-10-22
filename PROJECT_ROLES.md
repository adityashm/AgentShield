# AgentShield AI — Project Roles & Responsibilities

This document defines suggested roles, responsibilities, and first actions for the AgentShield AI project (MVP scope per SRS).

## Roles

- Project Lead / Coordinator (TBD)
  - Responsibility: Overall project planning, timeline, stakeholder communication, and final deliverables.
  - Deliverables: Project schedule, weekly status updates, guide/examiner communications.
  - First actions: Consolidate milestones; schedule weekly meetings.

- Backend Engineer (FastAPI) (TBD)
  - Responsibility: Implement ingestion API, WebSocket, rule engine hooks, DB schema, admin endpoints, and integration tests.
  - Deliverables: FastAPI service, DB migrations, unit tests for endpoints.
  - First actions: Scaffold FastAPI app, define DB schema for `agents`, `actions`, `alerts`, `rules`, `audit_log`.

- Frontend Engineer (Stitch -> React) (TBD)
  - Responsibility: Integrate Stitch screens or convert to React components, implement live dashboard UI, alerts table, agent detail view.
  - Deliverables: React SPA, real-time WebSocket updates, Chart.js visualizations, styling (Tailwind/Stitch tokens).
  - First actions: Import Stitch HTML assets, map UI components to API endpoints.

- ML Engineer / Data Scientist (TBD)
  - Responsibility: Prepare feature extraction, train Isolation Forest, expose retrain API, and integrate inference into pipeline.
  - Deliverables: Feature pipeline, trained model artifact, scoring job, documentation for retraining.
  - First actions: Define feature vector, prepare synthetic dataset generation plan.

- DevOps / CI Engineer (TBD)
  - Responsibility: Set up repository CI, containerization, deployment scripts, and demo environment (optional cloud/VM).
  - Deliverables: Dockerfiles, CI pipeline, deployment README.
  - First actions: Create `Dockerfile` for backend, add basic GitHub Actions or local build script.

- QA / Tester (TBD)
  - Responsibility: Define test plan, write integration tests, verify performance/NFRs, and run demo acceptance tests.
  - Deliverables: Test matrix, automated tests, test reports.
  - First actions: Define test cases for ingestion, rule matching, scoring latency, and dashboard updates.

- Security & Data Privacy Lead (TBD)
  - Responsibility: Ensure JWT auth, TLS in production, append-only audit policy, and secure handling of keys/secrets.
  - Deliverables: Security checklist, secrets handling guide, audit verification steps.
  - First actions: Review current `mcp.json`; remove secrets from source and confirm local secret setup.

- UX / Designer (optional) (TBD)
  - Responsibility: Adapt Stitch designs to accessible, responsive React UI and advise on visuals and interaction flows.
  - Deliverables: Component style guide, updated assets, accessible color guidance.
  - First actions: Export Stitch tokens and component list for integration.

## Initial Owner Assignments (suggested)
- Project Lead: `TBD`
- Backend: `TBD`
- Frontend (Stitch integration): `TBD`
- ML: `TBD`
- DevOps: `TBD`
- QA: `TBD`
- Security: `TBD`
- UX: `TBD`

> Replace `TBD` with actual names/email/GitHub handles when available.

## Milestone (short-term, 3 sprints)
- Sprint 1 (Setup & Ingestion): Repo + CI, FastAPI scaffold, DB schema, basic ingestion, Stitch assets imported.
- Sprint 2 (Detection & Dashboard): Rule engine, ML scoring batch, dashboard feed with risk scores and alerts.
- Sprint 3 (Hardening & Demo): Retrain API, tests, performance tuning, demo deployment and user guide.

## Communication and Meetings
- Weekly sync (30–60 min) for progress and blockers.
- Use GitHub issues for tasks and PRs for code review.
- Maintain `PROJECT_ROLES.md` and `README.md` in repo root.

---

Document created by project assistant. Update owners and dates as team members are assigned.
