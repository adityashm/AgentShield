# Explorer 3 Handoff Report: Telemetry, Analytics, Data Models & Requirements Gap Analysis

## 1. Observation

### 1.1 WebSocket & Telemetry Stream Implementation
- **Provider & Context**: `c:\Users\aditya\Downloads\AgentShield\frontend\src\ws\WebSocketContext.tsx`
  - **Connection URL**: Configured via `import.meta.env.VITE_API_WS_BASE` falling back to `ws://localhost:8000/ws` (Note: SRS FR-02 specifies `WS /ws/agent/{agent_id}`, showing an endpoint mismatch).
  - **Connection Status Enum**: `status: ConnectionStatus` where `ConnectionStatus = 'LIVE' | 'CONNECTING' | 'OFFLINE'`.
  - **Reconnection Logic**: Exponential backoff on `onclose` and `onerror` (`delay = Math.min(1000 * Math.pow(2, attempts), 10000)`), retrying connection up to a 10s maximum interval.
  - **Mock Feed Fallback**: When WS is disconnected (or during dev), a `setInterval` runs every `4000ms` generating mock `ACTION_EVENT` messages from `MOCK_ACTIONS` array (`AGT-009`, `AGT-042`, `AGT-012`, `AGT-004`, `AGT-018`, `AGT-007`) and prepending them to state (`messages.slice(0, 100)`).
  - **Pause/Resume Control**: `isPaused: boolean` state toggled via `togglePause()`. Incoming WS messages and mock interval emissions are ignored while `isPaused === true`.
- **UI Status Indicators**: `c:\Users\aditya\Downloads\AgentShield\frontend\src\pages\Dashboard.tsx:243-256`
  - Visual status pill showing green dot with glow for `LIVE` (`bg-[var(--status-success)] shadow-[0_0_6px_#238636]`), pulsing amber dot for `CONNECTING` (`animate-ping bg-[var(--status-warning)]`), and red dot for `OFFLINE` (`bg-[var(--status-danger)]`).

### 1.2 Chart.js Telemetry & Anomaly Analytics
- **Dashboard Telemetry Chart**: `c:\Users\aditya\Downloads\AgentShield\frontend\src\pages\Dashboard.tsx:93-192` (`MetricChart`)
  - Built with `react-chartjs-2` using `Chart.js` `CategoryScale`, `LinearScale`, `PointElement`, `LineElement`, `Title`, `Tooltip`, `Legend`, `Filler`.
  - Displays three series:
    1. `Risk Index`: `#00D4FF` Electric Cyan line with area fill (`rgba(0, 212, 255, 0.08)`), tension 0.35.
    2. `Anomaly Score`: `#F85149` Crimson Red line with light fill (`rgba(248, 73, 73, 0.05)`).
    3. `CPU Load`: `#238636` Green dashed line (`borderDash: [4, 4]`).
  - Dark mode canvas styling with grid lines `rgba(48, 54, 61, 0.5)` and `JetBrains Mono` tick labels.
  - **Gap**: Time labels (`labels`) and dataset values (`data`) are currently hardcoded static arrays (`['14:25', '14:26', ...]`) instead of dynamically deriving from incoming WebSocket telemetry or REST API history.
- **Stand-alone Performance Chart**: `c:\Users\aditya\Downloads\AgentShield\frontend\src\components\Charts\SystemHealthChart.tsx`
  - Line chart configured for Anomaly Score (`#22d3ee`).

### 1.3 Agent Management Data Models & Diagnostics (R2)
- **Agent Directory Model**: `c:\Users\aditya\Downloads\AgentShield\frontend\src\components\stitch\AgentsDirectory.tsx`
  - Agent Object Schema: `{ id: string, name: string, status: 'online' | 'suspended' | 'warning' | 'offline', riskScore: number, uptime: string, totalActions: string, recentRiskTrend: number[] }`.
  - Risk Badges & Colors:
    - Safe (0-25): Green border/accent (`var(--status-success)`).
    - Medium Risk (51-75): Amber border/accent (`var(--status-warning)`).
    - High Risk / Suspended (76-100): Red border/accent (`var(--status-danger)`), with animated red pulse dot (`pulse-dot-red`).
  - Sparklines: CSS bar chart (`sparkline-bar`) rendering `recentRiskTrend` array (9 data points).
  - Search & Filters: Search input (by ID or function), status dropdown (`All`, `Online`, `Suspended`, `Offline`), risk range slider (0-100).
- **AGT-009 Detail Diagnostics & Isolation Controls**: `c:\Users\aditya\Downloads\AgentShield\frontend\src\components\stitch\AgentDetailDirectory.tsx`
  - Agent Header: `AGT-009` with `HIGH RISK` badge (`84/100`), network segment metadata ("Network Segment 04").
  - Circular SVG Risk Gauge: `84/100` rendered with SVG circle `strokeDashoffset`.
  - Metrics: Session Duration (`2h 34m`), Total Actions (`1,247`).
  - Live Action Timeline Stream: Interactive log showing timestamp, action tag (`unauthorized_access`, `api_call`, `execute_command`, `read_file`), resource path, and JSON params (`{ source: "EXT-88", target: "LOCAL_FS", permission: "DENIED" }`).
  - Risk Score Trend Chart: Custom CSS bar chart with dashed alert threshold line at `70` (`ALERT THRESHOLD (70)`).
  - Associated Alerts Table: Displays alert ID (`ALT-9921`), trigger type, severity (`CRITICAL`), risk score (`92`), and status (`Investigating`).
  - Isolation & Flagging Controls: Header action button `<button className="...">FLAG AGENT</button>` and triage modal isolation buttons (`Isolate Agent`, `Halt Process`).

### 1.4 Security Alerts Triage Data Models (R3)
- **Alerts Table View**: `c:\Users\aditya\Downloads\AgentShield\frontend\src\components\stitch\AlertsDirectory.tsx`
  - Alert Object Schema: `{ id: string, agentId: string, triggerType: string, severity: 'Critical' | 'High' | 'Medium' | 'Low', riskScore: number, timestamp: string, status: 'Open' | 'Acknowledged' | 'Resolved' }`.
  - Features: Multi-select checkboxes, filter bar (Status, Severity, Search Agent ID, Date Range), `EXPORT CSV` button, color-coded left border indicators per status.
- **Alert Triage & Prompt Injection Inspection**: `c:\Users\aditya\Downloads\AgentShield\frontend\src\components\stitch\AlertsTriageDirectory.tsx`
  - Split-view layout: Left list of active alerts, Right detail inspection pane.
  - Raw JSON Payload Viewer: Styled `<pre><code className="language-json">` container with formatted JSON payload including `event_id`, `agent_id`, `target_resource`, `raw_query`, `intent_analysis`, and `matched_rule` (`SEC-DB-004: Prevent unauthorized admin lookup`).
  - Copy JSON Button: UI button `<button>COPY JSON</button>` (note: missing `navigator.clipboard.writeText` onClick handler).
  - Automated Analysis Card: Narrative breakdown of rule violation and privilege escalation intent.
  - Remediation Action Buttons: `Dismiss Alert`, `Isolate Agent` (with block icon), `Halt Process` (with stop icon).
- **Rule Enforcement Management**: `c:\Users\aditya\Downloads\AgentShield\frontend\src\components\stitch\RulesDirectory.tsx`
  - Rule Object Schema: `{ id: string, name: string, category: string, severity: string, matches: string, active: boolean }`.
  - Features: Active rule toggle switch, category filter, rule match counter, rule editor side panel with JSON condition logic editor (`JSON.stringify({ match: { field: 'event.action', operator: 'equals', value: 'login_failed' }, threshold: 5 })`).

---

## 2. Logic Chain

1. **WebSocket Infrastructure vs. SRS Specification**:
   - SRS requirement `FR-02` specifies connecting to `WS /ws/agent/{agent_id}` per individual agent stream.
   - `WebSocketContext.tsx:56` opens a single global connection to `ws://localhost:8000/ws` (broadcast stream).
   - *Logic*: While a global feed is effective for the Command Center Dashboard (`Dashboard.tsx`), per-agent streaming on `AgentDetailDirectory.tsx` currently relies on static mock data rather than subscribing to `WS /ws/agent/AGT-009`.

2. **Chart Data Dynamic Binding**:
   - `MetricChart` in `Dashboard.tsx` registers Chart.js correctly and styles dark mode axes with custom colors.
   - However, the `data` object uses static values. The WebSocket stream (`messages`) updates `displayFeed` table rows, but does NOT push new data points into `MetricChart`'s `labels` and `datasets`.

3. **Data Layer Integration Gap (Mock vs. REST/WS)**:
   - `src/api/index.ts` defines Axios calls `getAgents()` (`GET /api/v1/agents`) and `getAlerts()` (`GET /api/v1/alerts`).
   - None of the feature views (`AgentsDirectory.tsx`, `AgentDetailDirectory.tsx`, `AlertsDirectory.tsx`, `AlertsTriageDirectory.tsx`, `RulesDirectory.tsx`) invoke `getAgents()` or `getAlerts()` via `swr` or `useEffect`. They rely 100% on hardcoded `mockAgents`, `mockAlerts`, and `mockRules` arrays.

4. **Interactive Action Gaps**:
   - `COPY JSON` button in `AlertsTriageDirectory.tsx` lacks a clipboard event listener.
   - `Dismiss Alert`, `Isolate Agent`, `Halt Process` buttons mutate inline object properties (`alert.isolated = true`) instead of dispatching HTTP `PATCH /api/v1/alerts/{id}` or `POST /api/v1/agents/{id}/isolate` requests.

---

## 3. Caveats

1. **Backend Service Offline**: FastAPI backend (`http://localhost:8000`) is currently not running. All WS functionality gracefully falls back to the built-in 4-second mock generator in `WebSocketContext.tsx`.
2. **TypeScript Strict Errors**: As documented by Explorer 1, 7 TS errors exist in `AlertsTriageDirectory.tsx`, `RulesDirectory.tsx`, and `Dashboard.tsx`. These do not break Vite production build (`npm run build`), but need cleanup for type safety.
3. **Read-Only Scope**: Explorer 3 performed zero code modifications.

---

## 4. Conclusion & Identified Requirements Gaps

### Summary Table of Requirements Gaps (R1, R2, R3)

| Requirement Area | SRS Reference | Current Implementation | Gap Description & Action Required |
| --- | --- | --- | --- |
| **R1: WS Endpoint Path** | SRS FR-02 (`/ws/agent/{agent_id}`) | `WebSocketContext.tsx` uses `ws://localhost:8000/ws` | Add support for per-agent WS topic paths (`/ws/agent/${id}`) or multiplexed channel filtering. |
| **R1: Live Chart Streaming** | SRS FR-26, NFR-02 | `Dashboard.tsx` `MetricChart` uses static array `[28, 35, 42...]` | Wire incoming `messages` from `useWebSocket()` to append rolling data points (risk index & anomaly score) to Chart.js state. |
| **R2: REST API Binding** | SRS FR-27, FR-30 (`GET /api/v1/agents`) | `AgentsDirectory.tsx` & `AgentDetailDirectory.tsx` use `mockAgents` | Import `getAgents` / SWR hook in `Agents.tsx` to display real backend agent list and risk scores. |
| **R2: Agent Isolation Endpoint** | SRS UC-04, FR-23 | Button in `AgentDetailDirectory` & `AlertsTriageDirectory` has no API handler | Wire "Isolate Agent" button to send REST POST/PATCH request to backend to update agent status to `suspended`. |
| **R3: Alert Triage Payload Copy & Action Handling** | SRS FR-21, FR-23 (`PATCH /api/v1/alerts/{id}`) | `AlertsTriageDirectory.tsx` has static `alert` object and inline mutations | 1. Implement `navigator.clipboard.writeText()` on "COPY JSON".<br/>2. Connect "Dismiss", "Isolate", "Halt" buttons to backend API endpoints (`PATCH /api/v1/alerts/{id}`). |
| **R3: Alert CSV Export** | SRS FR-24 | `AlertsDirectory.tsx` renders static `EXPORT CSV` button | Add CSV generation utility function to convert `alerts` array to downloadable `.csv` blob. |

---

## 5. Verification Method

To independently verify these findings:

1. **Verify WebSocket Implementation & Fallback**:
   - Inspect `c:\Users\aditya\Downloads\AgentShield\frontend\src\ws\WebSocketContext.tsx`. Note lines 55-60 for `wsUrl` and lines 105-125 for the 4000ms mock interval generator.
   - Inspect `c:\Users\aditya\Downloads\AgentShield\frontend\src\pages\Dashboard.tsx`. Note lines 243-256 for visual status indicators (`LIVE`, `CONNECTING`, `OFFLINE`).

2. **Verify Chart.js Setup**:
   - Inspect `c:\Users\aditya\Downloads\AgentShield\frontend\src\pages\Dashboard.tsx`. Note lines 93-130 for `MetricChart` data setup.

3. **Verify Data Models & Mock Usage**:
   - Inspect `c:\Users\aditya\Downloads\AgentShield\frontend\src\components\stitch\AgentsDirectory.tsx` lines 4-78 (`mockAgents`).
   - Inspect `c:\Users\aditya\Downloads\AgentShield\frontend\src\components\stitch\AgentDetailDirectory.tsx` lines 80-131 (Action Timeline) and lines 145-165 (Risk score trend bars).
   - Inspect `c:\Users\aditya\Downloads\AgentShield\frontend\src\components\stitch\AlertsTriageDirectory.tsx` lines 5-37 (Mock alert & payload) and lines 97-101 (`COPY JSON` button).
