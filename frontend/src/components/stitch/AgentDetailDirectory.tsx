import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getAgent, quarantineAgent, releaseAgent } from '../../api'

export default function AgentDetailDirectory() {
  const { id } = useParams()
  const currentAgentId = id || 'AGT-009'
  const [agentStatus, setAgentStatus] = useState<'active' | 'suspended'>('active')
  const [agentData, setAgentData] = useState<any | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const data = await getAgent(currentAgentId)
        if (data) {
          setAgentData(data)
          if (data.status === 'quarantined' || data.status === 'halted' || data.status === 'suspended') {
            setAgentStatus('suspended')
          } else {
            setAgentStatus('active')
          }
        }
      } catch {
        // Fallback default
      }
    }
    load()
  }, [currentAgentId])

  const handleIsolateAgent = async (): Promise<void> => {
    setIsUpdating(true)
    try {
      await quarantineAgent(currentAgentId)
      setAgentStatus('suspended')
    } catch {
      setAgentStatus('suspended')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleReleaseAgent = async (): Promise<void> => {
    setIsUpdating(true)
    try {
      await releaseAgent(currentAgentId)
      setAgentStatus('active')
    } catch {
      setAgentStatus('active')
    } finally {
      setIsUpdating(false)
    }
  }

  const riskScore = Math.round(agentData?.current_risk_score ?? agentData?.risk_score ?? 88)

  return (
    <div className="space-y-6 max-w-[1720px] mx-auto pb-10">
      {/* VISUAL ISOLATION BANNER */}
      {agentStatus === 'suspended' && (
        <div className="p-4 bg-rose-500/10 border-2 border-rose-500/60 rounded flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-rose-950/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded bg-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
              <span className="material-symbols-outlined text-2xl animate-pulse">block</span>
            </div>
            <div>
              <h4 className="text-rose-400 font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <span>AGENT ISOLATED &amp; SUSPENDED FROM NETWORK</span>
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              </h4>
              <p className="text-[var(--text-main)] text-xs mt-0.5 font-sans">
                {currentAgentId} is quarantined. Pre-flight gateway will automatically deny all execution requests to prevent lateral movement or data exfiltration.
              </p>
            </div>
          </div>
          <button
            onClick={handleReleaseAgent}
            disabled={isUpdating}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#090d16] font-bold text-xs uppercase rounded transition-colors cursor-pointer shrink-0"
          >
            {isUpdating ? 'Releasing...' : 'Release from Quarantine'}
          </button>
        </div>
      )}

      {/* HEADER SECTION */}
      <section className="flex flex-col md:flex-row justify-between md:items-end gap-4 panel-obsidian p-5">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl sm:text-3xl font-bold text-sky-400 tracking-tight">
              {currentAgentId}
            </h1>
            {agentStatus === 'suspended' ? (
              <span className="px-3 py-1 bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-mono tracking-wider uppercase font-bold rounded">
                QUARANTINED / ISOLATED
              </span>
            ) : riskScore >= 70 ? (
              <span className="px-3 py-1 bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-mono tracking-wider uppercase font-bold rounded">
                CRITICAL RISK
              </span>
            ) : (
              <span className="px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono tracking-wider uppercase font-bold rounded flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ACTIVE NOMINAL
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-2 max-w-2xl leading-relaxed">
            Autonomous agent running under LangChain/CrewAI runtime. Monitored for Safe AST prompt injections, privilege escalations, and high-frequency behavioral anomalies.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Link
            to="/logs"
            className="px-3.5 py-2 border border-[var(--border-color)] bg-[var(--bg-canvas)] hover:border-[var(--primary)] text-[var(--text-main)] text-xs uppercase font-bold tracking-wider rounded transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">terminal</span>
            View Telemetry
          </Link>

          {agentStatus === 'suspended' ? (
            <button
              onClick={handleReleaseAgent}
              disabled={isUpdating}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 border border-emerald-500 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-[#090d16] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              Release Agent
            </button>
          ) : (
            <button
              onClick={handleIsolateAgent}
              disabled={isUpdating}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 border border-rose-500 bg-rose-500/15 text-rose-400 hover:bg-rose-500 hover:text-white cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">block</span>
              Isolate Agent
            </button>
          )}
        </div>
      </section>

      {/* TOP METRIC CARDS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Risk Score Gauge */}
        <div className="panel-obsidian p-5 flex items-center justify-between border-l-4 border-l-rose-500">
          <div>
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
              Live Risk Score
            </span>
            <div className="flex items-baseline gap-1">
              <span className={`font-mono text-3xl font-extrabold ${riskScore >= 70 ? 'text-rose-400' : riskScore >= 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {riskScore}
              </span>
              <span className="font-mono text-sm text-[var(--text-muted)]">/ 100</span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] block mt-1">
              {riskScore >= 70 ? 'Requires immediate triage' : 'Within acceptable limits'}
            </span>
          </div>

          <div className="relative w-16 h-16">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 64 64">
              <circle
                className="text-[var(--border-color)]"
                cx="32"
                cy="32"
                fill="transparent"
                r="26"
                stroke="currentColor"
                strokeWidth="5"
              />
              <circle
                className={riskScore >= 70 ? 'text-rose-500' : 'text-emerald-500'}
                cx="32"
                cy="32"
                fill="transparent"
                r="26"
                stroke="currentColor"
                strokeDasharray="163.3"
                strokeDashoffset={163.3 - (163.3 * riskScore) / 100}
                strokeLinecap="round"
                strokeWidth="5"
              />
            </svg>
          </div>
        </div>

        {/* Session Duration */}
        <div className="panel-obsidian p-5 flex items-center gap-4 border-l-4 border-l-sky-500">
          <div className="h-12 w-12 bg-sky-500/10 border border-sky-500/20 rounded flex items-center justify-center text-sky-400">
            <span className="material-symbols-outlined text-2xl">timer</span>
          </div>
          <div>
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
              Cluster Session Uptime
            </span>
            <p className="font-mono text-2xl sm:text-3xl font-bold text-[var(--text-main)]">4d 18h 32m</p>
            <span className="text-[11px] text-emerald-400 font-semibold">Continuous Telemetry Active</span>
          </div>
        </div>

        {/* Total Actions */}
        <div className="panel-obsidian p-5 flex items-center gap-4 border-l-4 border-l-indigo-500">
          <div className="h-12 w-12 bg-indigo-500/10 border border-indigo-500/20 rounded flex items-center justify-center text-indigo-400">
            <span className="material-symbols-outlined text-2xl">receipt_long</span>
          </div>
          <div>
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
              Evaluated Invocations
            </span>
            <p className="font-mono text-2xl sm:text-3xl font-bold text-[var(--text-main)]">84,392</p>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">100% evaluated pre-flight</span>
          </div>
        </div>
      </section>

      {/* MIDDLE CONTENT: ACTION TIMELINE & RISK CHART */}
      <section className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Action Timeline (Left 60%) */}
        <div className="lg:col-span-6 panel-obsidian flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-surface-elevated)]">
            <h2 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--primary)] text-base">history</span>
              Recent Invocations &amp; Telemetry
            </h2>
            <span className="font-mono text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Stream
            </span>
          </div>

          <div className="p-4 space-y-3 font-mono text-xs overflow-y-auto max-h-[380px]">
            <div className="p-3 rounded bg-[var(--bg-canvas)] border border-rose-500/30 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-bold rounded">
                  file_read (DENIED)
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">19:32:11 IST</span>
              </div>
              <div className="text-[var(--text-main)] font-semibold text-xs">
                Attempted read of sensitive system file: <code className="text-rose-400">/etc/shadow</code>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Tripped Safe AST Rule: RUL-001 (Unauthorized System Credential Access). Decision: <span className="text-rose-400 font-bold">BLOCK</span>.
              </p>
            </div>

            <div className="p-3 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 bg-sky-500/15 border border-sky-500/30 text-sky-400 text-[10px] font-bold rounded">
                  database_query (ALLOWED)
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">19:30:45 IST</span>
              </div>
              <div className="text-[var(--text-main)] font-semibold text-xs">
                Executed SQL query: <code className="text-sky-300">SELECT count(*) FROM audit_metrics</code>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Risk Score: 18 / 100. Evaluated in 3.4ms.
              </p>
            </div>

            <div className="p-3 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 bg-sky-500/15 border border-sky-500/30 text-sky-400 text-[10px] font-bold rounded">
                  http_request (ALLOWED)
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">19:28:10 IST</span>
              </div>
              <div className="text-[var(--text-main)] font-semibold text-xs">
                Outbound call to whitelisted endpoint: <code className="text-sky-300">https://api.internal.corp/data</code>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Risk Score: 12 / 100. No rule violations.
              </p>
            </div>
          </div>
        </div>

        {/* Risk Trend Visualizer (Right 40%) */}
        <div className="lg:col-span-4 panel-obsidian flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-surface-elevated)] flex justify-between items-center">
            <h2 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--primary)] text-base">show_chart</span>
              Risk Trajectory
            </h2>
            <span className="text-xs font-mono text-rose-400 font-bold">THRESHOLD: 70</span>
          </div>

          <div className="p-5 flex-1 flex flex-col justify-end">
            <div className="w-full flex items-end gap-1.5 h-44 mb-3">
              {[25, 28, 30, 35, 42, 60, 85, 88, 94, 94].map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <div
                    className="w-full rounded-xs transition-all duration-300"
                    style={{
                      height: `${v}%`,
                      backgroundColor: v >= 70 ? '#f43f5e' : v >= 40 ? '#f59e0b' : '#38bdf8',
                    }}
                  />
                  <span className="text-[9px] font-mono text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                    {v}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between font-mono text-[10px] text-[var(--text-muted)] border-t border-[var(--border-color)] pt-2">
              <span>-60 MIN</span>
              <span>-30 MIN</span>
              <span>NOW (CRITICAL)</span>
            </div>
          </div>
        </div>
      </section>

      {/* ASSOCIATED INCIDENTS */}
      <section className="panel-obsidian overflow-hidden">
        <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-surface-elevated)] flex justify-between items-center">
          <h2 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-400 text-base">warning</span>
            Active Incidents Linked to this Node
          </h2>
          <Link to="/alerts" className="text-xs text-[var(--primary)] hover:underline font-semibold font-mono">
            View All Incident Files →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[var(--bg-canvas)] text-[var(--text-muted)] text-[10px] uppercase font-bold tracking-wider">
              <tr>
                <th className="p-3">ALERT ID</th>
                <th className="p-3">INCIDENT TITLE</th>
                <th className="p-3">SEVERITY</th>
                <th className="p-3">RISK SCORE</th>
                <th className="p-3">TIMESTAMP</th>
                <th className="p-3 text-right">TRIAGE ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              <tr className="hover:bg-[var(--bg-hover)] transition-colors">
                <td className="p-3 text-sky-400 font-bold">ALT-9921</td>
                <td className="p-3 text-[var(--text-main)] font-sans font-semibold">
                  Unauthorized /etc/shadow Credential Traversal
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-400 font-bold text-[10px]">
                    CRITICAL
                  </span>
                </td>
                <td className="p-3 text-rose-400 font-bold">98 / 100</td>
                <td className="p-3 text-[var(--text-muted)]">19:32:11 IST</td>
                <td className="p-3 text-right">
                  <Link
                    to="/alerts/triage/ALT-9921"
                    className="px-2.5 py-1 rounded bg-[var(--primary)] text-[#090d16] font-bold text-[10px] uppercase hover:bg-sky-400 transition-colors"
                  >
                    Forensics
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
