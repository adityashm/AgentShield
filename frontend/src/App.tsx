import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import AppShell from './components/AppShell'
import Dashboard from './pages/Dashboard'
import Alerts from './pages/Alerts'
import AlertsTriage from './pages/AlertsTriage'
import Agents from './pages/Agents'
import AgentDetail from './pages/AgentDetail'
import Rules from './pages/Rules'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Logs from './pages/Logs'
import Audit from './pages/Audit'
import Onboarding from './pages/Onboarding'
import Integrations from './pages/Integrations'
import SimulatorLab from './pages/SimulatorLab'
import Compliance from './pages/Compliance'
import RedTeamArena from './pages/RedTeamArena'
import ThreatGraph from './pages/ThreatGraph'
import MemoryShield from './pages/MemoryShield'

export default function App() {
  return (
    <Routes>
      {/* Standalone Login Terminal */}
      <Route path="/login" element={<Login />} />

      {/* Main Mission Control Application Shell */}
      <Route
        path="/*"
        element={
          <AppShell>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/alerts/triage" element={<AlertsTriage />} />
              <Route path="/alerts/triage/:id" element={<AlertsTriage />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/agent/:id" element={<AgentDetail />} />
              <Route path="/threat-graph" element={<ThreatGraph />} />
              <Route path="/topology" element={<ThreatGraph />} />
              <Route path="/redteam" element={<RedTeamArena />} />
              <Route path="/red-team" element={<RedTeamArena />} />
              <Route path="/memory-shield" element={<MemoryShield />} />
              <Route path="/memory" element={<MemoryShield />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/simulator" element={<SimulatorLab />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/compliance" element={<Compliance />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/*" element={<Settings />} />
              <Route
                path="*"
                element={
                  <div className="p-8 font-mono text-sm">
                    <span className="text-[var(--status-danger)]">[404 NOT FOUND]</span> Page does not exist. —{' '}
                    <Link to="/" className="text-[var(--primary)] underline">
                      Return to Mission Control
                    </Link>
                  </div>
                }
              />
            </Routes>
          </AppShell>
        }
      />
    </Routes>
  )
}