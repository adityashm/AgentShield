import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const mockAgents = [
  {
    id: 'AGT-042',
    name: 'Data Ingestion Bot',
    status: 'online',
    riskScore: 12,
    uptime: '34d 12h',
    totalActions: '1.2M',
    recentRiskTrend: [10, 12, 8, 15, 10, 20, 12, 14, 12],
  },
  {
    id: 'AGT-009',
    name: 'Market Analyst Alpha',
    status: 'suspended',
    riskScore: 94,
    uptime: 'HALTED',
    totalActions: '84,392',
    recentRiskTrend: [30, 40, 35, 60, 85, 95, 100, 90, 94],
  },
  {
    id: 'AGT-117',
    name: 'Social Scraper V2',
    status: 'warning',
    riskScore: 68,
    uptime: '12d 04h',
    totalActions: '405k',
    recentRiskTrend: [20, 25, 30, 45, 50, 40, 60, 70, 68],
  },
  // Generate a few more normal agents
  {
    id: 'AGT-200',
    name: 'Utility Tasker 1',
    status: 'online',
    riskScore: 15,
    uptime: '5d 03h',
    totalActions: '50k',
    recentRiskTrend: [8, 10, 12, 9, 11, 13, 10, 9, 8],
  },
  {
    id: 'AGT-201',
    name: 'Utility Tasker 2',
    status: 'online',
    riskScore: 12,
    uptime: '3d 10h',
    totalActions: '30k',
    recentRiskTrend: [10, 8, 12, 11, 9, 10, 12, 11, 10],
  },
  {
    id: 'AGT-202',
    name: 'Utility Tasker 3',
    status: 'online',
    riskScore: 18,
    uptime: '7d 05h',
    totalActions: '75k',
    recentRiskTrend: [15, 18, 16, 14, 17, 19, 18, 16, 15],
  },
  {
    id: 'AGT-203',
    name: 'Utility Tasker 4',
    status: 'online',
    riskScore: 14,
    uptime: '4d 02h',
    totalActions: '40k',
    recentRiskTrend: [12, 14, 13, 15, 12, 13, 14, 12, 13],
  },
  {
    id: 'AGT-204',
    name: 'Utility Tasker 5',
    status: 'online',
    riskScore: 16,
    uptime: '6d 08h',
    totalActions: '60k',
    recentRiskTrend: [14, 16, 15, 13, 17, 18, 16, 15, 14],
  },
]

export default function AgentsDirectory() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [riskFilter, setRiskFilter] = useState(100)

  const filteredAgents = mockAgents.filter((agent) => {
    const matchesSearch =
      agent.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus =
      statusFilter === 'all' || agent.status.toLowerCase() === statusFilter.toLowerCase()
    const matchesRisk = agent.riskScore <= riskFilter
    return matchesSearch && matchesStatus && matchesRisk
  })

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
      {/* Filters & Actions Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-surface)] p-4 border border-[var(--border-color)] rounded-sm shrink-0">
        <div className="flex flex-1 items-center gap-4">
          {/* Search Input */}
          <div className="relative w-full max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: 18 }}>
              search
            </span>
            <input
              className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm py-1.5 pl-10 pr-3 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] font-mono transition-colors"
              placeholder="Search by Agent ID or Function..."
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {/* Status Dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm py-1.5 pl-3 pr-8 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] cursor-pointer"
            >
              <option value="all">Status: All</option>
              <option value="online">Online</option>
              <option value="suspended">Suspended</option>
              <option value="offline">Offline</option>
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" style={{ fontSize: 16 }}>
              arrow_drop_down
            </span>
          </div>
          {/* Risk Slider */}
          <div className="flex items-center gap-3 px-2">
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Risk:</span>
            <input
              className="w-24 appearance-none bg-transparent"
              max="100"
              min="0"
              type="range"
              value={riskFilter}
              onChange={(e) => setRiskFilter(Number(e.target.value))}
            />
            <span className="text-xs font-mono text-[var(--text-main)]">0-{riskFilter}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--text-main)] px-3 py-1.5 text-xs font-mono uppercase font-semibold transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              filter_list
            </span>
            More Filters
          </button>
          <button
            className="bg-[var(--primary)] hover:bg-[#00b0d4] text-[var(--bg-base)] px-3 py-1.5 text-xs font-mono uppercase font-semibold transition-colors flex items-center gap-1 shadow-[0_0_8px_rgba(0,212,255,0.2)]"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              add
            </span>
            Provision Agent
          </button>
        </div>
      </div>
      {/* Agents Grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
        {filteredAgents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  )
}

function AgentCard({ agent }: { agent: typeof mockAgents[0] }) {
  const navigate = useNavigate()

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'online':
        return 'border-[var(--status-success)]'
      case 'suspended':
        return 'border-[var(--status-danger)]'
      case 'warning':
        return 'border-[var(--status-warning)]'
      default:
        return 'border-[var(--border-color)]'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return { icon: 'smart_toy', color: 'var(--text-muted)' }
      case 'suspended':
        return { icon: 'block', color: 'var(--status-danger)' }
      case 'warning':
        return { icon: 'smart_toy', color: 'var(--status-warning)' }
      default:
        return { icon: 'smart_toy', color: 'var(--text-muted)' }
    }
  }

  const { icon: statusIcon, color: statusIconColor } = getStatusIcon(agent.status)

  return (
    <div
      onClick={() => navigate(`/agent/${agent.id}`)}
      className={`agent-card bg-[var(--bg-surface)] border ${getStatusClass(agent.status)} rounded-sm p-4 flex flex-col gap-4 transition-all duration-200 cursor-pointer hover:border-[var(--primary)]`}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center size-10 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm">
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: statusIconColor }}>
              {statusIcon}
            </span>
            <div className={`absolute -top-1 -right-1 size-2.5 rounded-full bg-[var(--status-danger)] border-2 border-[var(--bg-surface)] ${agent.status === 'suspended' ? 'pulse-dot-red' : ''}`}>
            </div>
          </div>
          <div>
            <h3 className="text-[var(--text-main)] font-mono font-semibold text-lg leading-none">{agent.id}</h3>
            <p className="text-[var(--text-muted)] text-xs mt-1">{agent.name}</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Risk Score</span>
          <span className={`text-[var(--text-main)] font-mono font-bold text-lg ${agent.status === 'suspended' ? 'text-[var(--status-danger)]' : agent.status === 'warning' ? 'text-[var(--status-warning)]' : ''}`}>
            {agent.riskScore}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 py-3 border-y border-[var(--border-color)]">
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Uptime</span>
          <span className="text-[var(--text-main)] font-mono text-sm">{agent.uptime}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Total Actions</span>
          <span className="text-[var(--text-main)] font-mono text-sm">{agent.totalActions}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Recent Risk Trend</span>
          <span className="text-[var(--text-muted)] text-[10px] font-mono">Last 24h</span>
        </div>
        <div className={`sparkline w-full border-b border-[var(--border-color)]`}>
          {agent.recentRiskTrend.map((value, index) => (
            <div
              key={index}
              className="sparkline-bar"
              style={{
                height: `${value}%`,
                backgroundColor:
                  agent.status === 'suspended'
                    ? 'var(--status-danger)'
                    : agent.status === 'warning'
                    ? 'var(--status-warning)'
                    : 'var(--primary)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}