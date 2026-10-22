# Explorer 2 Handoff Report: Stitch Template & Design Tokens Analysis

## 1. Observation

### 1.1 Repository Template Directories & File Counts
Direct filesystem search across `c:\Users\aditya\Downloads\AgentShield` revealed three locations containing Stitch design assets:
1. **Primary Root Source**: `c:\Users\aditya\Downloads\AgentShield\stitch_downloads\`
   - **48 HTML template files** (`000_Agent_Simulator_Control.html` through `047_Compliance___Audit_Vault.html`).
   - **30 PNG screenshot files** (e.g. `003_Dashboard_screenshot.png`, `042_System_Health_Analytics_screenshot.png`).
2. **Frontend Static Asset Directory**: `c:\Users\aditya\Downloads\AgentShield\frontend\public\stitch_downloads\`
   - **48 HTML template files** (identical mirror of root source, served statically by Vite dev server at `/stitch_downloads/...`).
   - **30 PNG screenshot files** (identical mirror of root source).
3. **Build Output Directory**: `c:\Users\aditya\Downloads\AgentShield\frontend\dist\stitch_downloads\`
   - Generated upon running `npm run build`.

### 1.2 Catalog of All 48 HTML Templates
The 48 HTML files are categorized into 32 named feature templates (including 29 core distinct screens mapped in the gallery) and 16 iterative prototype files:

#### A. Core Mapped Gallery Templates (29 Named Templates in `StitchView.tsx`)
1. `000_Agent_Simulator_Control.html` — Agent Simulator Control Panel
2. `002_Simulator_Configuration.html` — Simulator Configuration Setup
3. `003_Dashboard.html` — AgentShield AI Command Center Dashboard
4. `008_Communication_Log__AGT-009.html` — Communication Log for Agent AGT-009
5. `009_Login__AgentShield_AI.html` — Login & Authentication Screen
6. `011_Alert_Triage__Prompt_Injection_Detected.html` — Alert Triage Detail (Prompt Injection Incident)
7. `012_Security_Status_Report.html` — Security Status Executive Report
8. `013_Rule_Manager.html` — Guardrail Rule Manager Table
9. `014_Global_System_Settings__Refined.html` — Global System Settings View
10. `017_Agent_Detail__AGT-009.html` — Agent Profile & Detail (AGT-009)
11. `019_Threat_Intel_Knowledge_Base.html` — Threat Intelligence Knowledge Base
12. `020_Isolate_Agent_Confirmation.html` — Isolate Agent Action Confirmation Modal
13. `021_System_Logs__SIEM_Export_Enabled.html` — System Logs (SIEM Export Active)
14. `023_Agents_Directory.html` — Agents Directory Card Grid View
15. `026_Alerts_Management.html` — Alerts Management Workspace
16. `027_Communication_Log__AGT-009.html` — Communication Log (Alternate View)
17. `028_Support_Center.html` — Support Center & Help Hub
18. `029_SIEM_Configuration.html` — SIEM Integration Settings
19. `030_System_Settings.html` — Core System Settings Panel
20. `031_User_Guide.html` — User Onboarding Guide & Documentation
21. `032_System_Logs.html` — Standard System Logs Table View
22. `033_Rule_Manager__New_Guardrail_Added.html` — Rule Manager (Guardrail Added State)
23. `037_Forensic_Log__Prompt_Injection_Analysis.html` — Forensic Deep Analysis Log
24. `039_System_Logs.html` — System Logs (Secondary Iteration)
25. `041_Agent_Configuration__AGT-009.html` — Agent Configuration Form (AGT-009)
26. `042_System_Health_Analytics.html` — System Health Analytics & Chart Dashboard
27. `044_Alerts_Triage.html` — Alerts Triage Queue
28. `045_Agents_Directory.html` — Agents Directory (Alt Grid View)
29. `047_Compliance___Audit_Vault.html` — Compliance & Audit Record Vault

#### B. Additional Named Templates (3 Files)
30. `006_AgentShield_AI__Command_Center_-_PRD.html` — Command Center PRD Spec View
31. `022_AgentShield_AI_Platform.html` — Platform Overview Landing Page
32. `036_Support_Center.html` — Support Center Secondary View

#### C. Untitled / Iterative Prototypes (16 Files)
33. `001_Untitled_Prototype.html`
34. `004_Untitled_Prototype.html`
35. `005_Untitled_Prototype.html`
36. `007_Untitled_Prototype.html`
37. `038_Untitled_Prototype.html`
38. `040_Untitled_Prototype.html`
39. `043_Untitled_Prototype.html`
40. `046_Untitled_Prototype.html`
41. `010_Untitled_Prototype.html`
42. `015_Untitled_Prototype.html`
43. `016_Untitled_Prototype.html`
44. `018_Untitled_Prototype.html`
45. `024_Untitled_Prototype.html`
46. `025_Untitled_Prototype.html`
47. `034_Untitled_Prototype.html`
48. `035_Untitled_Prototype.html`

### 1.3 Design Token Structure & CSS Variables
Inspection of `stitch_downloads/003_Dashboard.html` and `frontend/src/styles/tailwind.css` confirmed the exact design token schema used across the Stitch design system:

| Token Name | Color / Value | Usage Description |
| --- | --- | --- |
| `--primary` / `primary` | `#00D4FF` | Electric Cyan accent, brand color, active borders, glowing status |
| `--bg-base` / `bg-base` | `#0D1117` / `#10141a` | Darkest background color for application shell |
| `--bg-surface` / `bg-surface` | `#161B22` | Card, sidebar, topbar, and panel surface background |
| `--bg-raised` / `bg-raised` | `#1C2128` | Elevated container, dropdown, and active item background |
| `--bg-hover` / `bg-hover` | `#21262D` | Hover state background for interactive items |
| `--text-main` / `text-main` | `#E6EDF3` | High-contrast main body & heading text |
| `--text-muted` / `text-muted` | `#8B949E` | Secondary label, timestamp, and icon muted text |
| `--border-color` / `border-color` | `#30363D` | Standard 1px border color across dark panels |
| `--status-success` | `#238636` | Green online / nominal status |
| `--status-info` | `#2F81F7` | Blue info badge / notification status |
| `--status-warning` | `#D29922` | Amber warning / medium risk score status |
| `--status-danger` | `#F85149` | Bright Red high risk score / alert / suspended status |
| Fonts | `IBM Plex Sans`, `JetBrains Mono` | Sans typography for UI, Mono for IDs, logs, metrics |

### 1.4 Frontend Integration Architecture
Inspection of the React frontend in `frontend/src/`:
- **App Navigation**: `AppShell.tsx:11` defines a sidebar navigation item `{ to: '/stitch/003', label: 'Stitch Gallery', icon: 'view_in_ar' }`.
- **Router Setup**: `App.tsx:29` maps the route `<Route path='/stitch/:id' element={<StitchView/>} />`.
- **Template Selector View**: `frontend/src/pages/StitchView.tsx` defines a hardcoded array `STITCH_SCREENS` containing 29 template mappings (`id` -> `file: '/stitch_downloads/<filename>.html'`).
- **Current Rendering Engine**: `frontend/src/stitch/StitchScreen.tsx` fetches HTML text (`fetch(src).then(r => r.text())`) and injects it using React's `<div dangerouslySetInnerHTML={{ __html: html }} />`.

---

## 2. Logic Chain

1. **Asset Storage & Accessibility**:
   - Because Vite serves files placed in `frontend/public/` directly at the root URL path (e.g. `/stitch_downloads/003_Dashboard.html`), placing `stitch_downloads/` in `frontend/public/` allows client-side code (`fetch` or `<iframe>`) to load any of the 48 HTML files and 30 PNG screenshots over standard HTTP GET without backend endpoints.

2. **Rendering Bottleneck in Current `StitchScreen.tsx` Implementation**:
   - `StitchScreen.tsx` currently renders HTML using `dangerouslySetInnerHTML`.
   - **Problem 1 (Script Execution)**: HTML template files contain embedded scripts (`<script src="https://cdn.tailwindcss.com">` and `<script id="tailwind-config">`). Browsers do not execute `<script>` elements injected via `dangerouslySetInnerHTML`. Consequently, Tailwind utility classes inside the template relying on runtime CDN processing or custom `tailwind.config` extensions may fail or render inconsistently.
   - **Problem 2 (CSS Leakage & Contamination)**: Global CSS rules inside injected `<head><style>` tags leak into the host React AppShell, overriding global body fonts, margins, or CSS variables.

3. **Optimal Render Architecture for R4 Template Gallery**:
   - Replacing `dangerouslySetInnerHTML` in `StitchScreen.tsx` with an `<iframe>` component (`<iframe src={src} className="w-full h-[calc(100vh-180px)] border-0 rounded-sm" title={currentScreen.label} />`):
     - Provides complete DOM and CSS isolation.
     - Automatically executes embedded Tailwind CDN scripts and Google Font imports.
     - Allows instant dynamic switching between all 48 templates without re-parsing HTML string data in React memory.

---

## 3. Caveats

1. **Template Count vs. Mapped Gallery Items**:
   - There are **48 total HTML templates** on disk in `stitch_downloads/`. `StitchView.tsx` currently lists **29 templates** in its dropdown. The remaining 19 templates comprise 3 additional named screens (`006`, `022`, `036`) and 16 untitled prototypes (`001`, `004`, `005`, etc.).
2. **Stitch MCP Live Connection**:
   - Offline templates are stored locally in `frontend/public/stitch_downloads/`. If live generation or modification via the `stitch` MCP server is required, the `STITCH_API_KEY` script (`setup-stitch-mcp.ps1`) must be executed to set environment variables.
3. **Read-Only Scope**:
   - Explorer 2 is read-only. Proposed enhancements to `StitchView.tsx` or `StitchScreen.tsx` must be executed by Implementer / Frontend agents.

---

## 4. Conclusion

- **Asset Verification**: Exactly **48 HTML templates** and **30 PNG screenshots** exist in `stitch_downloads/` and `frontend/public/stitch_downloads/`.
- **Design Tokens**: Design tokens are codified in `frontend/src/styles/tailwind.css` using CSS custom variables matching the dark theme palette (`#00D4FF` primary cyan, `#0D1117` base dark, `#161B22` surface dark, `#1C2128` raised dark, `#30363D` border).
- **Gallery Mechanism**: The frontend currently routes `/stitch/:id` to `StitchView.tsx` which renders template files via `StitchScreen.tsx`.
- **Recommended Enhancement**: Upgrade `StitchScreen.tsx` from `dangerouslySetInnerHTML` to an `<iframe>` container and expand `STITCH_SCREENS` in `StitchView.tsx` to dynamically cover all templates with toggle options for HTML view vs PNG screenshot preview.

---

## 5. Verification Method

To verify these findings independently:
1. **Count HTML & PNG Files**:
   - `Get-ChildItem -Path "c:\Users\aditya\Downloads\AgentShield\stitch_downloads\*.html" | Measure-Object` (Result: 48)
   - `Get-ChildItem -Path "c:\Users\aditya\Downloads\AgentShield\stitch_downloads\*.png" | Measure-Object` (Result: 30)
2. **Inspect Frontend Gallery**:
   - Open `frontend/src/pages/StitchView.tsx` and inspect lines 5-35 to observe the 29 registered template routes.
   - Open `frontend/src/stitch/StitchScreen.tsx` to observe the `dangerouslySetInnerHTML` fetch loader.
3. **Inspect Design Tokens**:
   - Open `frontend/src/styles/tailwind.css` to verify CSS custom properties `:root`.
   - Open `stitch_downloads/003_Dashboard.html` lines 15-52 to observe embedded `<script id="tailwind-config">`.
