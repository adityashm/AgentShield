import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [username, setUsername] = useState('analyst_01')
  const [password, setPassword] = useState('agentshield')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) {
      setError('Username is required')
      return
    }
    const role = username.toLowerCase().includes('admin') ? 'admin' : 'analyst'
    login(username, role)
    navigate('/')
  }

  const handleQuickLogin = (userType: 'admin' | 'analyst') => {
    if (userType === 'admin') {
      setUsername('admin_secops')
      setPassword('agentshield')
      login('admin_secops', 'admin')
    } else {
      setUsername('analyst_01')
      setPassword('agentshield')
      login('analyst_01', 'analyst')
    }
    navigate('/')
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[var(--bg-base)] text-[var(--text-main)] p-4">
      {/* Background Grid Pattern */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(var(--border-color) 1px, transparent 1px), radial-gradient(var(--border-color) 1px, var(--bg-base) 1px)',
          backgroundSize: '40px 40px',
          backgroundPosition: '0 0, 20px 20px',
        }}
      />

      <div className="relative z-10 w-full max-w-[440px] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-sm bg-[rgba(0,212,255,0.1)] flex items-center justify-center mb-3 border border-[var(--primary)] shadow-[0_0_12px_rgba(0,212,255,0.25)]">
            <span
              className="material-symbols-outlined text-[var(--primary)]"
              style={{ fontVariationSettings: "'FILL' 1", fontSize: '32px' }}
            >
              shield
            </span>
          </div>
          <h1 className="text-[22px] font-semibold text-[var(--text-main)] tracking-wider uppercase font-mono">
            AgentShield AI
          </h1>
          <p className="text-[var(--text-muted)] text-[12px] uppercase tracking-[0.2em] font-mono mt-1">
            Mission Control Terminal
          </p>
        </div>

        <div className="w-full h-px bg-[var(--border-color)] mb-6" />

        {error && (
          <div className="mb-4 p-2.5 bg-[rgba(248,81,73,0.1)] border border-[var(--status-danger)] rounded-sm text-[var(--status-danger)] text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1.5" htmlFor="username">
              Operator ID / Username
            </label>
            <div className="relative rounded-sm focus-within:ring-1 focus-within:ring-[var(--primary)]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: '18px' }}>
                person
              </span>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter operator ID"
                className="w-full pl-10 pr-3 py-2 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm text-[var(--text-main)] font-mono text-[13px] focus:border-[var(--primary)] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1.5" htmlFor="password">
              Security Token / Password
            </label>
            <div className="relative rounded-sm focus-within:ring-1 focus-within:ring-[var(--primary)]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: '18px' }}>
                lock
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm text-[var(--text-main)] font-mono text-[13px] focus:border-[var(--primary)] outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-[var(--text-muted)]">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded-sm border-[var(--border-color)] bg-[var(--bg-base)] text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              <span className="font-mono text-[11px]">Remember terminal</span>
            </label>
            <span className="text-[var(--primary)] text-[11px] font-mono cursor-pointer hover:underline">
              Reset Key
            </span>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-sm bg-[var(--primary)] text-[#001f27] text-[12px] font-bold font-mono uppercase tracking-wider hover:bg-[#00b8e6] transition-all shadow-[0_0_12px_rgba(0,212,255,0.3)] mt-2 cursor-pointer"
          >
            Authenticate Operator
          </button>
        </form>

        {/* Quick Demo Access Bar */}
        <div className="mt-6 pt-5 border-t border-[var(--border-color)]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] text-center mb-3">
            Quick Evaluation Access
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('analyst')}
              className="py-1.5 px-3 border border-[var(--border-color)] bg-[var(--bg-raised)] hover:bg-[var(--bg-hover)] text-xs font-mono text-[var(--primary)] rounded-sm transition-colors text-center cursor-pointer"
            >
              Analyst Demo
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin')}
              className="py-1.5 px-3 border border-[var(--border-color)] bg-[var(--bg-raised)] hover:bg-[var(--bg-hover)] text-xs font-mono text-[var(--status-warning)] rounded-sm transition-colors text-center cursor-pointer"
            >
              Admin Demo
            </button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="font-mono text-[10px] text-[var(--text-muted)] opacity-60 tracking-wider">
            AGENTSHIELD AI V1.0 • IMSEC MAJOR PROJECT
          </p>
        </div>
      </div>
    </div>
  )
}
