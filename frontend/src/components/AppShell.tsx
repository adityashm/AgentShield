import React, { PropsWithChildren, useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate, Link } from 'react-router-dom'
import { useWebSocket } from '../ws/WebSocketContext'
import { useAuth } from '../context/AuthContext'
import { getAlerts, Alert } from '../api'
import CommandPalette from './CommandPalette'

const primaryNav = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/onboarding', label: 'Quickstart', icon: 'rocket_launch' },
  { to: '/agents', label: 'Agents', icon: 'group' },
  { to: '/alerts', label: 'Alerts', icon: 'notifications_active', badge: '3' },
  { to: '/rules', label: 'Rules', icon: 'policy' },
  { to: '/logs', label: 'Logs', icon: 'terminal' },
  { to: '/audit', label: 'Audit Log', icon: 'verified_user' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

function Icon({ name, fill = false }: { name: string; fill?: boolean }) {
  return (
    <span
      className="material-symbols-outlined text-[20px]"
      style={fill ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}
    >
      {name}
    </span>
  )
}

export default function AppShell({ children }: PropsWithChildren) {
  const location = useLocation()
  const navigate = useNavigate()
  const { status, messages } = useWebSocket()
  const { user, logout } = useAuth()
  const [currentTime, setCurrentTime] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const [activeToast, setActiveToast] = useState<any | null>(null)
  const [topAlerts, setTopAlerts] = useState<Alert[]>([])
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const lastProcessedKeyRef = React.useRef<string | null>(null)

  // Live alerts count for sidebar badge and top bell
  useEffect(() => {
    async function loadAlerts() {
      try {
        const data = await getAlerts()
        if (data) {
          const openOnly = data.filter((a: any) => ['Open', 'open'].includes(a.status))
          setTopAlerts(openOnly.slice(0, 5))
        }
      } catch {}
    }
    loadAlerts()
  }, [messages])

  const dynamicNav = [
    { to: '/', label: 'Dashboard', icon: 'dashboard' },
    { to: '/onboarding', label: 'Quickstart', icon: 'rocket_launch' },
    { to: '/agents', label: 'Agents', icon: 'group' },
    { to: '/alerts', label: 'Alerts', icon: 'notifications_active', badge: topAlerts.length > 0 ? `${topAlerts.length}` : undefined },
    { to: '/rules', label: 'Rules', icon: 'policy' },
    { to: '/logs', label: 'Logs', icon: 'terminal' },
    { to: '/audit', label: 'Audit Log', icon: 'verified_user' },
    { to: '/settings', label: 'Settings', icon: 'settings' },
  ]

  // Real-time threat alert toast popup
  useEffect(() => {
    if (!messages || messages.length === 0) return
    const newest = messages[0]
    const key = `${newest.agent}_${newest.action}_${newest.time}_${newest.risk}`
    if (lastProcessedKeyRef.current === key) return
    lastProcessedKeyRef.current = key

    const riskNum = Number(newest.risk || 0)
    const isThreat =
      riskNum >= 70 ||
      newest.status === 'Critical' ||
      newest.status === 'High' ||
      newest.decision === 'deny' ||
      newest.tone === 'danger'

    if (isThreat) {
      setActiveToast(newest)
      const timer = setTimeout(() => {
        setActiveToast((curr: any) => (curr === newest ? null : curr))
      }, 9000)
      return () => clearTimeout(timer)
    }
  }, [messages])

  // Real-time UTC ticking clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const hours = now.getUTCHours().toString().padStart(2, '0')
      const minutes = now.getUTCMinutes().toString().padStart(2, '0')
      const seconds = now.getUTCSeconds().toString().padStart(2, '0')
      setCurrentTime(`${hours}:${minutes}:${seconds} UTC`)
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // Global Ctrl+K / Cmd+K Command Palette trigger
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Calculate dynamic breadcrumb based on pathname
  const getBreadcrumbs = () => {
    const path = location.pathname
    if (path === '/' || path === '/dashboard') return ['Dashboard']
    if (path === '/onboarding') return ['Quickstart Guide']
    if (path === '/agents') return ['Agents Directory']
    if (path.startsWith('/agent/')) {
      const agentId = path.split('/')[2]
      return ['Agents', agentId]
    }
    if (path === '/alerts') return ['Alerts Management']
    if (path.startsWith('/alerts/triage')) {
      const alertId = path.split('/')[3]
      return alertId ? ['Alerts', `Triage: ${alertId}`] : ['Alerts', 'Forensic Triage']
    }
    if (path === '/rules') return ['Rule Engine']
    if (path === '/logs') return ['System Logs']
    if (path === '/audit') return ['Cryptographic Audit Log']
    if (path === '/settings' || path.startsWith('/settings/')) return ['Settings']
    return ['Mission Control']
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-base)] text-[var(--text-main)]">
      {/* Sidebar Navigation */}
      <aside className="z-50 flex h-full w-[240px] flex-col border-r border-[var(--border-color)] bg-[var(--bg-surface)]">
        <div className="px-4 pb-6 pt-3">
          <Link to="/" className="flex items-center gap-2 text-[18px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            <Icon name="shield" fill />
            Mission Control
          </Link>
          <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-[var(--text-muted)] opacity-70">
            AgentShield AI v1.0
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-2">
          {dynamicNav.map((item) => {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => [
                  'flex items-center gap-3 rounded-sm px-3 py-2 text-[12px] font-medium transition-colors',
                  isActive
                    ? 'border-r-2 border-[var(--primary)] bg-[var(--bg-raised)] text-[var(--primary)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]',
                ].join(' ')}
              >
                <Icon name={item.icon} fill={item.label === 'Settings'} />
                <span className="font-button-label text-button-label">{item.label}</span>
                {item.badge ? (
                  <span className="ml-auto rounded-sm bg-[var(--status-danger)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </NavLink>
            )
          })}
        </nav>

        {/* User Info & Telemetry Status */}
        <div className="mt-auto border-t border-[var(--border-color)] p-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  status === 'LIVE'
                    ? 'bg-[var(--status-success)] shadow-[0_0_6px_#238636]'
                    : status === 'CONNECTING'
                    ? 'bg-[var(--status-warning)] animate-ping'
                    : 'bg-[var(--status-danger)]'
                }`}
              />
              <span className="font-mono text-[11px] text-[var(--text-muted)]">
                {status === 'LIVE' ? 'Sys: Nominal' : status === 'CONNECTING' ? 'Connecting...' : 'Sys: Offline'}
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase text-[var(--primary)]">
              {user?.role || 'Guest'}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-sm bg-[var(--bg-raised)] border border-[var(--border-color)] px-2.5 py-1.5">
            <div className="truncate mr-2">
              <div className="text-[12px] font-medium text-[var(--text-main)] truncate">{user?.name || 'Security Analyst'}</div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] truncate">@{user?.username || 'analyst'}</div>
            </div>
            <button
              onClick={() => {
                logout()
                navigate('/login')
              }}
              title="Sign Out"
              className="text-[var(--text-muted)] hover:text-[var(--status-danger)] transition-colors p-1"
            >
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-[24px]">
          {/* Dynamic Breadcrumb */}
          <div className="flex items-center gap-2 text-[14px] text-[var(--text-muted)]">
            <span>AgentShield AI</span>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb}>
                <span className="text-[14px] opacity-50">›</span>
                <span className={idx === breadcrumbs.length - 1 ? 'font-semibold text-[var(--text-main)]' : ''}>
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </div>

          {/* Right Header Badges & Actions */}
          <div className="flex items-center gap-3">
            {/* Quick Command & Search Pill */}
            <button
              onClick={() => setIsPaletteOpen(true)}
              className="flex items-center gap-2 rounded-sm border border-[var(--border-color)] bg-[var(--bg-raised)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--text-main)] transition-colors cursor-pointer group"
              title="Quick Command & Search (Ctrl+K / Cmd+K)"
            >
              <Icon name="search" />
              <span className="hidden md:inline font-mono text-[11px] text-[var(--text-muted)] group-hover:text-[var(--text-main)]">
                Command Palette...
              </span>
              <kbd className="hidden sm:inline-block rounded bg-[var(--bg-hover)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)] border border-[var(--border-color)]">
                Ctrl K
              </kbd>
            </button>

            {/* System Status Pill */}
            <div className="flex items-center gap-2 rounded-sm border border-[var(--border-color)] bg-[var(--bg-raised)] px-3 py-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  status === 'LIVE'
                    ? 'bg-[var(--status-success)] shadow-[0_0_4px_#238636]'
                    : status === 'CONNECTING'
                    ? 'bg-[var(--status-warning)] animate-ping'
                    : 'bg-[var(--status-danger)]'
                }`}
              />
              <span className="text-xs font-semibold text-[var(--text-main)]">
                {status === 'LIVE'
                  ? 'System Operational'
                  : status === 'CONNECTING'
                  ? 'Reconnecting Telemetry'
                  : 'Telemetry Dev Mode'}
              </span>
            </div>

            {/* Live UTC Clock */}
            <div className="rounded-sm border border-[var(--border-color)] bg-[var(--bg-raised)] px-3 py-1.5 font-mono text-sm text-[var(--text-muted)]">
              {currentTime || '00:00:00 UTC'}
            </div>

            {/* Notification Bell with Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative rounded-sm border border-transparent p-2 text-[var(--text-muted)] transition-colors hover:border-[var(--border-color)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)] cursor-pointer"
              >
                <Icon name="notifications" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--status-danger)] animate-pulse" />
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 rounded-sm border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 shadow-2xl z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)] mb-2">
                    <span className="font-mono text-xs font-semibold text-[var(--text-main)] uppercase tracking-wider">
                      Security Alerts
                    </span>
                    <span className="rounded-sm bg-[var(--status-danger)]/20 px-1.5 py-0.5 font-mono text-[10px] text-[var(--status-danger)] font-bold">
                      {topAlerts.length} Active
                    </span>
                  </div>
                  <div className="space-y-2 text-xs font-mono max-h-64 overflow-y-auto">
                    {topAlerts.length > 0 ? (
                      topAlerts.map((al) => (
                        <Link
                          key={al.id || al.alert_id}
                          to={`/alerts/triage/${al.id || al.alert_id}`}
                          onClick={() => setShowNotifications(false)}
                          className="block p-2 rounded hover:bg-[var(--bg-hover)] border-l-2 border-l-[var(--status-danger)] transition-colors"
                        >
                          <div className="text-[var(--status-danger)] font-bold truncate">
                            {al.id || al.alert_id} • {al.title || al.trigger_type || 'Security Violation'}
                          </div>
                          <div className="text-[var(--text-muted)] text-[11px] mt-0.5 flex items-center justify-between">
                            <span>{al.agent_id}</span>
                            <span className="font-bold text-red-400">Risk: {Math.round(al.risk_score)}</span>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="py-4 text-center text-[var(--text-muted)] text-xs">
                        No open security alerts
                      </div>
                    )}
                  </div>
                  <Link
                    to="/alerts"
                    onClick={() => setShowNotifications(false)}
                    className="block mt-3 pt-2 border-t border-[var(--border-color)] text-center font-mono text-[11px] text-[var(--primary)] hover:underline"
                  >
                    View All Alerts →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="min-h-0 flex-1 overflow-y-auto bg-[var(--bg-base)] p-[24px]">{children}</main>

        {/* Real-time Threat / Enforce Block Toast Popup */}
        {activeToast && (
          <div className="fixed bottom-6 right-6 z-50 flex max-w-md animate-bounce-once items-start gap-3 rounded-lg border-2 border-red-500 bg-[#0d1117] p-4 shadow-2xl shadow-red-950/80 backdrop-blur-md">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-500/20 text-red-400">
              <span className="material-symbols-outlined text-2xl">
                {activeToast.decision === 'deny' ? 'gavel' : 'warning'}
              </span>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                  {activeToast.decision === 'deny' ? 'THREAT BLOCKED (ENFORCE)' : 'SECURITY ALERT DETECTED'}
                </span>
                <button
                  onClick={() => setActiveToast(null)}
                  className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
              <div className="mt-1 font-semibold text-white text-sm">
                {activeToast.action || 'Suspicious Agent Action'}
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-gray-300">
                <span className="font-mono text-cyan-400">
                  Agent: {activeToast.agent || 'AGT-UNKNOWN'}
                </span>
                <span className="font-bold text-red-400">
                  Risk: {Math.round(Number(activeToast.risk || 90))}/100
                </span>
                {activeToast.time && (
                  <span className="text-gray-400 font-mono text-[11px]">{activeToast.time}</span>
                )}
              </div>
              {activeToast.reason && (
                <div className="mt-1.5 text-xs text-red-200/90 line-clamp-2 bg-red-950/40 p-1.5 rounded border border-red-900/40">
                  {activeToast.reason}
                </div>
              )}
              <div className="mt-2.5 flex items-center gap-2">
                <Link
                  to="/alerts"
                  onClick={() => setActiveToast(null)}
                  className="rounded bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-500 transition-colors shadow"
                >
                  View Alerts →
                </Link>
                <button
                  onClick={() => setActiveToast(null)}
                  className="rounded border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-700 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Command Palette */}
        <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />
      </div>
    </div>
  )
}