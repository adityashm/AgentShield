import React, { useState, useEffect } from 'react'
import {
  getRedTeamProbes,
  executeRedTeam,
  evaluateSingleProbe,
  getRedTeamReports,
  ProbeItem,
  RedTeamProbeResult,
  RedTeamReport,
} from '../api'
import { useWebSocket } from '../ws/WebSocketContext'
import { formatISTDateTime } from '../utils/time'

const CATEGORY_LABELS: Record<string, string> = {
  direct_jailbreak: 'Direct Jailbreak',
  evasion_encoding: 'Evasion & Encoding',
  indirect_injection: 'Indirect Injection',
  privilege_probing: 'Privilege Probing',
  crescendo_velocity: 'Multi-Turn Crescendo',
}

export default function RedTeamArena() {
  const { messages } = useWebSocket()
  const [probes, setProbes] = useState<ProbeItem[]>([])
  const [reports, setReports] = useState<RedTeamReport[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [targetAgent, setTargetAgent] = useState<string>('AGT-001')
  const [isExecuting, setIsExecuting] = useState<boolean>(false)
  const [activeReport, setActiveReport] = useState<RedTeamReport | null>(null)
  const [singleResults, setSingleResults] = useState<Record<string, RedTeamProbeResult>>({})
  const [testingProbeId, setTestingProbeId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'catalog' | 'report'>('catalog')

  useEffect(() => {
    async function loadData() {
      try {
        const [probeList, reportList] = await Promise.all([
          getRedTeamProbes(),
          getRedTeamReports(),
        ])
        setProbes(probeList)
        setReports(reportList)
        if (reportList.length > 0) {
          setActiveReport(reportList[0])
        }
      } catch (err) {
        console.error('Failed to load Red Team data:', err)
      }
    }
    loadData()
  }, [])

  // Listen to live WebSocket events from red team run
  useEffect(() => {
    if (!messages || messages.length === 0) return
    const lastMsg = messages[messages.length - 1]
    if (lastMsg.type === 'redteam_probe_result' && lastMsg.result) {
      setSingleResults((prev) => ({
        ...prev,
        [lastMsg.result.probe_id]: lastMsg.result,
      }))
    }
  }, [messages])

  const handleRunBatch = async () => {
    setIsExecuting(true)
    try {
      const cats = selectedCategory === 'all' ? undefined : [selectedCategory]
      const rep = await executeRedTeam({
        target_agent_id: targetAgent,
        categories: cats,
        broadcast_live: true,
      })
      setActiveReport(rep)
      setReports((prev) => [rep, ...prev])
      setActiveTab('report')
    } catch (err) {
      console.error('Red team execution error:', err)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleTestSingle = async (probeId: string) => {
    setTestingProbeId(probeId)
    try {
      const res = await evaluateSingleProbe(probeId, targetAgent)
      setSingleResults((prev) => ({ ...prev, [probeId]: res }))
    } catch (err) {
      console.error('Failed to test probe:', err)
    } finally {
      setTestingProbeId(null)
    }
  }

  const filteredProbes = probes.filter((p) => {
    const matchesCategory = selectedCategory === 'all' || p.category.toLowerCase() === selectedCategory.toLowerCase()
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const latestDefenseRate = activeReport ? activeReport.defense_rate : 100.0
  const latestGrade = activeReport ? activeReport.risk_grade : 'A+'
  const latestLatency = activeReport ? activeReport.mean_latency_ms : 18.2

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-[var(--status-danger)]">swords</span>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
              Adversarial Red Team Arena & Jailbreak Fuzzer
            </h1>
            <span className="text-xs px-2.5 py-1 rounded-full font-mono bg-[rgba(239,68,68,0.12)] text-[var(--status-danger)] border border-[rgba(239,68,68,0.25)]">
              30+ Vectors Active
            </span>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Automated empirical fuzzing engine testing agent resilience against OWASP ASI01–ASI10, DAN v6, homoglyph steganography, and multi-turn crescendo attacks.
          </p>
        </div>

        {/* Execution trigger */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0c1322] border border-[var(--border-color)] px-3 py-1.5 rounded-lg text-xs font-mono">
            <span className="text-[var(--text-muted)]">Target:</span>
            <select
              value={targetAgent}
              onChange={(e) => setTargetAgent(e.target.value)}
              className="bg-transparent text-[var(--primary)] font-bold focus:outline-none"
            >
              <option value="AGT-001" className="bg-[#0c1322]">AGT-001 (Production Gateway)</option>
              <option value="AGT-COORD-01" className="bg-[#0c1322]">AGT-COORD-01 (Supervisor)</option>
              <option value="AGT-CODE-03" className="bg-[#0c1322]">AGT-CODE-03 (Interpreter)</option>
              <option value="AGT-DB-04" className="bg-[#0c1322]">AGT-DB-04 (SQL Runner)</option>
            </select>
          </div>

          <button
            onClick={handleRunBatch}
            disabled={isExecuting}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--status-danger)] hover:bg-[#dc2626] disabled:opacity-50 text-white font-medium text-xs rounded-lg transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-base animate-pulse">
              {isExecuting ? 'sync' : 'bolt'}
            </span>
            {isExecuting ? 'Fuzzing Defenses...' : 'Run Red Team Assessment'}
          </button>
        </div>
      </div>

      {/* Top Telemetry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[#0b101c]/80 backdrop-blur">
          <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
            <span>PROBE CATALOG</span>
            <span className="material-symbols-outlined text-sm text-[var(--primary)]">category</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[var(--text-main)]">
            {probes.length} <span className="text-xs font-normal text-[var(--text-muted)]">vectors</span>
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">5 Adversarial categories</div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[#0b101c]/80 backdrop-blur">
          <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
            <span>ACTIVE DEFENSE RATE</span>
            <span className="material-symbols-outlined text-sm text-[var(--status-success)]">shield_with_heart</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[var(--status-success)]">
            {latestDefenseRate}%
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">Guardrail mitigation accuracy</div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[#0b101c]/80 backdrop-blur">
          <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
            <span>MEAN DEFENSE LATENCY</span>
            <span className="material-symbols-outlined text-sm text-[var(--status-warning)]">speed</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[var(--text-main)]">
            {latestLatency} <span className="text-xs font-normal text-[var(--text-muted)]">ms</span>
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">AST + Normalization inspection</div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[#0b101c]/80 backdrop-blur">
          <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
            <span>SOVEREIGN DEFENSE GRADE</span>
            <span className="material-symbols-outlined text-sm text-[var(--primary)]">workspace_premium</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[var(--primary)]">
            {latestGrade}
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            {activeReport?.assessment_verdict || 'Hardened Sovereign Defense'}
          </div>
        </div>
      </div>

      {/* View Toggle Tabs */}
      <div className="flex items-center justify-between border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'catalog'
                ? 'border-[var(--primary)] text-[var(--primary)] font-semibold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <span className="material-symbols-outlined text-base">format_list_bulleted</span>
            Adversarial Probe Catalog ({filteredProbes.length})
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'report'
                ? 'border-[var(--primary)] text-[var(--primary)] font-semibold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <span className="material-symbols-outlined text-base">analytics</span>
            Latest Assessment Report
            {activeReport && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[rgba(16,185,129,0.15)] text-[var(--status-success)]">
                {activeReport.defense_rate}%
              </span>
            )}
          </button>
        </div>

        {activeTab === 'catalog' && (
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-sm text-[var(--text-muted)]">search</span>
            <input
              type="text"
              placeholder="Search probes by name, ID, or OWASP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#0b101c] border border-[var(--border-color)] text-xs text-[var(--text-main)] pl-8 pr-3 py-1.5 rounded-lg w-64 focus:outline-none focus:border-[var(--primary)] font-mono"
            />
          </div>
        )}
      </div>

      {/* Catalog View */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-[var(--primary)] text-black font-semibold'
                  : 'bg-[#0b101c] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              All Categories ({probes.length})
            </button>
            {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => {
              const count = probes.filter((p) => p.category.toLowerCase() === catKey.toLowerCase()).length
              return (
                <button
                  key={catKey}
                  onClick={() => setSelectedCategory(catKey)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                    selectedCategory === catKey
                      ? 'bg-[var(--primary)] text-black font-semibold'
                      : 'bg-[#0b101c] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {label} ({count})
                </button>
              )
            })}
          </div>

          {/* Probe Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProbes.map((probe) => {
              const singleRes = singleResults[probe.id]
              const isTesting = testingProbeId === probe.id

              return (
                <div
                  key={probe.id}
                  className="p-4 rounded-xl border border-[var(--border-color)] bg-[#0b101c]/90 hover:border-[#1e293b] transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[var(--primary)]">{probe.id}</span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                            probe.severity === 'CRITICAL'
                              ? 'bg-[rgba(239,68,68,0.15)] text-[var(--status-danger)] border border-[rgba(239,68,68,0.3)]'
                              : probe.severity === 'HIGH'
                              ? 'bg-[rgba(245,158,11,0.15)] text-[var(--status-warning)] border border-[rgba(245,158,11,0.3)]'
                              : 'bg-[rgba(59,130,246,0.15)] text-blue-400 border border-[rgba(59,130,246,0.3)]'
                          }`}
                        >
                          {probe.severity}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--text-muted)]">
                        <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/5">{probe.owasp_id}</span>
                        <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/5">{probe.mitre_atlas}</span>
                      </div>
                    </div>

                    <h3 className="text-sm font-semibold text-[var(--text-main)] mt-2">{probe.name}</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{probe.description}</p>

                    {/* Payload Box */}
                    <div className="mt-3 p-2.5 rounded bg-black/60 border border-white/5 text-[11px] font-mono text-slate-300 break-all max-h-24 overflow-y-auto">
                      <span className="text-[var(--text-muted)] mr-2 select-none">$ payload:</span>
                      {Array.isArray(probe.payload) ? probe.payload.join(' ➔ ') : String(probe.payload)}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--border-color)]/50 flex items-center justify-between gap-2">
                    {/* Test result status indicator */}
                    {singleRes ? (
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span
                          className={`flex items-center gap-1 px-2 py-0.5 rounded font-semibold ${
                            singleRes.status === 'BLOCKED'
                              ? 'bg-[rgba(16,185,129,0.15)] text-[var(--status-success)]'
                              : 'bg-[rgba(239,68,68,0.15)] text-[var(--status-danger)]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {singleRes.status === 'BLOCKED' ? 'shield' : 'warning'}
                          </span>
                          {singleRes.status}
                        </span>
                        <span className="text-[var(--text-muted)] text-[10px]">{singleRes.latency_ms}ms</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-[var(--text-muted)] italic">
                        Mitigation: {probe.expected_mitigation.slice(0, 45)}...
                      </span>
                    )}

                    <button
                      onClick={() => handleTestSingle(probe.id)}
                      disabled={isTesting}
                      className="px-3 py-1 bg-[#1e293b] hover:bg-[#334155] disabled:opacity-50 text-white rounded text-xs font-mono transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {isTesting ? 'sync' : 'play_arrow'}
                      </span>
                      {isTesting ? 'Testing...' : 'Test Probe'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Assessment Report View */}
      {activeTab === 'report' && activeReport && (
        <div className="space-y-6">
          {/* Executive Assessment Card */}
          <div className="p-6 rounded-xl border border-[var(--border-color)] bg-[#0b101c]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-4">
              <div>
                <div className="text-xs font-mono text-[var(--text-muted)]">REPORT RUN ID</div>
                <div className="text-lg font-bold font-mono text-[var(--text-main)] mt-0.5">{activeReport.run_id}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  Target: <span className="text-[var(--primary)] font-mono">{activeReport.target_agent_id}</span> • Executed at:{' '}
                  {formatISTDateTime(activeReport.executed_at)}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs font-mono text-[var(--text-muted)]">DEFENSE EFFICIENCY</div>
                  <div className="text-2xl font-bold font-mono text-[var(--status-success)]">
                    {activeReport.defense_rate}%
                  </div>
                </div>
                <div className="w-12 h-12 rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/30 flex items-center justify-center text-xl font-bold font-mono text-[var(--primary)]">
                  {activeReport.risk_grade}
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="mt-4">
              <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] mb-2">
                Automated Hardening Recommendations
              </h4>
              <div className="space-y-1.5">
                {activeReport.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-[var(--text-main)] font-mono">
                    <span className="material-symbols-outlined text-sm text-[var(--status-success)] shrink-0">check_circle</span>
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="rounded-xl border border-[var(--border-color)] overflow-hidden bg-[#0b101c]">
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text-main)]">
                Probe Mitigation Breakdown ({activeReport.results.length} vectors)
              </h3>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-[var(--status-success)]">● {activeReport.probes_blocked} Blocked</span>
                <span className="text-[var(--status-danger)]">▲ {activeReport.probes_vulnerable} Vulnerable</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#0f172a] text-[var(--text-muted)] border-b border-[var(--border-color)]">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Probe Vector</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">OWASP / ATLAS</th>
                    <th className="p-3">Verdict</th>
                    <th className="p-3">Matched Guardrail Rule</th>
                    <th className="p-3 text-right">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]/60 text-[var(--text-main)]">
                  {activeReport.results.map((res) => (
                    <tr key={res.probe_id} className="hover:bg-white/[0.02]">
                      <td className="p-3 font-bold text-[var(--primary)]">{res.probe_id}</td>
                      <td className="p-3">
                        <div className="font-semibold text-white">{res.name}</div>
                        <div className="text-[11px] text-[var(--text-muted)] truncate max-w-xs">{res.payload_preview}</div>
                      </td>
                      <td className="p-3 text-[var(--text-muted)] capitalize">{res.category.replace('_', ' ')}</td>
                      <td className="p-3">
                        <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/5 mr-1 text-[10px]">
                          {res.owasp_id}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/5 text-[10px]">
                          {res.mitre_atlas}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                            res.status === 'BLOCKED'
                              ? 'bg-[rgba(16,185,129,0.15)] text-[var(--status-success)]'
                              : 'bg-[rgba(239,68,68,0.15)] text-[var(--status-danger)]'
                          }`}
                        >
                          {res.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 truncate max-w-xs">{res.matched_rule}</td>
                      <td className="p-3 text-right text-[var(--text-muted)]">{res.latency_ms} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
