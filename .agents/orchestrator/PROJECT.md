# Project: AgentShield AI Command Center Frontend

## Architecture
- Target directory: `c:\Users\aditya\Downloads\AgentShield\frontend`
- Framework: React / TypeScript / Vite / Tailwind CSS / Chart.js
- Data source: WebSockets (`/ws/agent/{id}`) with fallback/mock feed, REST/mock state

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 0 | Exploration | Read existing frontend codebase & templates | none | DONE |
| 1 | R1: Dashboard | Real-time risk scores, alerts, node latency, WS telemetry feed | M0 | DONE |
| 2 | R2: Agent Management | Agent directory, badges, filters, AGT-009 view, action logs, isolation | M0 | DONE |
| 3 | R3: Alerts Triage | Prompt injection details, JSON payload inspection, rule enforcement | M0 | DONE |
| 4 | R4: Template Gallery | 29+ Stitch MCP HTML design template gallery | M0 | DONE |
| 5 | Build & Audit | `npm run build`, Reviewer check, Challenger stress test, Forensic Audit | M1, M2, M3, M4 | DONE |


## Interface Contracts
- WebSocket URL format: `/ws/agent/{id}` with reconnect loop and state enum (`LIVE` | `CONNECTING` | `OFFLINE`).
- Chart.js configuration for dark theme aesthetics.
- Template Gallery: dropdown/grid allowing selection and iframe/dynamic rendering of all 29+ Stitch templates.

## Code Layout
- `frontend/src/components/`
- `frontend/src/views/` or `pages/`
- `frontend/src/services/` (WebSocket, mock data)
- `frontend/src/types/`
