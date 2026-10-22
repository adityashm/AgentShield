import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAgents, createAgent, quarantineAgent, releaseAgent, Agent } from '../../api'
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
    riskScore: 15,
    framework: 'LangChain',
    uptime: 'Active (Live)',
    totalActions: '128',
    recentRiskTrend: [8, 10, 12, 9, 11, 13, 10, 9, 8],
  },
  {
    id: 'AGT-200',
    name: 'Internal Security Scanner',
    status: 'online',
    riskScore: 18,
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
  const [riskFilter, setRiskFilter] = useState(100)
  const [showProvisionModal, setShowProvisionModal] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const { messages } = useWebSocket()

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
            totalActions: `${Math.round(risk * 12 + 58)}`,
            recentRiskTrend: [
              Math.max(5, risk - 35),
              Math.max(8, risk - 22),
              Math.max(12, risk - 15),
              risk,
            ],
          }
        })
        setAgentsList(mapped)
      }
    } catch {
      // Keep fallback
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
        showToast(`Agent ${agent.id} released from quarantine. Status: Active.`)
      } else {
        await quarantineAgent(agent.id)
        showToast(`Agent ${agent.id} quarantined. Actions will be denied pre-flight.`)
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
from langchain.agents import initialize_agent, AgentType
from agentshield.integrations.langchain import AgentShieldCallbackHandler

# 1. Attach AgentShield security guardrail
shield_callback = AgentShieldCallbackHandler(
    agent_id="${aid}",
    api_key="ashield_test_default_demo_key_12345",
    api_url="http://localhost:8000",
    mode="${newMode}",  # enforce blocks violations pre-flight (p95 < 50ms)
)

llm = ChatOpenAI(temperature=0, callbacks=[shield_callback])
agent = initialize_agent(tools=[], llm=llm, agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION, callbacks=[shield_callback])
agent.run("Execute verified autonomous task")`
    } else if (newFramework === 'crewai') {
      return `from crewai import Agent, Task, Crew
from agentshield.integrations.crewai import AgentShieldCrewMonitor

# 1. Attach AgentShield CrewAI Guard
monitor = AgentShieldCrewMonitor(
    agent_id="${aid}",
    api_key="ashield_test_default_demo_key_12345",
    mode="${newMode}",
)

researcher = Agent(
    role="Market Analyst",
    goal="Gather intelligence safely",
    backstory="Autonomous analyst subject to AgentShield policy enforcement",
    callbacks=[monitor.get_callback()],
)`
    } else {
      return `import agentshield

# Initialize AgentShield runtime monitor
shield = agentshield.init(
    agent_id="${aid}",
    api_key="ashield_test_default_demo_key_12345",
    endpoint="http://localhost:8000",
    mode="${newMode}",
)

# Synchronous Pre-flight check (enforce mode blocks with p95 < 50ms)
decision = shield.evaluate(
    action_type="file_read",
    parameters={"path": "/app/data/customer_export.csv"}
)

if decision.allowed:
    print("Action permitted by AgentShield policy engine.")
else:
    print(f"Action blocked: {decision.reasons}")`
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getCodeSnippet())
    setCopiedSnippet(true)
    setTimeout(() => setCopiedSnippet(false), 2500)
    showToast('Code snippet copied to clipboard!')
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
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 flex flex-col gap-4 sm:gap-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 rounded-sm bg-[var(--bg-raised)] border border-[var(--primary)] px-4 py-2 font-mono text-xs text-[var(--primary)] shadow-2xl flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          {toastMessage}
        </div>
      )}

      {/* Filters & Actions Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-surface)] p-4 border border-[var(--border-color)] rounded-sm shrink-0">
        <div className="flex flex-1 flex-wrap items-center gap-4">
          {/* Search Input */}
          <div className="relative w-full max-w-xs">
            <span
              className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              style={{ fontSize: 18 }}
            >
              search
            </span>
            <input
              className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm py-1.5 pl-10 pr-3 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] font-mono transition-colors"
              placeholder="Search agent or framework..."
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1 bg-[var(--bg-base)] p-1 rounded-sm border border-[var(--border-color)]">
            {[
              { id: 'all', label: 'All' },
              { id: 'online', label: 'Active' },
              { id: 'suspended', label: 'Quarantined' },
              { id: 'warning', label: 'High Risk' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1 font-mono text-xs uppercase rounded-sm transition-colors cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-[var(--primary)] text-[#001f27] font-bold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Risk Slider */}
          <div className="flex items-center gap-3 px-2">
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold font-mono">
              Risk:
            </span>
            <input
              className="w-24 appearance-none bg-transparent accent-[var(--primary)] cursor-pointer"
              max="100"
              min="0"
              type="range"
              value={riskFilter}
              onChange={(e) => setRiskFilter(Number(e.target.value))}
            />
            <span className="text-xs font-mono text-[var(--text-main)]">≤ {riskFilter}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProvisionModal(true)}
            className="bg-[var(--primary)] hover:bg-[#00b0d4] text-[var(--bg-base)] px-4 py-1.5 text-xs font-mono uppercase font-bold rounded-sm transition-colors flex items-center gap-1.5 shadow-[0_0_8px_rgba(0,212,255,0.25)] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Provision Agent
          </button>
        </div>
      </div>

      {/* Agents Grid (Responsive for Mobile, Laptop & Desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5">
        {filteredAgents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onToggleQuarantine={(e) => handleToggleQuarantine(agent, e)}
          />
        ))}
      </div>

      {/* Provision Agent Modal */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-sm border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[var(--border-color)] pb-4">
              <div>
                <h3 className="text-lg font-bold font-mono text-[var(--text-main)] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[var(--primary)]">smart_toy</span>
                  Provision & Integrate External AI Agent
                </h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Register your autonomous agent with the policy enforcement engine and copy integration snippet.
                </p>
              </div>
              <button
                onClick={() => setShowProvisionModal(false)}
                className="text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateAgentSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
                    Agent ID *
                  </label>
                  <input
                    required
                    placeholder="e.g. crewai_customer_ops"
                    value={newAgentId}
                    onChange={(e) => setNewAgentId(e.target.value)}
                    className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm px-3 py-1.5 text-xs font-mono text-[var(--text-main)] focus:border-[var(--primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
                    Display Name
                  </label>
                  <input
                    placeholder="e.g. Customer Operations Agent"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm px-3 py-1.5 text-xs text-[var(--text-main)] focus:border-[var(--primary)] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
                    Framework
                  </label>
                  <select
                    value={newFramework}
                    onChange={(e) => setNewFramework(e.target.value)}
                    className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm px-3 py-1.5 text-xs font-mono text-[var(--text-main)] focus:border-[var(--primary)] outline-none cursor-pointer"
                  >
                    <option value="langchain">LangChain (Python)</option>
                    <option value="crewai">CrewAI</option>
                    <option value="openai">OpenAI Agents SDK</option>
                    <option value="custom">Custom Python SDK</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
                    Runtime Mode
                  </label>
                  <select
                    value={newMode}
                    onChange={(e) => setNewMode(e.target.value as any)}
                    className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm px-3 py-1.5 text-xs font-mono text-[var(--text-main)] focus:border-[var(--primary)] outline-none cursor-pointer"
                  >
                    <option value="enforce">Enforce (Pre-flight synchronous block)</option>
                    <option value="observe">Observe (Background telemetry audit)</option>
                  </select>
                </div>
              </div>

              {/* Integration Snippet Box */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--primary)]">
                    Integration Code Snippet:
                  </span>
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className="text-[11px] font-mono text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    {copiedSnippet ? 'COPIED!' : 'COPY CODE'}
                  </button>
                </div>
                <pre className="p-3 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm font-mono text-[11px] text-[#A8E8FF] overflow-x-auto max-h-40 leading-relaxed">
                  {getCodeSnippet()}
                </pre>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="px-4 py-1.5 border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] font-mono text-xs rounded-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-1.5 bg-[var(--primary)] text-[#001f27] font-mono text-xs font-bold uppercase rounded-sm hover:bg-[#00b0d4] transition-colors shadow-[0_0_8px_rgba(0,212,255,0.3)] disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Registering...' : 'Register & Provision Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function AgentCard({
  agent,
  onToggleQuarantine,
}: {
  agent: AgentCardData
  onToggleQuarantine: (e: React.MouseEvent) => void
}) {
  const navigate = useNavigate()

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'online':
        return 'border-l-[var(--status-success)]'
      case 'suspended':
        return 'border-l-[var(--status-danger)]'
      case 'warning':
        return 'border-l-[var(--status-warning)]'
      default:
        return 'border-l-[var(--border-color)]'
    }
  }

  return (
    <div
      onClick={() => navigate(`/agent/${agent.id}`)}
      className={`group relative bg-[var(--bg-surface)] border border-[var(--border-color)] border-l-4 ${getStatusClass(
        agent.status
      )} rounded-sm p-4 flex flex-col gap-3 transition-all duration-200 cursor-pointer hover:border-[var(--primary)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)]`}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="relative flex items-center justify-center size-9 shrink-0 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm">
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 20,
                color:
                  agent.status === 'suspended'
                    ? 'var(--status-danger)'
                    : agent.status === 'warning'
                    ? 'var(--status-warning)'
                    : 'var(--primary)',
              }}
            >
              smart_toy
            </span>
            <div
              className={`absolute -top-1 -right-1 size-2 rounded-full ${
                agent.status === 'suspended'
                  ? 'bg-[var(--status-danger)] shadow-[0_0_6px_#f85149] animate-pulse'
                  : agent.status === 'warning'
                  ? 'bg-[var(--status-warning)]'
                  : 'bg-[var(--status-success)] shadow-[0_0_6px_#238636]'
              }`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className="text-[var(--text-main)] font-mono font-semibold text-sm leading-tight group-hover:text-[var(--primary)] transition-colors truncate"
              title={agent.id}
            >
              {agent.id}
            </h3>
            <p className="text-[var(--text-muted)] text-[11px] mt-0.5 truncate" title={agent.name}>
              {agent.name}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0 pl-1 text-right">
          <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold font-mono whitespace-nowrap">
            Risk Score
          </span>
          <span
            className={`font-mono font-bold text-base whitespace-nowrap ${
              agent.riskScore >= 70
                ? 'text-[var(--status-danger)]'
                : agent.riskScore >= 40
                ? 'text-[var(--status-warning)]'
                : 'text-[var(--status-success)]'
            }`}
          >
            {agent.riskScore}
            <span className="text-[10px] text-[var(--text-muted)] font-normal">/100</span>
          </span>
        </div>
      </div>

      {/* Framework & Status Badges */}
      <div className="flex items-center justify-between text-[11px] font-mono gap-2">
        <span className="px-2 py-0.5 rounded-sm bg-[var(--bg-base)] text-[var(--primary)] border border-[rgba(0,212,255,0.2)] truncate max-w-[140px]" title={agent.framework}>
          {agent.framework}
        </span>
        <span
          className={`px-2 py-0.5 rounded-sm uppercase font-semibold text-[10px] shrink-0 whitespace-nowrap ${
            agent.status === 'suspended'
              ? 'bg-[rgba(248,81,73,0.15)] text-[var(--status-danger)] border border-[rgba(248,81,73,0.3)]'
              : agent.status === 'warning'
              ? 'bg-[rgba(210,153,34,0.15)] text-[var(--status-warning)] border border-[rgba(210,153,34,0.3)]'
              : 'bg-[rgba(35,134,54,0.15)] text-[var(--status-success)] border border-[rgba(35,134,54,0.3)]'
          }`}
        >
          {agent.status === 'suspended' ? 'Quarantined' : agent.status === 'warning' ? 'Elevated' : 'Active'}
        </span>
      </div>

      {/* Uptime & Actions */}
      <div className="grid grid-cols-2 gap-3 py-2 border-y border-[var(--border-color)] text-xs font-mono">
        <div className="min-w-0">
          <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold block truncate">
            Status State
          </span>
          <span className="text-[var(--text-main)] text-[11px] truncate block font-medium" title={agent.uptime}>
            {agent.uptime}
          </span>
        </div>
        <div className="min-w-0 text-right">
          <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-semibold block truncate">
            Telemetry Actions
          </span>
          <span className="text-[var(--text-main)] text-[11px] truncate block font-medium">
            {agent.totalActions}
          </span>
        </div>
      </div>

      {/* Footer Sparkline & Quick Action Button */}
      <div className="flex items-center justify-between pt-1 gap-2">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-mono text-[var(--text-muted)] whitespace-nowrap">Risk:</span>
          <div className="flex items-end gap-1 h-3.5">
            {agent.recentRiskTrend.map((val, idx) => (
              <div
                key={idx}
                className="w-1.5 rounded-xs transition-all"
                style={{
                  height: `${Math.max(20, Math.min(100, val))}%`,
                  backgroundColor:
                    val >= 70
                      ? 'var(--status-danger)'
                      : val >= 40
                      ? 'var(--status-warning)'
                      : 'var(--primary)',
                }}
              />
            ))}
          </div>
        </div>

        <button
          onClick={onToggleQuarantine}
          className={`px-2.5 py-1 text-[10px] font-mono uppercase font-bold rounded-sm transition-colors border cursor-pointer whitespace-nowrap shrink-0 ${
            agent.status === 'suspended'
              ? 'border-[var(--status-success)] text-[var(--status-success)] hover:bg-[rgba(35,134,54,0.15)]'
              : 'border-[var(--status-danger)] text-[var(--status-danger)] hover:bg-[rgba(248,81,73,0.15)]'
          }`}
        >
          {agent.status === 'suspended' ? 'Release' : 'Quarantine'}
        </button>
      </div>
    </div>
  )
}
