# Empirical Verification & Adversarial Challenge Report

**Role**: Challenger 2 (Interactive Controls & Stream Challenger)  
**Target Directory**: `c:\Users\aditya\Downloads\AgentShield\frontend`  
**Working Directory**: `c:\Users\aditya\Downloads\AgentShield\.agents\teamwork_preview_challenger_m5_2`  
**Date**: 2026-07-26  

---

## Challenge Summary

**Overall risk assessment**: MEDIUM

| Component | Target File | Assessment | Summary of Findings |
|---|---|---|---|
| WebSocket Context State Machine & Stream | `src/ws/WebSocketContext.tsx` | HIGH RISK FLAW | State machine correctly implements `LIVE`/`CONNECTING`/`OFFLINE` and 4s mock stream. However, toggling `isPaused` tears down and recreates the WebSocket connection due to `isPaused` dependency in `useEffect`. `setEndpoint` topic subscription is defined but uncalled in UI. |
| Dynamic Telemetry Chart.js Updates | `src/pages/Dashboard.tsx` | LOW RISK | Telemetry rolling window correctly maintains 8 data points and updates on incoming events. Deduplicates same-second events. Initial labels use `HH:MM` while live stream uses `HH:MM:SS`. |
| Clipboard & CSV Blob Handlers | `src/components/stitch/AlertsTriageDirectory.tsx`, `AlertsDirectory.tsx` | MEDIUM RISK FLAW | Clipboard handler falsely sets `"COPIED!"` UI state even when `writeText()` fails or API is unavailable. CSV export correctly constructs Blob and Object URL, but does not quote/escape CSV fields containing commas. |
| StitchScreen & Template Resolution | `src/stitch/StitchScreen.tsx`, `public/stitch_downloads/` | MEDIUM RISK FLAW | `StitchScreen` iframe cleanly isolates wireframe CSS/DOM. All 29 gallery files exist. However, 23 of 48 templates contain 51 unexpanded `{{DATA:SCREEN:...}}` placeholders and relative HTML hrefs causing 404 navigation failures. |

---

## 1. Observation

### Observation 1.1: WebSocket Context State Machine & Pause Socket Teardown
- **File**: `c:\Users\aditya\Downloads\AgentShield\frontend\src\ws\WebSocketContext.tsx`
- **Lines 57-60, 80-154**:
  ```tsx
  const [status, setStatus] = useState<ConnectionStatus>('CONNECTING')
  const [isPaused, setIsPaused] = useState<boolean>(false)
  const [customEndpoint, setCustomEndpoint] = useState<string | null>(null)
  ...
  useEffect(() => {
    ...
    return () => {
      if (wsRef.current) wsRef.current.close()
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      if (mockInterval) clearInterval(mockInterval)
    }
  }, [wsUrl, isPaused])
  ```
- **Observed Behavior**:
  - `status` correctly transitions between `'CONNECTING'`, `'LIVE'` (on `ws.onopen`), and `'OFFLINE'` (on `ws.onclose`, `ws.onerror`, or exception).
  - Exponential backoff algorithm is implemented: `Math.min(1000 * Math.pow(2, attempts), 10000)`.
  - 4-second mock fallback stream interval runs every 4000ms, pushing `ACTION_EVENT` objects to `messages` state (capped at 100).
  - Topic subscription is implemented via `setEndpoint`: resolving `/ws/agent/${id}` updates `wsUrl` and reconnects to the agent topic. However, `grep` search across `src/` confirmed that `setEndpoint` is only defined in `WebSocketContext.tsx` and never called by any component in `src/pages/` or `src/components/`.
  - **Teardown Bug**: When `togglePause()` is called, `isPaused` changes state. Because `isPaused` is in the `useEffect` dependency array (`[wsUrl, isPaused]`), the effect cleanup triggers `wsRef.current.close()`, disconnecting the socket and reconnecting from scratch.

### Observation 1.2: Dynamic Chart.js Telemetry Updating in Dashboard.tsx
- **File**: `c:\Users\aditya\Downloads\AgentShield\frontend\src\pages\Dashboard.tsx`
- **Lines 93-126**:
  ```tsx
  useEffect(() => {
    if (!messages || messages.length === 0) return
    const latest = messages[0]
    const timeLabel = latest.time ? latest.time.split('.')[0] : new Date().toLocaleTimeString().slice(0, 5)
    ...
    setChartData((prev) => {
      if (prev.labels[prev.labels.length - 1] === timeLabel) return prev
      return {
        labels: [...prev.labels.slice(1), timeLabel],
        riskIndex: [...prev.riskIndex.slice(1), newRisk],
        anomalyScore: [...prev.anomalyScore.slice(1), newAnomaly],
        cpuLoad: [...prev.cpuLoad.slice(1), newCpu],
      }
    })
  }, [messages])
  ```
- **Observed Behavior**:
  - Chart maintains a rolling window of size 8.
  - Same-second messages (where `time.split('.')[0]` matches `prev.labels[prev.labels.length - 1]`) are correctly ignored.
  - Initial labels are 5-character `"14:25"` (`HH:MM`), whereas incoming messages set 8-character `"14:32:41"` (`HH:MM:SS`), causing a visual format shift on the x-axis.

### Observation 1.3: Clipboard Handler False Positives & CSV Column Misalignment
- **File**: `c:\Users\aditya\Downloads\AgentShield\frontend\src\components\stitch\AlertsTriageDirectory.tsx` (Lines 50-64)
- **File**: `c:\Users\aditya\Downloads\AgentShield\frontend\src\components\stitch\AlertsDirectory.tsx` (Lines 83-104)
- **Code Snippet (`AlertsTriageDirectory.tsx`)**:
  ```tsx
  const handleCopyJson = (): void => {
    const jsonStr = JSON.stringify(alertData.payload, null, 2)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonStr).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }).catch(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    } else {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  ```
- **Observed Behavior**:
  - `handleCopyJson` calls `setCopied(true)` in the `.catch()` block when `writeText()` rejects AND in the `else` block when `navigator.clipboard` is missing. The UI shows `"COPIED!"` even when copy fails.
- **Code Snippet (`AlertsDirectory.tsx`)**:
  ```tsx
  const rows = filteredAlerts.map((a) => [
    a.id,
    a.agentId,
    a.triggerType,
    a.severity,
    a.riskScore,
    `"${a.timestamp}"`,
    a.status,
  ])
  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  ```
- **Observed Behavior**:
  - `handleExportCSV` correctly creates a Blob with MIME type `text/csv;charset=utf-8;`, generates object URL via `URL.createObjectURL(blob)`, appends link element to `document.body`, triggers click, removes element, and calls `URL.revokeObjectURL(url)`.
  - However, fields such as `triggerType` or `agentId` are unquoted. If `triggerType` contains commas (e.g. `"anomaly, database injection"`), `r.join(',')` creates extra unescaped commas, breaking CSV parser column boundaries.

### Observation 1.4: StitchScreen Iframe Encapsulation & Asset Resolution
- **File**: `c:\Users\aditya\Downloads\AgentShield\frontend\src\stitch\StitchScreen.tsx`
- **File**: `c:\Users\aditya\Downloads\AgentShield\frontend\src\pages\StitchView.tsx`
- **Directory**: `c:\Users\aditya\Downloads\AgentShield\frontend\public\stitch_downloads\`
- **Observed Behavior**:
  - `StitchScreen` renders an `<iframe>` container element with `className="w-full h-[calc(100vh-180px)] border-0 rounded-sm"`, cleanly isolating Stitch CSS resets, custom styles, and external fonts from parent React styling.
  - `StitchView.tsx` defines 29 screens in `STITCH_SCREENS`. Verification confirmed all 29 gallery HTML files exist on disk in `public/stitch_downloads/`.
  - Inspection of all 48 HTML files in `public/stitch_downloads/` revealed 23 files containing 51 unresolved template placeholders (`{{DATA:SCREEN:SCREEN_*}}`) and relative HTML links (`href="index.html"`, `href="agents.html"`). Clicking these internal wireframe links inside the iframe leads to broken 404 requests.

---

## 2. Logic Chain

1. **WebSocket Pause Teardown**:
   - `useEffect` in `WebSocketContext.tsx` depends on `[wsUrl, isPaused]`.
   - When `isPaused` state changes, React executes the effect cleanup function (`wsRef.current.close()`) before running the effect body.
   - Therefore, toggling feed pause forces a WebSocket disconnection and reconnect loop, which disrupts real-time stream state unnecessarily.
2. **Topic Subscription Disconnect**:
   - `WebSocketContext` provides `setEndpoint` to dynamically update `wsUrl` to `/ws/agent/${id}`.
   - However, because no UI components call `setEndpoint`, the frontend never utilizes agent-specific topic channels (`/ws/agent/${id}`).
3. **False Positive Clipboard Feedback**:
   - In `AlertsTriageDirectory.tsx`, `setCopied(true)` is executed unconditionally across `.then()`, `.catch()`, and `else` branches.
   - If `navigator.clipboard.writeText` fails (e.g., non-secure HTTP context or user denied permission), the catch handler sets `copied = true`, misleading the user into thinking text was copied.
4. **CSV Escaping Defect**:
   - In `AlertsDirectory.tsx`, only `timestamp` is wrapped in double quotes.
   - When joining row fields using `.join(',')`, any field containing a comma creates extra CSV columns, causing spreadsheet software to shift data into incorrect columns.
5. **Stitch Template Navigation Failures**:
   - Exported Stitch HTML wireframes contain unpopulated template macro strings like `href="{{DATA:SCREEN:SCREEN_17}}"`.
   - When rendered inside `StitchScreen` iframe, clicking those links attempts to request `http://localhost:5173/stitch_downloads/{{DATA:SCREEN:SCREEN_17}}`, producing 404 errors.

---

## 3. Challenges & Stress Test Results

### Challenge 1: [High] WebSocket Reconnection Triggered by Feed Pause
- **Assumption challenged**: Toggling feed pause should only freeze UI message state updates.
- **Attack scenario**: User clicks "Pause Feed" button while connected to live backend stream.
- **Blast radius**: Active WebSocket connection is closed (`ws.close()`) and re-established from scratch.
- **Mitigation**: Remove `isPaused` from `useEffect` dependency array. Use a `useRef` for `isPaused` inside `onmessage` and `mockInterval` listeners so pause state is read dynamically without tearing down the WebSocket connection.

### Challenge 2: [Medium] False Positive Clipboard Copy UI Feedback
- **Assumption challenged**: Clicking "COPY JSON" indicates successful clipboard write.
- **Attack scenario**: User accesses application over non-HTTPS connection or in headless browser where `navigator.clipboard` rejects.
- **Blast radius**: UI displays `"COPIED!"`, but clipboard contains old/empty data. User paste operation fails.
- **Mitigation**: Only call `setCopied(true)` inside `.then()`. In `.catch()` and `else`, display an error state (e.g. `"COPY FAILED"`) or fallback to `document.execCommand('copy')`.

### Challenge 3: [Medium] Unescaped CSV Export Fields
- **Assumption challenged**: Exported CSV opens cleanly in Excel / Google Sheets without column corruption.
- **Attack scenario**: An alert has `triggerType` set to `"anomaly, database injection"`.
- **Blast radius**: CSV parser parses comma inside `triggerType` as a column delimiter, pushing Severity, Risk Score, Timestamp, and Status into wrong columns.
- **Mitigation**: Wrap all string fields in double quotes and escape internal double quotes: `\`"${String(val).replace(/"/g, '""')}"\``.

### Challenge 4: [Medium] Unresolved Stitch Template Hyperlinks
- **Assumption challenged**: All links in Stitch gallery wireframes navigate cleanly.
- **Attack scenario**: User clicks an internal navigation link inside the `StitchScreen` iframe view.
- **Blast radius**: Iframe navigates to `404 Not Found` page inside the iframe container.
- **Mitigation**: Intercept click events inside `StitchScreen` iframe or run a build script to replace `{{DATA:SCREEN:SCREEN_X}}` placeholders with React Router routes (`/stitch/X`).

---

## 4. Caveats

- Verification was conducted using synthetic unit/integration test harnesses (`verify_all.js`) and static AST/code analysis. No live external WebSocket server was running during testing; the 4-second mock stream was evaluated in offline mode.

---

## 5. Conclusion

- **Task 1**: WebSocket context state machine (`LIVE`, `CONNECTING`, `OFFLINE`) is functionally operational and 4s mock fallback stream generates proper telemetry objects. Topic subscription (`/ws/agent/${id}`) via `setEndpoint` works, but is uncalled in UI components. **Flagged High Risk Flaw**: Toggling feed pause closes and reconnects the WebSocket connection.
- **Task 2**: `Dashboard.tsx` dynamic Chart.js telemetry dataset updating operates correctly with fixed 8-item rolling window and timestamp deduplication. Minor format transition noted on x-axis labels.
- **Task 3**: Clipboard handler in `AlertsTriageDirectory.tsx` works with `navigator.clipboard.writeText`, but contains a **false positive UI flaw** on error/missing API. CSV export in `AlertsDirectory.tsx` constructs valid Blob, MIME type, Object URL, and DOM download trigger, but contains an **unescaped CSV field flaw**.
- **Task 4**: `StitchScreen.tsx` iframe container element effectively isolates wireframe CSS/DOM. All 29 gallery files in `StitchView.tsx` exist on disk. **Flagged Medium Risk Flaw**: 23 HTML files contain 51 unresolved `{{DATA:SCREEN:...}}` macro tags leading to 404 link navigation errors inside the iframe.

---

## 6. Verification Method

To independently verify these findings, run the empirical verification harness:

```bash
# Navigate to project root
cd c:\Users\aditya\Downloads\AgentShield

# Run Challenger 2 empirical test harness
node .agents/teamwork_preview_challenger_m5_2/verify_all.js

# Run frontend build to confirm compilation status
cd frontend
npm run build
```

**Invalidation Conditions**:
- If `isPaused` is removed from `useEffect` dependencies in `WebSocketContext.tsx`, Challenge 1 is resolved.
- If `setCopied(true)` is removed from `.catch()` and `else` blocks in `AlertsTriageDirectory.tsx`, Challenge 2 is resolved.
- If all fields in `handleExportCSV` are quoted and escaped in `AlertsDirectory.tsx`, Challenge 3 is resolved.
- If `{{DATA:SCREEN:...}}` tags in `public/stitch_downloads/*.html` are replaced with valid routes, Challenge 4 is resolved.
