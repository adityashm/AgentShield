# Feature & UX Compliance Review Report — M5 Preview

**Working Directory**: `c:\Users\aditya\Downloads\AgentShield\.agents\teamwork_preview_reviewer_m5_2`  
**Target Directory**: `c:\Users\aditya\Downloads\AgentShield\frontend`  
**Reviewer Role**: Reviewer 2 (Feature & UX Compliance Reviewer)  
**Date**: 2026-07-26  

---

## Executive Summary

**Verdict**: **REQUEST_CHANGES**  
While the frontend demonstrates impressive design quality, interactive state management in key telemetry dashboards, and client-side CSV export, a **Critical Defect** exists: **Requirement 4 (Stitch MCP Template Gallery)** is completely missing from application routing (`App.tsx`) and navigation (`AppShell.tsx`), rendering the gallery unreachable in the UI. Additionally, **Major UX Defects** were identified in Requirement 2 where filter controls in `AgentsDirectory` are unbound to component state, and `AgentDetail` hardcodes `AGT-009` data regardless of the URL route parameter.

---

## 1. Observation

### R1: Command Center Telemetry Dashboard
- **File**: `frontend/src/pages/Dashboard.tsx`
  - Stat cards link to `/agents`, `/logs`, `/alerts`, `/agent/AGT-009` (lines 28–63).
  - Metric Chart (lines 93–224): Built using `react-chartjs-2` (`Line`), registers Chart.js modules, listens to `useWebSocket()` messages, and dynamically updates rolling `chartData` (labels, risk index, anomaly score, CPU load).
  - Infrastructure Nodes panel (lines 226–251): Renders Primary-Alpha (14ms), Worker-Node-01 (28ms), Worker-Node-02 (23ms), Ingress-Proxy (89ms) with status indicators.
- **File**: `frontend/src/ws/WebSocketContext.tsx`
  - Manages WebSocket connection status (`LIVE`, `CONNECTING`, `OFFLINE`).
  - Implements automatic mock telemetry fallback interval (4s) when offline or in dev mode (lines 128–147).
  - Provides `isPaused` and `togglePause()` state (lines 58, 63).

### R2: Agent Management & Diagnostics
- **File**: `frontend/src/pages/Agents.tsx` & `frontend/src/components/stitch/AgentsDirectory.tsx`
  - Renders grid of agent cards (`mockAgents`, lines 4–78). Cards display agent ID, name, status, risk score, uptime, total actions, and 24h sparkline trend bars.
  - **Defect (Unbound Filters)**: In `AgentsDirectory.tsx` lines 91–122, search input, status `<select>`, and risk `<input type="range">` have static default values with no `onChange` handlers or state bindings. User input does not filter `mockAgents`.
  - **Defect (JSX Syntax Bug)**: In `AgentsDirectory.tsx` line 195:
    ```tsx
    className="absolute -top-1 -right-1 size-2.5 rounded-full bg-[var(--status-danger)] border-2 border-[var(--bg-surface)] {agent.status === 'suspended' && 'pulse-dot-red'}"
    ```
    The JSX expression `{agent.status === 'suspended' && 'pulse-dot-red'}` is inside double quotes, causing raw text literal output in HTML class attributes.
- **File**: `frontend/src/pages/AgentDetail.tsx` & `frontend/src/components/stitch/AgentDetailDirectory.tsx`
  - Renders header with `AGT-009`, SVG risk gauge (`strokeDasharray="175.9"`, `strokeDashoffset="28.1"` for score 84/100), session duration (`2h 34m`), action timeline, risk score trend chart, associated alerts table (`ALT-9921`).
  - Isolation controls (lines 59–69): `handleIsolateAgent()` updates `agentStatus` state to `'suspended'`, displays top red banner `"AGENT ISOLATED & SUSPENDED FROM NETWORK"`, and updates button label to `"ISOLATED"`.
  - **Defect (Hardcoded Agent ID)**: `AgentDetailDirectory.tsx` does not read `useParams()` from `react-router-dom`. Navigating to `/agent/AGT-042` or `/agent/AGT-117` still displays `AGT-009` data.

### R3: Alerts Triage & Forensic Analysis
- **File**: `frontend/src/pages/Alerts.tsx` & `frontend/src/components/stitch/AlertsDirectory.tsx`
  - Renders alerts table with filters for status, severity, agent ID search.
  - CSV Export (lines 83–104): `handleExportCSV()` creates client-side Blob (`agentshield_alerts.csv`) and triggers download.
- **File**: `frontend/src/pages/AlertsTriage.tsx` & `frontend/src/components/stitch/AlertsTriageDirectory.tsx`
  - Raw JSON viewer (lines 189–193): Displays formatted JSON payload in `<pre><code className="language-json">`.
  - COPY JSON feedback (lines 50–64): `handleCopyJson()` copies JSON payload to clipboard and displays `"COPIED!"` badge for 2 seconds.
  - Remediation buttons (lines 203–233): `Dismiss Alert`, `Isolate Agent`, and `Halt Process` buttons update state (`alertStatus`, `agentStatus`) and display context-specific status banners.

### R4: Stitch MCP Template Gallery
- **File**: `frontend/src/pages/StitchView.tsx` & `frontend/src/stitch/StitchScreen.tsx`
  - `StitchView.tsx` defines 29 Stitch template definitions (`STITCH_SCREENS`, lines 5–35) and renders a `<select>` dropdown template switcher.
  - `StitchScreen.tsx` wraps an `<iframe>` container.
- **CRITICAL DEFECT (Unrouted Feature)**:
  - In `frontend/src/App.tsx` lines 17–29:
    ```tsx
    <Routes>
      <Route path='/' element={<Dashboard/>} />
      <Route path='/dashboard' element={<Dashboard/>} />
      <Route path='/alerts' element={<Alerts/>} />
      <Route path='/alerts/triage' element={<AlertsTriage/>} />
      <Route path='/agents' element={<Agents/>} />
      <Route path='/agent/:id' element={<AgentDetail/>} />
      <Route path='/rules' element={<Rules/>} />
      <Route path='/settings' element={<Settings/>} />
      <Route path='/login' element={<Login/>} />
      <Route path='/logs' element={<Logs/>} />
      <Route path='*' element={<div className='p-8'>Not Found — <Link to='/'>Home</Link></div>} />
    </Routes>
    ```
  - Routes `/stitch` and `/stitch/:id` are **MISSING** from `App.tsx`.
  - Sidebar navigation in `frontend/src/components/AppShell.tsx` lines 4–11 contains no link to `/stitch`.
  - Direct navigation to `/stitch` renders the `*` 404 Not Found fallback.

### Build Verification Command
- Executed `npm run build` in `frontend/` directory:
  - Command: `vite build`
  - Output: Completed in 6.12s, 56 modules transformed, 0 build errors.

---

## 2. Logic Chain

1. **Observation**: `StitchView.tsx` exists with 29 template configurations, but `App.tsx` does not route `/stitch` or `/stitch/:id`, and `AppShell.tsx` contains no navigation link to Stitch Gallery.  
   **Deduction**: The R4 feature requirement ("Stitch MCP Template Gallery iframe container, switcher for all 29+ templates") is implemented in code isolation but completely inaccessible to end users via application routing or UI navigation. This constitutes a **Critical Defect / Integrity Violation** in feature completeness.

2. **Observation**: In `AgentsDirectory.tsx`, inputs for search, status, and risk threshold do not bind `value` or `onChange` to React state.  
   **Deduction**: User interaction with the filter toolbar produces no UI updates, leaving users unable to filter agents in the directory (**Major UX Defect**).

3. **Observation**: `AgentDetailDirectory.tsx` renders static title `"AGT-009"` and fixed mock data without invoking `useParams()`.  
   **Deduction**: Navigating to any agent detail route (e.g. `/agent/AGT-042`) always displays `AGT-009`, breaking dynamic route parameter contract (**Major UX Defect**).

4. **Observation**: In `AgentsDirectory.tsx` line 195, JSX template literal interpolation was omitted inside quotes: `... border-2 border-[var(--bg-surface)] {agent.status === 'suspended' && 'pulse-dot-red'}`.  
   **Deduction**: HTML output contains literal text string `{agent.status === 'suspended' && 'pulse-dot-red'}` in class names rather than evaluating the conditional class name (**Minor Code Quality Issue**).

5. **Observation**: Build command (`npm run build`) compiles cleanly without syntax or TypeScript errors. R1 (Dashboard telemetry & dynamic Chart.js chart) and R3 (Alerts Triage, JSON copy feedback, CSV export, remediation actions) pass core functional requirements.  
   **Deduction**: Core telemetry and triage features are solid, but R4 routing and R2 interactivity gaps prevent approval.

---

## 3. Caveats

- **No Automated Test Files**: No Vitest/Jest test suites exist in the `frontend` workspace to evaluate automated assertion coverage.
- **Mock WebSocket**: The WebSocket context uses mock telemetry loops when no live backend server is attached; actual backend WS behavior was evaluated via mock stream contract.

---

## 4. Quality & Adversarial Review Findings

### Review Findings

#### [Critical] Finding 1: Requirement 4 (Stitch MCP Template Gallery) is Unrouted and Inaccessible
- **What**: `/stitch` and `/stitch/:id` routes are omitted from `App.tsx`, and no navigation link exists in `AppShell.tsx`.
- **Where**: `frontend/src/App.tsx:17-29` & `frontend/src/components/AppShell.tsx:4-11`.
- **Why**: Users cannot access the Stitch Template Gallery (R4) via URL or navigation menu; accessing `/stitch` leads to 404 Not Found.
- **Suggestion**: Add `<Route path='/stitch' element={<StitchView />} />` and `<Route path='/stitch/:id' element={<StitchView />} />` to `App.tsx`, and add `{ to: '/stitch', label: 'Stitch Gallery', icon: 'auto_awesome' }` to `primaryNav` in `AppShell.tsx`.

#### [Major] Finding 2: Unbound Directory Filter Controls in Agent Management (R2)
- **What**: Search, Status Dropdown, and Risk Slider in `AgentsDirectory.tsx` are static HTML elements not bound to state.
- **Where**: `frontend/src/components/stitch/AgentsDirectory.tsx:87-122`.
- **Why**: Users cannot search or filter agents by status or risk score.
- **Suggestion**: Add `useState` hooks for `searchTerm`, `statusFilter`, and `riskFilter` in `AgentsDirectory.tsx` and filter `mockAgents` dynamically.

#### [Major] Finding 3: Static Agent Detail Page Ignores Route Parameters (R2)
- **What**: `AgentDetailDirectory.tsx` hardcodes `AGT-009` data and does not utilize `useParams()`.
- **Where**: `frontend/src/components/stitch/AgentDetailDirectory.tsx:3-36`.
- **Why**: Navigating to `/agent/<ANY_ID>` always displays static details for `AGT-009`.
- **Suggestion**: Import `useParams` in `AgentDetailDirectory.tsx` or `AgentDetail.tsx` and display the requested agent ID.

#### [Minor] Finding 4: JSX String Interpolation Syntax Error in Agent Card Class Name
- **What**: Unescaped JSX logic string inside HTML class attribute: `{agent.status === 'suspended' && 'pulse-dot-red'}`.
- **Where**: `frontend/src/components/stitch/AgentsDirectory.tsx:195`.
- **Why**: Renders raw JavaScript expression text inside class attribute.
- **Suggestion**: Convert to template literal: `` className={`... ${agent.status === 'suspended' ? 'pulse-dot-red' : ''}`} ``.

---

## 5. Verified Claims & Stress Test Matrix

| Claim / Requirement | Verification Method | Status | Notes |
|---|---|---|---|
| R1: Real-time Telemetry Dashboard | Source Inspection (`Dashboard.tsx`, `WebSocketContext.tsx`) | **PASS** | Dynamic Chart.js chart, live status, node latency, WS fallback all functional. |
| R2: Agent Management & Diagnostics | Source Inspection (`AgentsDirectory.tsx`, `AgentDetailDirectory.tsx`) | **PARTIAL** | AGT-009 detail, SVG gauge, session duration, and isolation button work; filters & route params are unbound. |
| R3: Alerts Triage & Forensic Analysis | Source Inspection (`AlertsDirectory.tsx`, `AlertsTriageDirectory.tsx`) | **PASS** | JSON payload viewer, COPY JSON feedback, CSV export, and remediation buttons work as expected. |
| R4: Stitch Template Gallery | Route Inspection (`App.tsx`, `AppShell.tsx`, `StitchView.tsx`) | **FAIL** | Component exists, but missing from `App.tsx` routes and sidebar navigation. |
| Build Integrity | `npm run build` in `frontend/` | **PASS** | Vite build finished cleanly in 6.12s without errors. |

---

## 6. Conclusion & Recommendation

**Verdict**: **REQUEST_CHANGES**

To reach full compliance for M5 preview release:
1. Route `StitchView` in `App.tsx` for `/stitch` and `/stitch/:id`, and add a sidebar item in `AppShell.tsx`.
2. Connect state bindings for Search, Status, and Risk filters in `AgentsDirectory.tsx`.
3. Wire `useParams()` in `AgentDetailDirectory.tsx` to display agent details based on URL parameters.
4. Fix class name string interpolation bug in `AgentsDirectory.tsx` line 195.

---

## 7. Independent Verification Instructions

1. **Verify Build**:
   ```powershell
   cd c:\Users\aditya\Downloads\AgentShield\frontend
   npm run build
   ```
2. **Inspect Unrouted Stitch Gallery**:
   Check `frontend/src/App.tsx` lines 17–29 and confirm `/stitch` is absent.
3. **Inspect Unbound Filters**:
   Inspect `frontend/src/components/stitch/AgentsDirectory.tsx` lines 87–122 and observe lack of `value`/`onChange` handlers.
4. **Inspect Route Param Handling**:
   Inspect `frontend/src/components/stitch/AgentDetailDirectory.tsx` and observe absence of `useParams()`.
