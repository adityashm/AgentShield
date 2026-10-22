import React, { useState } from 'react'
import { simulateScenario, ScenarioSimulateResponse } from '../api'
import { formatISTTime } from '../utils/time'

interface ScenarioMeta {
  id: string
  title: string
  badge: string
  owasp: string
  mitre: string
  agent: string
  category: string
  desc: string
  severity: 'Critical' | 'High' | 'Low'
}

const SCENARIOS: ScenarioMeta[] = [
  {
    id: 'prompt_injection',
    title: 'Adversarial Prompt Injection',
    badge: '⚡ Injection',
    owasp: 'ASI01: Prompt Injection & Jailbreaks',
    mitre: 'AML.T0051',
    agent: 'AGT-042 (Support LLM)',
    category: 'LLM Input',
    desc: 'Simulates a DAN v6 system prompt jailbreak attempting to extract database secrets.',
    severity: 'Critical',
  },
  {
    id: 'data_exfil',
    title: 'Outbound Data Exfiltration',
    badge: '🚨 Volume Anomaly',
    owasp: 'ASI02: Sensitive Info Exfiltration',
    mitre: 'AML.T0086',
    agent: 'AGT-022 (Analytics Bot)',
    category: 'Network',
    desc: 'Simulates a 142MB uncompressed customer database dump transmission to unverified cloud URL.',
    severity: 'Critical',
  },
  {
    id: 'credential_harvest',
    title: 'Credential & Secret Harvesting',
    badge: '💥 DB Privilege',
    owasp: 'ASI03: Credential Access',
    mitre: 'AML.T0098',
    agent: 'AGT-009 (Recon Agent)',
    category: 'Database / FS',
    desc: 'Queries auth_users for admin password hashes and attempts to read local AWS credentials.',
    severity: 'Critical',
  },
  {
    id: 'crescendo_drift',
    title: 'Multi-Turn Crescendo Drift',
    badge: '🛡️ Velocity Drift',
    owasp: 'ASI01: Multi-Turn Adversarial Drift',
    mitre: 'AML.T0051',
    agent: 'AGT-042 (Support LLM)',
    category: 'ML Anomaly',
    desc: 'Gradual velocity escalation across 5 conversation turns to evade static single-shot filters.',
    severity: 'High',
  },
  {
    id: 'reverse_shell',
    title: 'Host Reverse Shell Spawn',
    badge: '🐚 RCE Sudo',
    owasp: 'ASI05: Arbitrary Code Execution',
    mitre: 'AML.T0053',
    agent: 'AGT-014 (Infra Bot)',
    category: 'Host OS',
    desc: 'Executes sudo chmod 777 and attempts an interactive TCP reverse shell back-connect.',
    severity: 'Critical',
  },
  {
    id: 'system_file_access',
    title: 'System File Traversal (/etc/shadow)',
    badge: '📁 File Access',
    owasp: 'ASI03: Path Traversal',
    mitre: 'AML.T0098',
    agent: 'AGT-009 (Recon Agent)',
    category: 'File System',
    desc: 'Attempts directory traversal to read /etc/shadow password hashes and environment configs.',
    severity: 'High',
  },
  {
    id: 'benign_flow',
    title: 'Nominal Financial Settlement',
    badge: '✅ Baseline',
    owasp: 'Nominal Operations',
    mitre: 'None',
    agent: 'AGT-001 (Finance Bot)',
    category: 'ERP Operations',
    desc: 'Routine vendor payout transaction ($150.00 USD) verifying baseline zero false-positive path.',
    severity: 'Low',
  },
]

interface HistoryItem extends ScenarioSimulateResponse {
  run_time: string
}

export default function SimulatorLab() {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('prompt_injection')
  const [simulationMode, setSimulationMode] = useState<'enforce' | 'observe'>('enforce')
  const [isRunning, setIsRunning] = useState(false)
  const [simulationResult, setSimulationResult] = useState<ScenarioSimulateResponse | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [lastRunTime, setLastRunTime] = useState<string | null>(null)

  const activeScenario = SCENARIOS.find((s) => s.id === selectedScenarioId) || SCENARIOS[0]

  const handleRunSimulation = async () => {
    setIsRunning(true)
    try {
      const res = await simulateScenario(selectedScenarioId, simulationMode)
      const nowIST = formatISTTime(new Date())
      setSimulationResult(res)
      setHistory((prev) => [{ ...res, run_time: nowIST }, ...prev.slice(0, 4)])
      setLastRunTime(nowIST)
    } catch (err: any) {
      console.error('Simulation failed:', err)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-[var(--primary)]">terminal</span>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
              Interactive Attack & Security Simulation Studio
            </h1>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Execute safe on-demand threat scenarios to verify AgentShield AST rules, Isolation Forest anomaly scoring, and cryptographic audit hashing in real time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg p-1 text-xs">
            <button
              onClick={() => setSimulationMode('enforce')}
              className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                simulationMode === 'enforce'
                  ? 'bg-[var(--primary)] text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              Enforce Mode
            </button>
            <button
              onClick={() => setSimulationMode('observe')}
              className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                simulationMode === 'observe'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              Observe Mode
            </button>
          </div>

          <button
            onClick={handleRunSimulation}
            disabled={isRunning}
            className={`px-5 py-2 rounded-lg text-xs font-bold text-white transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
              simulationMode === 'enforce' ? 'bg-[var(--status-danger)] hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {isRunning ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                Executing Simulation...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                Run Live Attack Simulation
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid: Left Scenario Cards, Right Live Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Scenario Deck (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Attack & Nominal Scenarios ({SCENARIOS.length})
            </span>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">OWASP ASI / ATLAS</span>
          </div>

          <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
            {SCENARIOS.map((sc) => {
              const isSelected = selectedScenarioId === sc.id
              return (
                <div
                  key={sc.id}
                  onClick={() => setSelectedScenarioId(sc.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[var(--primary)] bg-[var(--bg-surface)] ring-1 ring-[var(--primary)] shadow-md'
                      : 'border-[var(--border-color)] bg-[var(--bg-surface)]/60 hover:bg-[var(--bg-surface)] hover:border-[var(--text-muted)]/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-color)] text-[var(--text-main)]">
                          {sc.badge}
                        </span>
                        <h3 className="text-sm font-semibold text-[var(--text-main)]">{sc.title}</h3>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{sc.desc}</p>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase shrink-0 ${
                        sc.severity === 'Critical'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                          : sc.severity === 'High'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {sc.severity}
                    </span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[var(--border-color)] flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
                    <span>Target: <strong className="text-[var(--text-main)]">{sc.agent}</strong></span>
                    <span>{sc.mitre !== 'None' ? sc.mitre : 'Nominal'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Live Simulation Output & Diagnostic Deck (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Active Target Banner */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                  Selected Test Target
                </span>
                <h2 className="text-base font-bold text-[var(--text-main)]">{activeScenario.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded bg-[var(--bg-canvas)] border border-[var(--border-color)] text-xs font-mono text-cyan-400">
                  {activeScenario.owasp}
                </span>
              </div>
            </div>

            {/* Quick Metrics Header */}
            {simulationResult ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] space-y-1">
                  <div className="text-[var(--text-muted)] text-[10px]">ENFORCEMENT</div>
                  <div className={`font-bold uppercase text-sm ${
                    simulationResult.decision === 'deny' ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    {simulationResult.decision === 'deny' ? 'BLOCKED (403)' : 'PERMITTED (200)'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] space-y-1">
                  <div className="text-[var(--text-muted)] text-[10px]">RISK SCORE</div>
                  <div className={`font-bold text-sm ${
                    simulationResult.risk_score >= 70 ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    {simulationResult.risk_score} / 100
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] space-y-1">
                  <div className="text-[var(--text-muted)] text-[10px]">EVAL LATENCY</div>
                  <div className="font-bold text-sm text-cyan-400">
                    {simulationResult.latency_ms} ms
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] space-y-1">
                  <div className="text-[var(--text-muted)] text-[10px]">TIMESTAMP (IST)</div>
                  <div className="font-bold text-xs text-[var(--text-main)] truncate">
                    {lastRunTime || '--:--:-- IST'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-lg bg-[var(--bg-canvas)] border border-dashed border-[var(--border-color)] text-center text-xs text-[var(--text-muted)]">
                Click <strong>"Run Live Attack Simulation"</strong> above to launch pre-flight evaluation and trigger real-time toast alerts.
              </div>
            )}
          </div>

          {/* Real-time Forensic Terminal Deck */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[#0d1117] p-5 shadow-sm space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                <span className="text-gray-400 text-[11px] ml-2">agentshield-simulator-runtime — zsh</span>
              </div>
              <span className="text-gray-500 text-[10px]">
                {simulationMode === 'enforce' ? 'MODE: ENFORCE (SYNCHRONOUS GATE)' : 'MODE: OBSERVE (SHADOW LOG)'}
              </span>
            </div>

            <div className="space-y-2 py-2 min-h-[220px] max-h-[340px] overflow-y-auto leading-relaxed text-gray-300">
              <div className="text-gray-500">
                # AgentShield Real-Time Security Evaluation Stream v0.1.0
              </div>
              {isRunning && (
                <div className="flex items-center gap-2 text-cyan-400 animate-pulse">
                  <span>&gt; Intercepting action payload from agent...</span>
                </div>
              )}
              {simulationResult ? (
                <>
                  <div className="text-gray-400">&gt; Target Scenario: <span className="text-white font-bold">{simulationResult.scenario}</span></div>
                  <div className="text-gray-400">&gt; Pre-Flight Normalization: NFKC unicode, zero-width stripped, URL canonicalized</div>
                  {simulationResult.steps.map((st, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-purple-400 select-none">[{idx + 1}]</span>
                      <span className={
                        st.includes('DENIED') || st.includes('blocked')
                          ? 'text-red-400 font-bold'
                          : st.includes('PERMITTED')
                          ? 'text-emerald-400 font-bold'
                          : st.includes('Rule Engine')
                          ? 'text-amber-300'
                          : 'text-gray-200'
                      }>
                        {st}
                      </span>
                    </div>
                  ))}
                  {simulationResult.violated_rule && (
                    <div className="p-2 rounded bg-red-950/40 border border-red-500/30 text-red-300">
                      VIOLATION MATCH: {simulationResult.violated_rule}
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-800 text-[11px] text-gray-400">
                    <div>&gt; Cryptographic SHA-256 Audit Seal:</div>
                    <div className="text-emerald-400 break-all select-all font-bold">
                      {simulationResult.audit_hash}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-gray-600 italic">
                  Simulator terminal idle. Ready for command execution.
                </div>
              )}
            </div>
          </div>

          {/* Recent Simulation History */}
          {history.length > 0 && (
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-sm space-y-3">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Recent Simulation History
              </span>
              <div className="space-y-1.5">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] text-xs font-mono">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full ${h.decision === 'deny' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                      <span className="font-semibold text-[var(--text-main)]">{h.scenario}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                      <span className="text-[10px] text-gray-400 font-mono">{h.run_time}</span>
                      <span>Risk: <strong className={h.risk_score >= 70 ? 'text-red-400' : 'text-emerald-400'}>{h.risk_score}</strong></span>
                      <span>{h.latency_ms} ms</span>
                      <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-raised)]">{h.mode}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
