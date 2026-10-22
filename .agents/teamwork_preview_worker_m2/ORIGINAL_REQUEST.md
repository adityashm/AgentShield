## 2026-07-26T22:59:14Z
<USER_REQUEST>
You are Worker 2 (Frontend Fix Specialist).
Your working directory is: c:\Users\aditya\Downloads\AgentShield\.agents\teamwork_preview_worker_m2
Target frontend directory: c:\Users\aditya\Downloads\AgentShield\frontend

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Objective:
Remediate all 4 issues identified in Reviewer 2's audit and verify clean build + typecheck.

Tasks:
1. Fix R4 Routing & Navigation in `src/App.tsx` and `src/components/AppShell.tsx`:
   - Import `StitchView` in `src/App.tsx` and add routes: `<Route path='/stitch' element={<StitchView />} />` and `<Route path='/stitch/:id' element={<StitchView />} />`.
   - In `src/components/AppShell.tsx`, add `{ to: '/stitch', label: 'Stitch Gallery', icon: 'auto_awesome' }` to the `primaryNav` sidebar array.

2. Fix R2 Agent Directory Filtering in `src/components/stitch/AgentsDirectory.tsx`:
   - Add state variables: `const [searchTerm, setSearchTerm] = useState('')`, `const [statusFilter, setStatusFilter] = useState('all')`, `const [riskFilter, setRiskFilter] = useState(100)`.
   - Bind search input `value={searchTerm}` & `onChange={(e) => setSearchTerm(e.target.value)}`.
   - Bind status select `value={statusFilter}` & `onChange={(e) => setStatusFilter(e.target.value)}`.
   - Bind risk range slider `value={riskFilter}` & `onChange={(e) => setRiskFilter(Number(e.target.value))}`.
   - Filter `mockAgents` dynamically: matching ID/name with `searchTerm`, matching status (case-insensitive or `'all'`), and `riskScore <= riskFilter`. Map the filtered list into agent cards.
   - Fix class name bug on line 195: replace static text with conditional template literal: `className={`... ${agent.status === 'suspended' ? 'pulse-dot-red' : ''}`}`.

3. Fix R2 Agent Detail Dynamic Route Parameter in `src/components/stitch/AgentDetailDirectory.tsx`:
   - Import `useParams` from `react-router-dom`.
   - Read `const { id } = useParams()`, using `const currentAgentId = id || 'AGT-009'`.
   - Replace static `'AGT-009'` headers, badges, and breadcrumb strings with `currentAgentId`.

4. Verification:
   - Run `npx tsc --noEmit` and `npm run build` inside `c:\Users\aditya\Downloads\AgentShield\frontend`.
   - Confirm both commands exit cleanly with code 0.
   - Document output in `c:\Users\aditya\Downloads\AgentShield\.agents\teamwork_preview_worker_m2\handoff.md` and send message to orchestrator upon completion.
</USER_REQUEST>
