# AgentShield AI — Frontend Implementation Plan (Stitch → React)

Purpose: convert the Stitch designs into a production-ready React frontend (SPA) that connects to the FastAPI backend described in the SRS.

Goals
- Reuse Stitch assets and tokens for visual fidelity.
- Implement a responsive React app with real-time updates (WebSocket) and REST integration.
- Provide accessible, testable components (Chart.js for charts, Tailwind for utility styling).

High-level sequence (recommended order)
1. Import & Inspect
   - Copy Stitch assets from `stitch_downloads/` into `frontend/stitch_source/`.
   - Review `html` + `screenshot` for each screen and list reusable components.
2. Design tokens & styling
   - Extract color/spacing/typography tokens from Stitch design (see designTheme in MCP output).
   - Create Tailwind config with theme overrides and CSS variables.
3. Scaffold React app
   - Create `frontend/` using Vite + React + TypeScript.
   - Add Tailwind, Chart.js, React Router, SWR (or React Query), and WebSocket client library (native or socket.io as needed).
4. App shell and routing
   - Implement `AppShell` with topbar, sidebar, and main content area matching Stitch spacing.
   - Add routes: `/dashboard`, `/agents`, `/agents/:id`, `/alerts`, `/rules`, `/admin`.
5. API client & auth wiring
   - Implement a lightweight API client in `src/api/` using `fetch` or Axios.
   - Add JWT auth handling: `AuthProvider`, token storage in memory/secure storage, and `useApi` hooks.
6. Real-time layer
   - Implement `ws/` module to open `WS /ws/agent/{agent_id}` connections and a global `WebSocketContext` for live feeds.
   - Add reconnection/backoff and heartbeat handling.
7. Core components (build in this order)
   - `LiveFeed` (last 50 actions): real-time row stream + risk badges.
   - `AgentCard` + `AgentsList`: summary tiles with current risk score.
   - `RiskTrendChart`: Chart.js line chart for per-agent risk over time.
   - `AlertsTable`: paginated alerts with filters and actions (ack/resolve).
   - `AgentDetail`: full action history, risk timeline, and related alerts.
   - `RuleManager` (admin): CRUD UI calling rule endpoints.
   - `ModelRetrain` admin control: trigger `POST /api/v1/model/retrain` and show progress.
8. Stitch HTML → Component mapping
   - For each Stitch screen, create a component file in `src/components/stitch/` that reproduces layout using React + Tailwind.
   - Keep original HTML as reference under `stitch_source/` for visual QA.
9. Data layer & caching
   - Use SWR/React Query for REST data: `GET /api/v1/agents`, `GET /api/v1/agents/{id}/actions`, `GET /api/v1/alerts`, `GET /api/v1/rules`.
   - Invalidate caches on writes: alert ack, create rule, model retrain.
10. Charts & performance
   - Implement Chart.js components with downsampling for large series.
   - Ensure dashboard updates every 5s via WebSocket or short polling when appropriate.
11. Accessibility & responsive tweaks
   - Verify WCAG 2.1 AA contrast (per SRS) and keyboard navigation.
12. Tests & QA
   - Unit tests for components (Jest + React Testing Library).
   - E2E smoke test for main flows (Cypress).
13. Build, CI, and deployment
   - Add `frontend/Dockerfile`, GitHub Actions workflow for build + lint + tests.
   - Document env vars: `VITE_API_BASE`, `VITE_WS_BASE`, `STITCH_UI_ASSETS_DIR`.

API mapping (important endpoints from SRS)
- `POST /api/v1/actions` — not UI-facing (simulator use).
- `GET /api/v1/agents` — `AgentsList`.
- `GET /api/v1/agents/{id}/actions` — `AgentDetail` (history, pagination).
- `GET /api/v1/alerts` — `AlertsTable` (filters: severity, agent, date range).
- `PATCH /api/v1/alerts/{id}` — acknowledge/resolve actions.
- `GET /api/v1/rules` and `POST/DELETE /api/v1/rules` — `RuleManager`.
- `POST /api/v1/model/retrain` — `ModelRetrain` admin control.
- `WS /ws/agent/{agent_id}` — live per-agent stream (feed + update agent risk).

Developer workflow & local dev
- Start backend (local FastAPI) on `http://localhost:8000`.
- Start frontend in dev mode:

```bash
cd frontend
npm install
npm run dev
```

- Set env in `.env.local`: `VITE_API_BASE=http://localhost:8000/api/v1`, `VITE_WS_BASE=ws://localhost:8000/ws`.

Stitch-specific guidance
- Keep `stitch_source/` as canonical exports. Convert visual pieces iteratively, starting with `042_System_Health_Analytics` and `003_Dashboard` as highest-value screens.
- Capture tokens (colors, spacing) in `tailwind.config.js` and a `src/styles/tokens.css` file.

Testing & acceptance criteria (per SRS)
- Live feed updates within 5s and displays last 50 actions.
- Dashboard loads under 3s on standard broadband (NFR-02).
- Risk trend charts render and update for selected agents.
- Alert ack/resolve persisted and visible in UI.

Deliverables (frontend MVP)
- `frontend/` repo with Vite + React + TypeScript + Tailwind.
- Stitch-based component library in `src/components/stitch/`.
- Real-time WebSocket integration and API hooks.
- Unit and E2E tests and CI workflow.
- `README` with dev and deployment instructions.

Next immediate tasks I can take
- Scaffold `frontend/` (Vite + React + TypeScript) and commit files.
- Convert `042_System_Health_Analytics` screen into React components and wire mock data.
- Add Tailwind tokens from Stitch design and show a demo page.

Tell me which immediate task to start and I will begin (I recommend scaffolding the `frontend/` repo first).