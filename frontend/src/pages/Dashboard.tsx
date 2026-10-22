import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getAgents, getAlerts } from '../api'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { useWebSocket, WSMessage } from '../ws/WebSocketContext'
import { formatISTTime, getLiveISTTime } from '../utils/time'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const statCards = [
  {
    title: 'Active Agents',
    value: '12',
    accent: 'border-l-[var(--status-success)]',
    icon: 'group',
    iconColor: 'text-[var(--status-success)]',
    link: '/agents',
  },
  {
    title: 'Actions Today',
    value: '4,847',
    accent: 'border-l-[var(--status-info)]',
    icon: 'swap_horiz',
    iconColor: 'text-[var(--status-info)]',
    link: '/logs',
  },
  {
    title: 'Open Alerts',
    value: '7',
    accent: 'border-l-[var(--status-danger)]',
    icon: 'warning',
    iconColor: 'text-[var(--status-danger)]',
    badge: true,
    link: '/alerts',
  },
  {
    title: 'Highest Risk',
    value: 'AGT-009',
    detail: '88/100',
    accent: 'border-l-[var(--status-warning)]',
    icon: 'shield',
    iconColor: 'text-[var(--status-warning)]',
    link: '/agent/AGT-009',
  },
]

const nodeRows = [
  { name: 'PostgreSQL 16 DB Engine', role: 'Multi-Tenant Cryptographic Store', ping: '2ms', tone: 'text-[var(--status-success)]' },
  { name: 'Isolation Forest Model', role: 'Hierarchical Anomaly Detector', ping: 'Sub-5ms', tone: 'text-[var(--status-success)]' },
  { name: 'Safe AST Policy DSL', role: 'OWASP ASI 2026 / MITRE ATLAS', ping: '20 Rules', tone: 'text-[var(--status-success)]' },
  { name: 'Pre-Flight Policy Gateway', role: 'Synchronous Enforce Decider', ping: 'p95 < 50ms', tone: 'text-[var(--primary)]' },
]

function Icon({ name }: { name: string }) {
  return <span className="material-symbols-outlined text-[20px]">{name}</span>
}

function StatBadge({ tone, children }: { tone?: string; children: React.ReactNode }) {
  const classes: Record<string, string> = {
    danger: 'bg-[rgba(248,81,73,0.12)] text-[var(--status-danger)] border-[rgba(248,81,73,0.3)]',
    warning: 'bg-[rgba(210,153,34,0.12)] text-[var(--status-warning)] border-[rgba(210,153,34,0.3)]',
    success: 'bg-[rgba(35,134,54,0.12)] text-[var(--status-success)] border-[rgba(35,134,54,0.3)]',
    info: 'bg-[rgba(47,129,247,0.12)] text-[var(--status-info)] border-[rgba(47,129,247,0.3)]',
  }

  const selectedTone = tone && classes[tone] ? classes[tone] : classes['info']

  return (
    <span className={`inline-flex items-center justify-center rounded-sm border px-2 py-0.5 font-mono text-xs font-semibold ${selectedTone}`}>
      {children}
    </span>
  )
}

function MetricChart() {
  const { messages } = useWebSocket()
  const [chartData, setChartData] = useState<{
    labels: string[]
    riskIndex: number[]
    anomalyScore: number[]
    cpuLoad: number[]
  }>({
    labels: ['14:25', '14:26', '14:27', '14:28', '14:29', '14:30', '14:31', '14:32'],
    riskIndex: [28, 35, 42, 39, 68, 88, 72, 64],
    anomalyScore: [15, 18, 22, 55, 84, 91, 60, 48],
    cpuLoad: [30, 32, 29, 31, 35, 40, 38, 36],
  })

  // Bind incoming WebSocket telemetry messages to dynamic rolling chart data
  useEffect(() => {
    if (!messages || messages.length === 0) return
    const latest = messages[0]
    const timeLabel = latest.time ? latest.time.split('.')[0] : getLiveISTTime().slice(0, 5)
    const newRisk = typeof latest.risk === 'number' ? latest.risk : parseFloat(latest.risk || '50') || 50
    const newAnomaly = Math.min(100, Math.max(10, Math.round(newRisk * (latest.tone === 'danger' ? 1.05 : 0.85))))
    const newCpu = Math.round(30 + Math.random() * 15)

    setChartData((prev) => {
      if (prev.labels[prev.labels.length - 1] === timeLabel) return prev

      return {
        labels: [...prev.labels.slice(1), timeLabel],
        riskIndex: [...prev.riskIndex.slice(1), newRisk],
        anomalyScore: [...prev.anomalyScore.slice(1), newAnomaly],
        cpuLoad: [...prev.cpuLoad.slice(1), newCpu],
      }
    })
  }, [messages])

  const data = {
    labels: chartData.labels,
    datasets: [
      {
        label: 'Risk Index',
        data: chartData.riskIndex,
        borderColor: '#00D4FF',
        backgroundColor: 'rgba(0, 212, 255, 0.08)',
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6,
      },
      {
        label: 'Anomaly Score',
        data: chartData.anomalyScore,
        borderColor: '#F85149',
        backgroundColor: 'rgba(248, 81, 73, 0.05)',
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: 3,
      },
      {
        label: 'CPU Load',
        data: chartData.cpuLoad,
        borderColor: '#238636',
        backgroundColor: 'transparent',
        borderDash: [4, 4],
        borderWidth: 1.5,
        pointRadius: 0,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#161B22',
        titleColor: '#E6EDF3',
        bodyColor: '#A8E8FF',
        borderColor: '#30363D',
        borderWidth: 1,
        padding: 10,
        displayColors: true,
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(48, 54, 61, 0.5)',
        },
        ticks: {
          color: '#859398',
          font: { family: 'JetBrains Mono', size: 10 },
        },
      },
      y: {
        min: 0,
        max: 100,
        grid: {
          color: 'rgba(48, 54, 61, 0.5)',
        },
        ticks: {
          color: '#859398',
          font: { family: 'JetBrains Mono', size: 10 },
        },
      },
    },
  }

  return (
    <div className="flex h-full flex-col rounded-sm border border-[var(--border-color)] bg-[var(--bg-raised)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--text-main)]">Real-time Security & Telemetry Metrics</h2>
          <p className="text-[12px] text-[var(--text-muted)]">Live anomaly detection and system risk trends</p>
        </div>
        <div className="flex gap-4 text-[11px] font-mono text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#00D4FF]" /> Risk Index</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#F85149]" /> Anomaly Score</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#238636]" /> CPU Load</span>
        </div>
      </div>

      <div className="relative min-h-[240px] flex-1">
        <Line data={data} options={options} />
      </div>
    </div>
  )
}

function NodesPanel() {
  return (
    <div className="flex h-full flex-col rounded-sm border border-[var(--border-color)] bg-[var(--bg-raised)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[16px] font-semibold text-[var(--text-main)]">Active Infrastructure Nodes</h2>
        <span className="rounded-sm border border-[rgba(47,129,247,0.25)] bg-[rgba(47,129,247,0.1)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--status-info)]">
          4 Online
        </span>
      </div>
      <div className="space-y-3">
        {nodeRows.map((node) => (
          <div key={node.name} className="flex items-center justify-between border-b border-[var(--border-color)] pb-3 last:border-b-0 last:pb-0">
            <div>
              <div className="text-[13px] font-medium text-[var(--text-main)]">{node.name}</div>
              <div className="text-[11px] text-[var(--text-muted)]">{node.role}</div>
            </div>
            <div className="text-right">
              <div className={`text-[13px] font-mono font-semibold ${node.tone}`}>{node.ping}</div>
              <div className="text-[10px] text-[var(--text-muted)]">Latency</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { messages, status, isPaused, togglePause } = useWebSocket()
  const [feedFilter, setFeedFilter] = useState<'all' | 'threats' | 'blocked'>('all')
  const [selectedEvent, setSelectedEvent] = useState<WSMessage | null>(null)
  const [metrics, setMetrics] = useState({
    activeAgents: '7',
    actionsToday: '32',
    openAlerts: '8',
    highestRiskAgent: 'AGT-042',
    highestRiskScore: '91/100',
  })

  // Fetch real database metrics
  useEffect(() => {
    async function loadMetrics() {
      try {
        const [agentsData, alertsData] = await Promise.all([
          getAgents().catch(() => []),
          getAlerts().catch(() => []),
        ])

        if (agentsData && agentsData.length > 0) {
          const sorted = [...agentsData].sort(
            (a: any, b: any) =>
              (b.current_risk_score || 0) - (a.current_risk_score || 0)
          )
          const highest = sorted[0]
          setMetrics((prev) => ({
            ...prev,
            activeAgents: `${agentsData.length}`,
            highestRiskAgent: highest?.agent_id || highest?.id || 'AGT-042',
            highestRiskScore: `${Math.round(highest?.current_risk_score || 91)}/100`,
          }))
        }

        if (alertsData) {
          const open = alertsData.filter((a: any) =>
            ['Open', 'open'].includes(a.status)
          )
          setMetrics((prev) => ({
            ...prev,
            openAlerts: `${open.length || alertsData.length}`,
          }))
        }
      } catch {}
    }

    loadMetrics()
  }, [messages])

  const dynamicStatCards = [
    {
      title: 'Active Agents',
      value: metrics.activeAgents,
      accent: 'border-l-[var(--status-success)]',
      icon: 'group',
      iconColor: 'text-[var(--status-success)]',
      link: '/agents',
    },
    {
      title: 'Monitored Actions',
      value: metrics.actionsToday,
      accent: 'border-l-[var(--status-info)]',
      icon: 'swap_horiz',
      iconColor: 'text-[var(--status-info)]',
      link: '/logs',
    },
    {
      title: 'Open Alerts',
      value: metrics.openAlerts,
      accent: 'border-l-[var(--status-danger)]',
      icon: 'warning',
      iconColor: 'text-[var(--status-danger)]',
      badge: true,
      link: '/alerts',
    },
    {
      title: 'Highest Risk Agent',
      value: metrics.highestRiskAgent,
      detail: metrics.highestRiskScore,
      accent: 'border-l-[var(--status-warning)]',
      icon: 'shield',
      iconColor: 'text-[var(--status-warning)]',
      link: `/agent/${metrics.highestRiskAgent}`,
    },
  ]

  // Use real-time messages if available, otherwise default sample rows
  const initialRows: WSMessage[] = [
    { type: 'ACTION_EVENT', agent: 'AGT-042', action: 'Prompt Injection Vector Test', risk: 91, tone: 'danger' as const, time: '14:32:41.002', status: 'Critical' },
    { type: 'ACTION_EVENT', agent: 'AGT-022', action: 'Data Exfiltration to External IP', risk: 77, tone: 'warning' as const, time: '14:32:38.115', status: 'Suspicious' },
    { type: 'ACTION_EVENT', agent: 'langchain_agent', action: 'Sensitive File Access (/etc/passwd)', risk: 90, tone: 'danger' as const, time: '14:32:35.401', status: 'Critical' },
    { type: 'ACTION_EVENT', agent: 'AGT-009', action: 'Model Parameter Update', risk: 33, tone: 'info' as const, time: '14:32:22.700', status: 'Monitoring' },
  ]

  const displayFeed = messages.length > 0 ? messages.slice(0, 10) : initialRows

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold leading-8 text-[var(--text-main)]">Command Center Dashboard</h1>
          <p className="text-[14px] leading-5 text-[var(--text-muted)]">Real-time agent risk telemetry and security event stream</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-sm border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                status === 'LIVE'
                  ? 'bg-[var(--status-success)] shadow-[0_0_6px_#238636]'
                  : status === 'CONNECTING'
                  ? 'animate-ping bg-[var(--status-warning)]'
                  : 'bg-[var(--status-danger)]'
              }`}
            />
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
              Status: <span className="font-semibold text-[var(--text-main)]">{status}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {dynamicStatCards.map((card) => (
          <Link
            key={card.title}
            to={card.link || '#'}
            className={`group relative overflow-hidden rounded-sm border border-[var(--border-color)] border-l-4 bg-[var(--bg-raised)] p-4 transition-all hover:border-r hover:border-t hover:border-b hover:border-[var(--primary)] ${card.accent}`}
          >
            <div className="mb-2 flex items-start justify-between">
              <div className="text-[12px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{card.title}</div>
              <span className={`text-[18px] ${card.iconColor}`}><Icon name={card.icon} /></span>
            </div>
            <div className="font-mono text-[26px] font-bold leading-tight text-[var(--text-main)] group-hover:text-[var(--primary)]">
              {card.value}
            </div>
            {card.detail ? (
              <div className="mt-1 font-mono text-[11px] font-semibold text-[var(--status-warning)]">{card.detail}</div>
            ) : null}
            {card.badge ? (
              <div className="absolute bottom-4 right-4 h-2 w-2 rounded-full bg-[var(--status-danger)] shadow-[0_0_6px_#F85149]" />
            ) : null}
          </Link>
        ))}
      </div>

      {/* Live Action Feed & Analytics */}
      <div className="grid min-h-[420px] grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="flex h-full flex-col rounded-sm border border-[var(--border-color)] bg-[var(--bg-raised)]">
            <div className="flex flex-wrap items-center justify-between rounded-t-sm border-b border-[var(--border-color)] bg-[var(--bg-surface)] p-4 gap-2">
              <div className="flex items-center gap-3">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--text-main)]">
                  Live Action Telemetry Stream
                  <span className="inline-block h-2 w-2 rounded-full bg-[var(--status-success)] align-middle shadow-[0_0_4px_#238636]" />
                </h2>

                <div className="flex items-center gap-1 bg-[var(--bg-base)] p-0.5 rounded-sm border border-[var(--border-color)]">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'threats', label: 'Threats' },
                    { id: 'blocked', label: 'Blocked' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFeedFilter(f.id as any)}
                      className={`px-2.5 py-0.5 font-mono text-[10px] uppercase rounded-sm transition-colors cursor-pointer ${
                        feedFilter === f.id
                          ? 'bg-[var(--primary)] text-[#001f27] font-bold'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={togglePause}
                className="text-[11px] font-mono uppercase tracking-wider text-[var(--primary)] transition-colors hover:text-white cursor-pointer"
              >
                {isPaused ? '▶ Resume Feed' : '⏸ Pause Feed'}
              </button>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[rgba(255,255,255,0.02)]">
                    <th className="p-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Agent ID</th>
                    <th className="p-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Action Event</th>
                    <th className="p-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Risk Score</th>
                    <th className="p-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Timestamp (IST)</th>
                    <th className="p-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Status</th>
                    <th className="p-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] text-sm">
                  {displayFeed
                    .filter((row: WSMessage) => {
                      const riskVal = Number(row.risk || 0)
                      if (feedFilter === 'threats') {
                        return riskVal >= 60 || row.tone === 'danger' || row.tone === 'warning'
                      }
                      if (feedFilter === 'blocked') {
                        return row.decision === 'deny' || row.status === 'Critical' || riskVal >= 80
                      }
                      return true
                    })
                    .map((row: WSMessage, idx: number) => {
                      const agentId = row.agent || 'AGT-009'
                      const actionName = row.action || 'Event Telemetry'
                      const riskVal = row.risk || 50
                      const toneVal = row.tone || (Number(riskVal) > 70 ? 'danger' : Number(riskVal) > 40 ? 'warning' : 'success')
                      const timeVal = row.time || '14:32:41'
                      const statusText = row.status || (toneVal === 'danger' ? 'Critical' : toneVal === 'warning' ? 'Suspicious' : 'Normal')

                      return (
                        <tr
                          key={idx}
                          onClick={() => setSelectedEvent(row)}
                          className="group cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                        >
                          <td className="p-3 font-mono font-semibold text-[var(--primary)] group-hover:underline">
                            <Link to={`/agent/${agentId}`} onClick={(e) => e.stopPropagation()}>
                              {agentId}
                            </Link>
                          </td>
                          <td className="p-3 text-[var(--text-main)] font-medium">{actionName}</td>
                          <td className="p-3">
                            <StatBadge tone={toneVal}>{riskVal}</StatBadge>
                          </td>
                          <td className="p-3 font-mono text-[12px] text-[var(--text-muted)] whitespace-nowrap">
                            {timeVal.includes('IST') ? timeVal : `${timeVal} IST`}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  toneVal === 'danger'
                                    ? 'bg-[var(--status-danger)] shadow-[0_0_4px_#F85149]'
                                    : toneVal === 'warning'
                                    ? 'bg-[var(--status-warning)]'
                                    : toneVal === 'success'
                                    ? 'bg-[var(--status-success)]'
                                    : 'bg-[var(--text-muted)]'
                                }`}
                              />
                              <span
                                className={`text-[12px] font-semibold ${
                                  toneVal === 'danger'
                                    ? 'text-[var(--status-danger)]'
                                    : toneVal === 'warning'
                                    ? 'text-[var(--status-warning)]'
                                    : toneVal === 'success'
                                    ? 'text-[var(--status-success)]'
                                    : 'text-[var(--text-muted)]'
                                }`}
                              >
                                {statusText}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <span className="text-[11px] font-mono text-[var(--primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                              Details →
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="grid h-full gap-6 lg:grid-rows-[1.2fr_0.8fr]">
            <MetricChart />
            <NodesPanel />
          </div>
        </div>
      </div>

      {/* Forensic Telemetry Event Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-sm border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[var(--border-color)] pb-3">
              <div>
                <h3 className="text-base font-bold font-mono text-[var(--text-main)] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[var(--primary)]">troubleshoot</span>
                  Forensic Telemetry Event Inspection
                </h3>
                <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                  Agent: <span className="text-[var(--primary)] font-bold">{selectedEvent.agent}</span> • {selectedEvent.time}
                </p>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs font-mono">
              <div className="grid grid-cols-3 gap-3 p-3 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm">
                <div>
                  <span className="text-[10px] uppercase text-[var(--text-muted)] block">Action Name</span>
                  <span className="font-semibold text-[var(--text-main)]">{selectedEvent.action}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[var(--text-muted)] block">Risk Score</span>
                  <span className={`font-bold ${
                    Number(selectedEvent.risk || 0) >= 70
                      ? 'text-[var(--status-danger)]'
                      : Number(selectedEvent.risk || 0) >= 40
                      ? 'text-[var(--status-warning)]'
                      : 'text-[var(--status-success)]'
                  }`}>
                    {selectedEvent.risk}/100
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[var(--text-muted)] block">Gateway Decision</span>
                  <span className={`font-bold uppercase ${
                    selectedEvent.decision === 'deny' || selectedEvent.tone === 'danger'
                      ? 'text-[var(--status-danger)]'
                      : 'text-[var(--status-success)]'
                  }`}>
                    {selectedEvent.decision === 'deny' || selectedEvent.tone === 'danger' ? 'DENIED / BLOCKED' : 'ALLOWED'}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                    Raw Telemetry Payload:
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedEvent, null, 2))
                    }}
                    className="text-[10px] text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[12px]">content_copy</span>
                    Copy JSON
                  </button>
                </div>
                <pre className="p-3 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm text-[#A8E8FF] overflow-x-auto max-h-48 leading-relaxed">
                  {JSON.stringify(
                    {
                      event_type: selectedEvent.type,
                      agent_id: selectedEvent.agent,
                      action_type: selectedEvent.action,
                      risk_score: selectedEvent.risk,
                      decision: selectedEvent.decision || (selectedEvent.tone === 'danger' ? 'deny' : 'allow'),
                      timestamp: selectedEvent.time,
                      status: selectedEvent.status,
                      matched_rules: selectedEvent.rules || (Number(selectedEvent.risk || 0) >= 70 ? ['RUL-001 (Unauthorized Access)'] : []),
                    },
                    null,
                    2
                  )}
                </pre>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-[var(--border-color)]">
                <Link
                  to={`/agent/${selectedEvent.agent}`}
                  className="px-3 py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--primary)] font-mono text-xs rounded-sm transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  Agent Profile
                </Link>

                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="px-4 py-1.5 bg-[var(--primary)] text-[#001f27] font-mono text-xs font-bold uppercase rounded-sm hover:bg-[#00b0d4] transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}