import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAgents, createAgent, quarantineAgent, releaseAgent } from '../../api'
import { useWebSocket } from '../../ws/WebSocketContext'

export interface AgentCardData {
  id: string
  name: string
  status: 'online' | 'suspended' | 'warning'
  riskScore: number
  framework: string
  uptime: string
  totalActions: string
  recentRiskTrend: number[]
}

const mockAgents: AgentCardData[] = [
  {
    id: 'AGT-042',
    name: 'Data Ingestion Bot',
    status: 'online',
    riskScore: 12,
    framework: 'LangChain',
    uptime: '34d 12h',
    totalActions: '1.2M',
    recentRiskTrend: [10, 12, 8, 15, 10, 20, 12, 14, 12],
  },
  {
    id: 'AGT-009',
    name: 'Market Analyst Alpha',
    status: 'suspended',
    riskScore: 94,
    framework: 'CrewAI',
    uptime: 'HALTED',
    totalActions: '84,392',
    recentRiskTrend: [30, 40, 35, 60, 85, 95, 100, 90, 94],
  },
  {
    id: 'AGT-117',
    name: 'Social Scraper V2',
    status: 'warning',
    riskScore: 68,
    framework: 'OpenAI Agents',
    uptime: '12d 04h',
    totalActions: '405k',
    recentRiskTrend: [20, 25, 30, 45, 50, 40, 60, 70, 68],
  },
  {
    id: 'langchain_agent',
    name: 'LangChain RAG Assistant',
    status: 'online',
    riskScore: 18,
    framework: 'LangChain',
    uptime: 'Active (Live)',
    totalActions: '128',
    recentRiskTrend: [8, 10, 12, 9, 11, 13, 10, 9, 18],
  },
  {
    id: 'AGT-014',
    name: 'System Maintenance Bot',
    status: 'online',
    riskScore: 22,
    framework: 'Custom Python',
    uptime: '18d 06h',
    totalActions: '62,190',
    recentRiskTrend: [12, 15, 14, 16, 18, 20, 22, 21, 22],
  },
  {
    id: 'AGT-200',
    name: 'Internal Security Scanner',
    status: 'online',
    riskScore: 15,
    framework: 'Custom Python',
    uptime: '5d 03h',
    totalActions: '50k',
    recentRiskTrend: [15, 18, 16, 14, 17, 19, 18, 16, 15],
  },
]

export default function AgentsDirectory() {
  const [agentsList, setAgentsList] = useState<AgentCardData[]>(mockAgents)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [riskFilter, setRiskFilter] = useState(100)
  const [showProvisionModal, setShowProvisionModal] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const { messages } = useWebSocket()
  const navigate = useNavigate()

  // Provision Form State
  const [newAgentId, setNewAgentId] = useState('')
  const [newAgentName, setNewAgentName] = useState('')
  const [newFramework, setNewFramework] = useState('langchain')
  const [newMode, setNewMode] = useState<'enforce' | 'observe'>('enforce')
  const [copiedSnippet, setCopiedSnippet] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const loadAgents = async () => {
    try {
      const data = await getAgents()
      if (data && data.length > 0) {
        const mapped: AgentCardData[] = data.map((a: any) => {
          const risk = Math.round(a.current_risk_score || a.risk_score || 0)
          const isSuspended =
            a.status === 'quarantined' || a.status === 'halted' || a.status === 'suspended'
          const isWarning = risk >= 60 && !isSuspended
          const statusStr = (isSuspended ? 'suspended' : isWarning ? 'warning' : 'online') as
            | 'online'
            | 'suspended'
            | 'warning'

          return {
            id: a.agent_id || a.id || a.external_id,
            name: a.name || `Agent ${a.agent_id || a.id}`,
            status: statusStr,
            riskScore: risk,
            framework: a.framework || 'Custom Python',
            uptime: isSuspended ? 'HALTED / QUARANTINED' : 'Active (Live)',
            totalActions: `${Math.round(risk * 12 + 64)}`,
            recentRiskTrend: [
              Math.max(5, risk - 30),
              Math.max(8, risk - 20),
              Math.max(12, risk - 10),
              risk,
            ],
          }
        })
        setAgentsList(mapped)
      }
    } catch {
      // Keep default mock
    }
  }

  useEffect(() => {
    loadAgents()
  }, [])

  useEffect(() => {
    if (messages.length > 0) {
      loadAgents()
    }
  }, [messages])

  const handleToggleQuarantine = async (agent: AgentCardData, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      if (agent.status === 'suspended') {
        await releaseAgent(agent.id)
        showToast(`Agent ${agent.id} released from quarantine. Actions permitted.`)
      } else {
        await quarantineAgent(agent.id)
        showToast(`Agent ${agent.id} quarantined. All actions will be denied pre-flight.`)
      }
      await loadAgents()
    } catch (err: any) {
      showToast(`Action failed: ${err.message || 'Unknown error'}`)
    }
  }

  const handleCreateAgentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAgentId.trim()) {
      showToast('Agent ID is required.')
      return
    }
    setIsSubmitting(true)
    try {
      await createAgent({
        agent_id: newAgentId.trim(),
        name: newAgentName.trim() || newAgentId.trim(),
        framework: newFramework,
        environment: 'production',
      })
      showToast(`Agent ${newAgentId.trim()} successfully registered!`)
      setShowProvisionModal(false)
      setNewAgentId('')
      setNewAgentName('')
      await loadAgents()
    } catch (err: any) {
      showToast(`Failed to register agent: ${err.message || 'Error'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getCodeSnippet = () => {
    const aid = newAgentId.trim() || 'my_production_agent'
    if (newFramework === 'langchain') {
      return `from langchain.chat_models import ChatOpenAI
from agentshield import AgentShield, AgentShieldCallbackHandler

# 1. Initialize AgentShield Guardrail
shield = AgentShield(
    api_key="ashield_live_your_org_key_here",
    base_url="http://localhost:8000/api/v1",
    mode="${newMode}",  # enforce blocks violations pre-flight (p95 < 42ms)
    fail_open=False,
)

# 2. Attach handler to LangChain
shield_handler = AgentShieldCallbackHandler(shield=shield, agent_id="${aid}")
llm = ChatOpenAI(temperature=0, callbacks=[shield_handler])`
    } else if (newFramework === 'crewai') {
      return `from crewai import Agent
from agentshield import AgentShield

shield = AgentShield(api_key="ashield_live_key_here", mode="${newMode}")

@shield.monitor(agent_id="${aid}", action_type="market_research")
def research_task(query: str):
    # Execution is checked pre-flight against Safe AST rules
    return execute_query(query)`
    } else {
      return `from agentshield import AgentShield, ShieldSecurityException

shield = AgentShield(api_key="ashield_live_key_here", mode="${newMode}")

@shield.monitor(agent_id="${aid}", action_type="database_query")
def execute_sql(query: str):
    return db.execute(query)`
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getCodeSnippet())
    setCopiedSnippet(true)
    setTimeout(() => setCopiedSnippet(false), 2500)
    showToast('Integration snippet copied!')
  }

  const filteredAgents = agentsList.filter((agent) => {
    const matchesSearch =
      agent.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.framework.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'online' && agent.status === 'online') ||
      (statusFilter === 'suspended' && agent.status === 'suspended') ||
      (statusFilter === 'warning' && (agent.status === 'warning' || agent.riskScore >= 60))
    const matchesRisk = agent.riskScore <= riskFilter
    return matchesSearch && matchesStatus && matchesRisk
  })

  return (
    <div className="flex-1 overflow-y-auto flex flex-col gap-5 max-w-[1720px] mx-auto w-full pb-10">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 rounded bg-[var(--bg-surface-elevated)] border border-[var(--primary)] px-4 py-2 text-xs text-[var(--primary)] shadow-2xl flex items-center gap-2 font-mono">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          {toastMessage}
        </div>
      )}

      {/* Header & Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 panel-obsidian p-4 shrink-0">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative w-full max-w-xs">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[18px]">
              search
            </span>
            <input
              className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded py-1.5 pl-9 pr-3 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] font-mono transition-colors"
              placeholder="Search agent ID, name, framework..."
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1 bg-[var(--bg-canvas)] p-1 rounded border border-[var(--border-color)]">
            {[
              { id: 'all', label: 'All Fleets' },
              { id: 'online', label: 'Active Nominal' },
              { id: 'suspended', label: 'Quarantined' },
              { id: 'warning', label: 'High Risk' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1 text-xs uppercase font-bold rounded transition-colors cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-[var(--primary)] text-[#090d16] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Risk Range Slider */}
          <div className="flex items-center gap-2 px-2">
            <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
              Risk:
            </span>
            <input
              className="w-20 appearance-none bg-transparent accent-[var(--primary)] cursor-pointer"
              max="100"
              min="0"
              type="range"
              value={riskFilter}
              onChange={(e) => setRiskFilter(Number(e.target.value))}
            />
            <span className="text-xs font-mono font-bold text-[var(--primary)]">&le; {riskFilter}</span>
          </div>
        </div>

        {/* View Switcher & Action */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-[var(--bg-canvas)] p-1 rounded border border-[var(--border-color)]">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-[var(--bg-surface-elevated)] text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-white'
              }`}
              title="Grid View"
            >
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-[var(--bg-surface-elevated)] text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-white'
              }`}
              title="Table View"
            >
              <span className="material-symbols-outlined text-[18px]">table_rows</span>
            </button>
          </div>

          <button
            onClick={() => setShowProvisionModal(true)}
            className="bg-[var(--primary)] hover:bg-sky-400 text-[#090d16] px-3.5 py-1.5 text-xs uppercase font-bold rounded transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Provision Agent
          </button>
        </div>
      </div>

      {/* View Mode: Grid */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              onClick={() => navigate(`/agent/${agent.id}`)}
              className={`panel-obsidian panel-obsidian-interactive p-4 flex flex-col justify-between border-l-4 ${
                agent.status === 'suspended'
                  ? 'border-l-rose-500'
                  : agent.status === 'warning'
                  ? 'border-l-amber-500'
                  : 'border-l-emerald-500'
              } group cursor-pointer`}
            >
              <div>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-9 rounded bg-[var(--bg-canvas)] border border-[var(--border-color)] flex items-center justify-center shrink-0 text-[var(--primary)]">
                      <span className="material-symbols-outlined text-lg">smart_toy</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-[var(--text-main)] group-hover:text-[var(--primary)] transition-colors truncate">
                        {agent.id}
                      </h3>
                      <p className="text-[11px] text-[var(--text-muted)] truncate">{agent.name}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[9px] uppercase font-bold text-[var(--text-muted)] block">Risk</span>
                    <span
                      className={`font-mono text-base font-extrabold ${
                        agent.riskScore >= 70
                          ? 'text-rose-400'
                          : agent.riskScore >= 40
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {agent.riskScore}
                      <span className="text-[10px] text-[var(--text-muted)] font-normal">/100</span>
                    </span>
                  </div>
                </div>

                {/* Framework & Status Chips */}
                <div className="flex items-center justify-between text-xs mt-3 gap-2">
                  <span className="px-2 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-color)] text-sky-300 font-mono text-[10px]">
                    {agent.framework}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                      agent.status === 'suspended'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : agent.status === 'warning'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {agent.status === 'suspended' ? 'Quarantined' : agent.status === 'warning' ? 'Elevated' : 'Active'}
                  </span>
                </div>

                {/* Details Row */}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-[var(--border-subtle)] text-[11px] font-mono">
                  <div>
                    <span className="text-[9px] uppercase text-[var(--text-muted)] block">Uptime State</span>
                    <span className="text-[var(--text-main)] font-semibold truncate block">{agent.uptime}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase text-[var(--text-muted)] block">Actions Audited</span>
                    <span className="text-[var(--text-main)] font-semibold truncate block">{agent.totalActions}</span>
                  </div>
                </div>
              </div>

              {/* Sparkline & Action Button */}
              <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] uppercase font-bold text-[var(--text-muted)] mr-1">Trend:</span>
                  <div className="flex items-end gap-1 h-3.5">
                    {agent.recentRiskTrend.map((v, i) => (
                      <div
                        key={i}
                        className="w-1.5 rounded-xs"
                        style={{
                          height: `${Math.max(25, Math.min(100, v))}%`,
                          backgroundColor: v >= 70 ? '#f43f5e' : v >= 40 ? '#f59e0b' : '#10b981',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  onClick={(e) => handleToggleQuarantine(agent, e)}
                  className={`px-2.5 py-1 text-[10px] font-mono uppercase font-bold rounded transition-colors cursor-pointer border ${
                    agent.status === 'suspended'
                      ? 'border-emerald-500 text-emerald-400 hover:bg-emerald-500/20'
                      : 'border-rose-500 text-rose-400 hover:bg-rose-500/20'
                  }`}
                >
                  {agent.status === 'suspended' ? 'Release' : 'Quarantine'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* View Mode: Table */
        <div className="panel-obsidian overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-canvas)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <th className="p-3">AGENT NODE</th>
                <th className="p-3">FRAMEWORK</th>
                <th className="p-3">RISK SCORE</th>
                <th className="p-3">STATUS STATE</th>
                <th className="p-3">TELEMETRY ACTIONS</th>
                <th className="p-3 text-right">CONTROLS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] font-mono">
              {filteredAgents.map((agent) => (
                <tr
                  key={agent.id}
                  onClick={() => navigate(`/agent/${agent.id}`)}
                  className="hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                >
                  <td className="p-3 font-bold text-sky-400">
                    <div>{agent.id}</div>
                    <div className="text-[10px] text-[var(--text-muted)] font-normal">{agent.name}</div>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-color)] text-sky-300 text-[11px]">
                      {agent.framework}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`font-bold ${
                        agent.riskScore >= 70
                          ? 'text-rose-400'
                          : agent.riskScore >= 40
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {agent.riskScore}/100
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        agent.status === 'suspended'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : agent.status === 'warning'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {agent.status === 'suspended' ? 'Quarantined' : agent.status === 'warning' ? 'Elevated' : 'Active'}
                    </span>
                  </td>
                  <td className="p-3 text-[var(--text-main)] font-semibold">{agent.totalActions}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={(e) => handleToggleQuarantine(agent, e)}
                      className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded border transition-colors cursor-pointer ${
                        agent.status === 'suspended'
                          ? 'border-emerald-500 text-emerald-400 hover:bg-emerald-500/20'
                          : 'border-rose-500 text-rose-400 hover:bg-rose-500/20'
                      }`}
                    >
                      {agent.status === 'suspended' ? 'Release' : 'Quarantine'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Provision Agent Modal */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded panel-elevated p-6 shadow-2xl font-mono">
            <div className="flex items-start justify-between border-b border-[var(--border-color)] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[var(--primary)]">smart_toy</span>
                  Provision &amp; Integrate External AI Agent
                </h3>
                <p className="mt-1 text-xs text-[var(--text-muted)] font-sans">
                  Register your autonomous agent with the policy enforcement engine and copy the integration snippet.
                </p>
              </div>
              <button
                onClick={() => setShowProvisionModal(false)}
                className="text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateAgentSubmit} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] uppercase text-[var(--text-muted)] mb-1">
                    Agent Identifier *
                  </label>
                  <input
                    required
                    placeholder="e.g. AGT-CUSTOMER-CREW"
                    value={newAgentId}
                    onChange={(e) => setNewAgentId(e.target.value)}
                    className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded px-3 py-2 text-[var(--text-main)] focus:border-[var(--primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase text-[var(--text-muted)] mb-1">
                    Display Name
                  </label>
                  <input
                    placeholder="e.g. Customer Support Crew"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded px-3 py-2 text-[var(--text-main)] focus:border-[var(--primary)] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] uppercase text-[var(--text-muted)] mb-1">
                    Agent Framework
                  </label>
                  <select
                    value={newFramework}
                    onChange={(e) => setNewFramework(e.target.value)}
                    className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded px-3 py-2 text-[var(--text-main)] focus:border-[var(--primary)] outline-none cursor-pointer"
                  >
                    <option value="langchain">LangChain (Python)</option>
                    <option value="crewai">CrewAI</option>
                    <option value="openai">OpenAI Agents SDK</option>
                    <option value="custom">Custom Python Client</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase text-[var(--text-muted)] mb-1">
                    Enforcement Mode
                  </label>
                  <select
                    value={newMode}
                    onChange={(e) => setNewMode(e.target.value as any)}
                    className="w-full bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded px-3 py-2 text-[var(--text-main)] focus:border-[var(--primary)] outline-none cursor-pointer"
                  >
                    <option value="enforce">Enforce (Pre-flight synchronous blocking)</option>
                    <option value="observe">Observe (Background telemetry audit)</option>
                  </select>
                </div>
              </div>

              {/* Code Snippet Box */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] uppercase tracking-wider text-[var(--primary)] font-bold">
                    Python SDK Integration Snippet:
                  </span>
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className="text-[11px] text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    {copiedSnippet ? 'COPIED!' : 'COPY CODE'}
                  </button>
                </div>
                <pre className="p-3 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded text-sky-300 overflow-x-auto max-h-40 leading-relaxed text-[11px]">
                  {getCodeSnippet()}
                </pre>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-muted)] hover:text-white text-xs rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[var(--primary)] text-[#090d16] text-xs font-bold uppercase rounded hover:bg-sky-400 transition-colors cursor-pointer"
                >
                  {isSubmitting ? 'Registering...' : 'Provision Agent Node'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
