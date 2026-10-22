import React, { PropsWithChildren, useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate, Link } from 'react-router-dom'
import { useWebSocket } from '../ws/WebSocketContext'
import { useAuth } from '../context/AuthContext'

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
  const { status } = useWebSocket()
  const { user, logout } = useAuth()
  const [currentTime, setCurrentTime] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)

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
          {primaryNav.map((item) => {
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
                    <span className="rounded-sm bg-[var(--status-danger)]/20 px-1.5 py-0.5 font-mono text-[10px] text-[var(--status-danger)]">
                      3 Active
                    </span>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <Link
                      to="/alerts/triage/ALT-9921"
                      onClick={() => setShowNotifications(false)}
                      className="block p-2 rounded hover:bg-[var(--bg-hover)] border-l-2 border-l-[var(--status-danger)]"
                    >
                      <div className="text-[var(--status-danger)] font-bold">ALT-9921 • Unauthorized DB Access</div>
                      <div className="text-[var(--text-muted)] text-[11px]">AGT-009 • Risk: 98.4</div>
                    </Link>
                    <Link
                      to="/alerts/triage/ALT-9920"
                      onClick={() => setShowNotifications(false)}
                      className="block p-2 rounded hover:bg-[var(--bg-hover)] border-l-2 border-l-[var(--status-warning)]"
                    >
                      <div className="text-[var(--status-warning)] font-bold">ALT-9920 • Prompt Injection Pattern</div>
                      <div className="text-[var(--text-muted)] text-[11px]">AGT-NY-12 • Risk: 82.1</div>
                    </Link>
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
      </div>
    </div>
  )
}