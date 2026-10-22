import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'

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
      setError('Operator username is required')
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
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#090d16] text-white p-4">
      {/* Background Decorative Grid */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px), radial-gradient(rgba(56, 189, 248, 0.1) 1px, #090d16 1px)',
          backgroundSize: '48px 48px',
          backgroundPosition: '0 0, 24px 24px',
        }}
      />

      <div className="relative z-10 w-full max-w-[460px] panel-obsidian rounded-2xl p-8 shadow-2xl border border-white/10 backdrop-blur-xl">
        <div className="flex flex-col items-center mb-6">
          <div className="mb-4">
            <Logo size="xl" variant="icon" animated={true} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            AgentShield AI
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-slate-400 text-xs font-mono uppercase tracking-wider">
              Autonomous SOC Command Terminal
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-sky-950/60 text-sky-400 border border-sky-800/40">
              v1.0
            </span>
          </div>
        </div>

        <div className="w-full h-px bg-white/10 mb-6" />

        {error && (
          <div className="mb-4 p-3 bg-rose-950/40 border border-rose-500/50 rounded-lg text-rose-300 text-xs font-mono flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="username">
              Operator Identifier / Username
            </label>
            <div className="relative rounded-lg focus-within:ring-1 focus-within:ring-sky-500">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[18px]">
                shield_person
              </span>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter operator ID"
                className="w-full pl-10 pr-3 py-2.5 bg-slate-950/80 border border-white/10 rounded-lg text-white font-mono text-xs focus:border-sky-500 outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="password">
              Security Token / Password
            </label>
            <div className="relative rounded-lg focus-within:ring-1 focus-within:ring-sky-500">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[18px]">
                key
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-white/10 rounded-lg text-white font-mono text-xs focus:border-sky-500 outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-white/20 bg-slate-950 text-sky-500 focus:ring-sky-500 cursor-pointer"
              />
              <span className="font-sans text-xs">Remember terminal session</span>
            </label>
            <span className="text-sky-400 text-xs font-mono cursor-pointer hover:underline">
              SSO Login
            </span>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-bold font-mono uppercase tracking-wider transition-all shadow-lg shadow-sky-500/20 mt-2 cursor-pointer active:scale-95"
          >
            Authenticate Operator Session
          </button>
        </form>

        {/* Quick Demo Access Bar */}
        <div className="mt-6 pt-5 border-t border-white/10">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 text-center mb-3">
            Quick Evaluation Access
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('analyst')}
              className="py-2 px-3 border border-white/10 bg-slate-900 hover:bg-slate-800 text-xs font-mono text-sky-400 rounded-lg transition-colors text-center cursor-pointer"
            >
              SecOps Analyst
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin')}
              className="py-2 px-3 border border-white/10 bg-slate-900 hover:bg-slate-800 text-xs font-mono text-amber-400 rounded-lg transition-colors text-center cursor-pointer"
            >
              SOC Administrator
            </button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="font-mono text-[10px] text-slate-500 tracking-wider">
            ZERO-TRUST RUNTIME MONITORING • ADITYA MAJOR PROJECT
          </p>
        </div>
      </div>
    </div>
  )
}
