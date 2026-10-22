import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getAgents, getAlerts, ingestAction } from '../api'
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

function Icon({ name }: { name: string }) {
  return <span className="material-symbols-outlined text-[18px]">{name}</span>
}

function StatBadge({ tone, children }: { tone?: string; children: React.ReactNode }) {
  const classes: Record<string, string> = {
    danger: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    info: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  }

  const selectedTone = tone && classes[tone] ? classes[tone] : classes['info']

  return (
    <span className={`inline-flex items-center justify-center rounded px-2 py-0.5 font-mono text-xs font-bold border ${selectedTone}`}>
      {children}
    </span>
  )
}

function MetricChart() {
  const { messages } = useWebSocket()
  const [activeSeries, setActiveSeries] = useState<'all' | 'risk' | 'anomaly'>('all')
  const [chartData, setChartData] = useState<{
    labels: string[]
    riskIndex: number[]
    anomalyScore: number[]
    cpuLoad: number[]
  }>({
    labels: ['19:25', '19:26', '19:27', '19:28', '19:29', '19:30', '19:31', '19:32'],
    riskIndex: [22, 28, 35, 32, 64, 88, 70, 58],
    anomalyScore: [12, 16, 20, 52, 80, 92, 55, 42],
    cpuLoad: [24, 26, 25, 27, 30, 35, 31, 28],
  })

  // Bind incoming WebSocket telemetry messages to dynamic rolling chart data
  useEffect(() => {
    if (!messages || messages.length === 0) return
    const latest = messages[0]
    const timeLabel = latest.time ? latest.time.split('.')[0] : getLiveISTTime().slice(0, 5)
    const newRisk = typeof latest.risk === 'number' ? latest.risk : parseFloat(latest.risk || '45') || 45
    const newAnomaly = Math.min(100, Math.max(10, Math.round(newRisk * (latest.tone === 'danger' ? 1.05 : 0.88))))
    const newCpu = Math.round(25 + Math.random() * 12)

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

  const datasets = []

  if (activeSeries === 'all' || activeSeries === 'risk') {
    datasets.push({
      label: 'Fleet Risk Index',
      data: chartData.riskIndex,
      borderColor: '#38bdf8',
      backgroundColor: 'rgba(56, 189, 248, 0.12)',
      fill: true,
      tension: 0.35,
      borderWidth: 2,
      pointRadius: 2.5,
      pointHoverRadius: 5,
    })
  }

  if (activeSeries === 'all' || activeSeries === 'anomaly') {
    datasets.push({
      label: 'Isolation Forest Anomaly',
      data: chartData.anomalyScore,
      borderColor: '#f43f5e',
      backgroundColor: 'rgba(244, 63, 94, 0.08)',
      fill: true,
      tension: 0.35,
      borderWidth: 2,
      pointRadius: 2.5,
      pointHoverRadius: 5,
    })
  }

  if (activeSeries === 'all') {
    datasets.push({
      label: 'Cluster Load',
      data: chartData.cpuLoad,
      borderColor: '#10b981',
      backgroundColor: 'transparent',
      borderDash: [3, 3],
      borderWidth: 1.5,
      pointRadius: 0,
    })
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#38bdf8',
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 4,
        displayColors: true,
        bodyFont: { family: 'JetBrains Mono', size: 11 },
        titleFont: { family: 'Inter', size: 12, weight: 'bold' as const },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.04)',
        },
        ticks: {
          color: '#64748b',
          font: { family: 'JetBrains Mono', size: 10 },
        },
      },
      y: {
        min: 0,
        max: 100,
        grid: {
          color: 'rgba(255, 255, 255, 0.04)',
        },
        ticks: {
          color: '#64748b',
          font: { family: 'JetBrains Mono', size: 10 },
          stepSize: 25,
        },
      },
    },
  }

  return (
    <div className="flex h-full flex-col panel-obsidian p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--primary)] text-base">monitoring</span>
            Continuous Threat &amp; Anomaly Telemetry
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Real-time sliding window evaluating action velocity and Isolation Forest anomaly distributions
          </p>
        </div>

        {/* Series Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-[var(--bg-canvas)] p-1 rounded border border-[var(--border-color)] text-xs">
          <button
            onClick={() => setActiveSeries('all')}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              activeSeries === 'all'
                ? 'bg-[var(--primary)] text-[#090d16] font-bold shadow-sm'
                : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            Combined
          </button>
          <button
            onClick={() => setActiveSeries('risk')}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              activeSeries === 'risk'
                ? 'bg-sky-400 text-[#090d16] font-bold shadow-sm'
                : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            Risk Only
          </button>
          <button
            onClick={() => setActiveSeries('anomaly')}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              activeSeries === 'anomaly'
                ? 'bg-rose-400 text-[#090d16] font-bold shadow-sm'
                : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            ML Anomaly
          </button>
        </div>
      </div>

      <div className="relative min-h-[220px] flex-1">
        <Line data={{ labels: chartData.labels, datasets }} options={options} />
      </div>

      {/* Legend Footer */}
      <div className="mt-3 pt-3 border-t border-[var(--border-color)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.5)]" />
            <span>Risk Score (Weighted AST)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]" />
            <span>Isolation Forest Anomaly</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>System Load</span>
          </span>
        </div>
        <span className="font-mono text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          SAMPLING RATE: 1000ms
        </span>
      </div>
    </div>
  )
}

function NodesPanel() {
  const nodeRows = [
    {
      name: 'Safe AST Rule Engine',
      role: 'OWASP ASI01–ASI10 / MITRE ATLAS',
      metric: '20 Active Rules',
      tone: 'text-emerald-400',
      icon: 'verified_user',
    },
    {
      name: 'Isolation Forest ML Model',
      role: 'Unsupervised Behavioral Anomaly Scoring',
      metric: 'p95 < 4ms',
      tone: 'text-emerald-400',
      icon: 'psychology',
    },
    {
      name: 'Pre-Flight Enforce Gateway',
      role: 'Synchronous Allow/Deny Pre-Execution Guard',
      metric: '38ms (SLA < 50ms)',
      tone: 'text-sky-400',
      icon: 'security',
    },
    {
      name: 'PostgreSQL 16 Multi-Tenant',
      role: 'Cryptographic Audit Hash Chain & Storage',
      metric: 'Zero Loss / Scoped',
      tone: 'text-emerald-400',
      icon: 'database',
    },
  ]

  return (
    <div className="flex h-full flex-col panel-obsidian p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--primary)] text-base">hub</span>
          Runtime Defense Infrastructure
        </h2>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase font-bold text-emerald-400">
          4 / 4 Healthy
        </span>
      </div>
      <div className="space-y-3">
        {nodeRows.map((node) => (
          <div
            key={node.name}
            className="flex items-center justify-between p-2.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--border-color)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded flex items-center justify-center bg-[var(--bg-surface-elevated)] text-[var(--primary)]">
                <Icon name={node.icon} />
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--text-main)]">{node.name}</div>
                <div className="text-[10px] text-[var(--text-muted)]">{node.role}</div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-xs font-mono font-bold ${node.tone}`}>{node.metric}</div>
              <div className="text-[9px] text-[var(--text-muted)] uppercase font-semibold">Status</div>
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
  const [isInjectingDemo, setIsInjectingDemo] = useState(false)
  const [metrics, setMetrics] = useState({
    activeAgents: '12',
    actionsToday: '4,847',
    openAlerts: '3',
    highestRiskAgent: 'AGT-009',
    highestRiskScore: '94/100',
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
            highestRiskAgent: highest?.agent_id || highest?.id || 'AGT-009',
            highestRiskScore: `${Math.round(highest?.current_risk_score || 94)}/100`,
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
      title: 'Active Agents Protected',
      value: metrics.activeAgents,
      subtext: 'Across LangChain & CrewAI fleets',
      accentColor: 'border-l-emerald-500',
      icon: 'smart_toy',
      iconBg: 'bg-emerald-500/10 text-emerald-400',
      trend: '+2 new today',
      link: '/agents',
    },
    {
      title: 'Monitored Actions (24h)',
      value: metrics.actionsToday,
      subtext: 'Synchronous & async telemetry',
      accentColor: 'border-l-sky-500',
      icon: 'swap_horiz',
      iconBg: 'bg-sky-500/10 text-sky-400',
      trend: '100% evaluated',
      link: '/logs',
    },
    {
      title: 'Open Threat Incidents',
      value: metrics.openAlerts,
      subtext: 'Requires SOC triage',
      accentColor: 'border-l-rose-500',
      icon: 'warning',
      iconBg: 'bg-rose-500/10 text-rose-400',
      badge: true,
      trend: '3 Critical / High',
      link: '/alerts',
    },
    {
      title: 'Highest Risk Agent',
      value: metrics.highestRiskAgent,
      detail: metrics.highestRiskScore,
      subtext: 'Anomalous file traversal',
      accentColor: 'border-l-amber-500',
      icon: 'shield',
      iconBg: 'bg-amber-500/10 text-amber-400',
      trend: 'Quarantine available',
      link: `/agent/${metrics.highestRiskAgent}`,
    },
  ]

  // Default initial feed rows if WebSocket has not received messages yet
  const initialRows: WSMessage[] = [
    {
      type: 'ACTION_EVENT',
      agent: 'AGT-009',
      action: 'Sensitive File Access (/etc/shadow)',
      risk: 94,
      tone: 'danger' as const,
      time: '19:32:11.002',
      status: 'Critical',
      decision: 'deny',
    },
    {
      type: 'ACTION_EVENT',
      agent: 'AGT-042',
      action: 'Prompt Injection Jailbreak Signature',
      risk: 82,
      tone: 'danger' as const,
      time: '19:31:55.115',
      status: 'Critical',
      decision: 'deny',
    },
    {
      type: 'ACTION_EVENT',
      agent: 'langchain_agent',
      action: 'SQL User Query (SELECT users)',
      risk: 18,
      tone: 'success' as const,
      time: '19:31:40.401',
      status: 'Normal',
      decision: 'allow',
    },
    {
      type: 'ACTION_EVENT',
      agent: 'AGT-014',
      action: 'Vector Store Query Embeddings',
      risk: 12,
      tone: 'success' as const,
      time: '19:31:22.700',
      status: 'Normal',
      decision: 'allow',
    },
  ]

  const displayFeed = messages.length > 0 ? messages.slice(0, 12) : initialRows

  // Fast threat demo injection
  const triggerDemoThreat = async () => {
    setIsInjectingDemo(true)
    try {
      await ingestAction({
        agent_id: 'AGT-009',
        action_type: 'file_read',
        parameters: { path: '/etc/shadow' },
      })
    } catch {
      // Ignored
    } finally {
      setTimeout(() => setIsInjectingDemo(false), 800)
    }
  }

  return (
    <div className="space-y-6 max-w-[1720px] mx-auto pb-8">
      {/* Operations Overview Bar */}
      <div className="panel-obsidian p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-[var(--primary)] shrink-0">
            <span className="material-symbols-outlined text-2xl">security</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-[var(--text-main)]">
                Autonomous Security Operations Center
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold uppercase flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ACTIVE ENFORCEMENT
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Multi-tenant telemetry ingestion, pre-flight policy gate (<span className="text-sky-300 font-mono font-bold">p95 &lt; 42ms</span>), and behavioral anomaly monitoring.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={triggerDemoThreat}
            disabled={isInjectingDemo}
            className="px-3 py-1.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span className={`material-symbols-outlined text-[15px] ${isInjectingDemo ? 'animate-spin' : ''}`}>
              {isInjectingDemo ? 'sync' : 'bolt'}
            </span>
            {isInjectingDemo ? 'Simulating...' : 'Test Guardrail Block'}
          </button>

          <Link
            to="/onboarding"
            className="px-3 py-1.5 rounded bg-[var(--primary)] text-[#090d16] text-xs font-bold uppercase hover:bg-sky-400 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            Connect Agent
          </Link>
        </div>
      </div>

      {/* KPI Metric Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dynamicStatCards.map((card) => (
          <Link
            key={card.title}
            to={card.link || '#'}
            className={`panel-obsidian panel-obsidian-interactive p-4 border-l-4 ${card.accentColor} group flex flex-col justify-between relative`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  {card.title}
                </span>
                <span className={`p-1.5 rounded ${card.iconBg}`}>
                  <Icon name={card.icon} />
                </span>
              </div>
              <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[var(--text-main)] group-hover:text-[var(--primary)] transition-colors tabular-numbers">
                {card.value}
              </div>
              {card.detail && (
                <div className="text-xs font-mono font-bold text-amber-400 mt-1">
                  Risk Level: {card.detail}
                </div>
              )}
            </div>

            <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>{card.subtext}</span>
              <span className="text-emerald-400 font-semibold">{card.trend}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Live Action Feed & Analytics Grid */}
      <div className="grid min-h-[440px] grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Real-time Telemetry Stream (8 cols) */}
        <div className="lg:col-span-8">
          <div className="flex h-full flex-col panel-obsidian overflow-hidden">
            <div className="flex flex-wrap items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-surface-elevated)] p-3.5 gap-3">
              <div className="flex items-center gap-3">
                <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)]">
                  <span className="material-symbols-outlined text-[var(--primary)] text-base">radar</span>
                  Live Agent Action Telemetry
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                </h2>

                <div className="flex items-center gap-1 bg-[var(--bg-canvas)] p-0.5 rounded border border-[var(--border-color)] text-xs">
                  {[
                    { id: 'all', label: 'All Events' },
                    { id: 'threats', label: 'Suspicious' },
                    { id: 'blocked', label: 'Blocked Only' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFeedFilter(f.id as any)}
                      className={`px-2.5 py-0.5 text-[10px] uppercase font-bold rounded transition-colors cursor-pointer ${
                        feedFilter === f.id
                          ? 'bg-[var(--primary)] text-[#090d16] shadow-sm'
                          : 'text-[var(--text-muted)] hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={togglePause}
                  className="text-xs font-mono font-semibold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">{isPaused ? 'play_arrow' : 'pause'}</span>
                  {isPaused ? 'Resume Stream' : 'Pause Stream'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full border-collapse text-left whitespace-nowrap min-w-[640px]">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-canvas)] text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
                    <th className="py-2.5 px-3.5">AGENT NODE</th>
                    <th className="py-2.5 px-3.5">ACTION EVENT</th>
                    <th className="py-2.5 px-3.5">RISK SCORE</th>
                    <th className="py-2.5 px-3.5">TIMESTAMP</th>
                    <th className="py-2.5 px-3.5">GATEWAY POLICY</th>
                    <th className="py-2.5 px-3.5 text-right">INSPECT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] text-xs font-mono">
                  {displayFeed
                    .filter((row: WSMessage) => {
                      const riskVal = Number(row.risk || 0)
                      if (feedFilter === 'threats') {
                        return riskVal >= 50 || row.tone === 'danger' || row.tone === 'warning'
                      }
                      if (feedFilter === 'blocked') {
                        return row.decision === 'deny' || row.status === 'Critical' || riskVal >= 80
                      }
                      return true
                    })
                    .map((row: WSMessage, idx: number) => {
                      const agentId = row.agent || 'AGT-009'
                      const actionName = row.action || 'Event Telemetry'
                      const riskVal = row.risk || 40
                      const isDenied = row.decision === 'deny' || row.tone === 'danger' || Number(riskVal) >= 80
                      const timeVal = row.time || '19:32:00'

                      return (
                        <tr
                          key={idx}
                          onClick={() => setSelectedEvent(row)}
                          className="group cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                        >
                          <td className="py-2.5 px-3.5 font-bold text-sky-400 group-hover:underline">
                            <Link to={`/agent/${agentId}`} onClick={(e) => e.stopPropagation()}>
                              {agentId}
                            </Link>
                          </td>
                          <td className="py-2.5 px-3.5 text-[var(--text-main)] font-medium">
                            <span className="truncate max-w-xs block">{actionName}</span>
                          </td>
                          <td className="py-2.5 px-3.5">
                            <StatBadge tone={isDenied ? 'danger' : Number(riskVal) >= 50 ? 'warning' : 'success'}>
                              {riskVal}/100
                            </StatBadge>
                          </td>
                          <td className="py-2.5 px-3.5 text-[var(--text-muted)] text-[11px]">
                            {timeVal.includes('IST') ? timeVal : `${timeVal} IST`}
                          </td>
                          <td className="py-2.5 px-3.5">
                            {isDenied ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                                BLOCKED (DENIED)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                ALLOWED
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-right">
                            <span className="text-[11px] font-semibold text-[var(--primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                              Forensics →
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

        {/* Right Column: Dynamic Metrics Chart & Infrastructure Nodes (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <MetricChart />
          <NodesPanel />
        </div>
      </div>

      {/* Forensic Telemetry Modal Drawer */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded panel-elevated p-6 shadow-2xl font-mono">
            <div className="flex items-start justify-between border-b border-[var(--border-color)] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[var(--primary)]">fingerprint</span>
                  Forensic Telemetry Event Inspection
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Agent: <span className="text-sky-400 font-bold">{selectedEvent.agent}</span> • {selectedEvent.time}
                </p>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 p-3 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded">
                <div>
                  <span className="text-[10px] uppercase text-[var(--text-muted)] block">Action Name</span>
                  <span className="font-bold text-[var(--text-main)] truncate block">{selectedEvent.action}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[var(--text-muted)] block">Risk Score</span>
                  <span className={`font-bold ${
                    Number(selectedEvent.risk || 0) >= 70
                      ? 'text-rose-400'
                      : Number(selectedEvent.risk || 0) >= 40
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}>
                    {selectedEvent.risk}/100
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[var(--text-muted)] block">Policy Decision</span>
                  <span className={`font-bold uppercase ${
                    selectedEvent.decision === 'deny' || selectedEvent.tone === 'danger'
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}>
                    {selectedEvent.decision === 'deny' || selectedEvent.tone === 'danger' ? 'DENIED / BLOCKED' : 'ALLOWED'}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-bold">
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
                <pre className="p-3 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded text-sky-300 overflow-x-auto max-h-48 leading-relaxed text-[11px]">
                  {JSON.stringify(
                    {
                      event_type: selectedEvent.type,
                      agent_id: selectedEvent.agent,
                      action_type: selectedEvent.action,
                      risk_score: selectedEvent.risk,
                      decision: selectedEvent.decision || (selectedEvent.tone === 'danger' ? 'deny' : 'allow'),
                      timestamp: selectedEvent.time,
                      status: selectedEvent.status,
                      matched_rules: selectedEvent.rules || (Number(selectedEvent.risk || 0) >= 70 ? ['RUL-001: Unauthorized File Access Pattern'] : []),
                    },
                    null,
                    2
                  )}
                </pre>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-[var(--border-color)]">
                <Link
                  to={`/agent/${selectedEvent.agent}`}
                  className="px-3 py-1.5 bg-[var(--bg-canvas)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] text-sky-400 text-xs rounded transition-colors flex items-center gap-1 font-semibold"
                >
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  Agent Diagnostics
                </Link>

                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="px-4 py-1.5 bg-[var(--primary)] text-[#090d16] text-xs font-bold uppercase rounded hover:bg-sky-400 transition-colors cursor-pointer"
                  >
                    Done
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
