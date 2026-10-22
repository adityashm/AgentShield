import React, { useState, useEffect, useRef } from 'react'
import { useWebSocket } from '../../ws/WebSocketContext'
import { formatISTTime } from '../../utils/time'

export interface LogEntry {
  id?: string
  timestamp: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'
  agentId: string
  action: string
  result: string
  message: string
  rawPayload?: Record<string, any>
}

const fallbackHistoricalLogs: LogEntry[] = [
  {
    id: 'log-001',
    timestamp: '14:42:01.402',
    level: 'ERROR',
    agentId: 'AGT-009',
    action: 'unauthorized_access',
    result: '403 FORBIDDEN',
    message: 'Access denied to /sys/config - Invalid token signature',
    rawPayload: { path: '/sys/config', attempt_type: 'read', error_code: 'ERR_INVALID_SIG', caller: 'subagent_worker' },
  },
  {
    id: 'log-002',
    timestamp: '14:41:55.120',
    level: 'WARN',
    agentId: 'AGT-042',
    action: 'network_jitter',
    result: 'DEGRADED',
    message: '15ms latency spike detected on telemetry interface',
    rawPayload: { baseline_latency_ms: 12, observed_latency_ms: 27, buffer_queue_size: 42 },
  },
  {
    id: 'log-003',
    timestamp: '14:41:40.890',
    level: 'INFO',
    agentId: 'AGT-001',
    action: 'heartbeat_ok',
    result: '200 OK',
    message: 'Agent node nominal. Payload sync completed in 0.04s',
    rawPayload: { status: 'healthy', memory_mb: 218, cpu_pct: 4.2 },
  },
  {
    id: 'log-004',
    timestamp: '14:41:38.204',
    level: 'INFO',
    agentId: 'AGT-009',
    action: 'auth_attempt',
    result: 'PENDING',
    message: 'Initiating cryptographic handshake with central security gateway',
    rawPayload: { key_prefix: 'ashield_live_c41', protocol: 'TLS_1_3' },
  },
  {
    id: 'log-005',
    timestamp: '14:41:12.771',
    level: 'CRITICAL',
    agentId: 'AGT-014',
    action: 'process_termination',
    result: 'SIGKILL',
    message: 'Core service unexpected exit. Isolation guardrail triggered.',
    rawPayload: { trigger: 'RUL-004', isolation_status: 'QUARANTINED', reason: 'Privilege escalation attempt' },
  },
  {
    id: 'log-006',
    timestamp: '14:40:50.005',
    level: 'INFO',
    agentId: 'AGT-022',
    action: 'data_ingest',
    result: '200 OK',
    message: 'Processed 4,096 bytes from synthetic stream source A',
    rawPayload: { bytes_ingested: 4096, batch_id: 'bth_992' },
  },
  {
    id: 'log-007',
    timestamp: '14:40:45.312',
    level: 'WARN',
    agentId: 'AGT-001',
    action: 'resource_usage',
    result: '85% LOAD',
    message: 'Memory utilization approaching threshold. Triggering GC sweep.',
    rawPayload: { memory_used_mb: 1840, memory_limit_mb: 2048, gc_pass: 1 },
  },
  {
    id: 'log-008',
    timestamp: '14:40:15.990',
    level: 'INFO',
    agentId: 'AGT-009',
    action: 'rule_evaluation',
    result: 'PASS',
    message: 'Evaluated ruleset SEC_POL_04. No anomalies detected.',
    rawPayload: { policy_id: 'SEC_POL_04', rules_checked: 18, execution_time_ms: 1.2 },
  },
  {
    id: 'log-009',
    timestamp: '14:39:58.450',
    level: 'ERROR',
    agentId: 'AGT-014',
    action: 'db_connection',
    result: '503 TIMEOUT',
    message: 'Connection timeout to primary replica. Retrying in 500ms...',
    rawPayload: { host: 'postgres-primary.internal', port: 5432, timeout_s: 5 },
  },
]

export default function LogsDirectory() {
  const { messages, status } = useWebSocket()
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<'all' | 'critical' | 'error' | 'warn' | 'info'>('all')
  const [agentFilter, setAgentFilter] = useState('all')
  const [followLogs, setFollowLogs] = useState(true)
  const [logs, setLogs] = useState<LogEntry[]>(fallbackHistoricalLogs)
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)
  const [copiedPayload, setCopiedPayload] = useState(false)
  const logsEndRef = useRef<HTMLDivElement | null>(null)

  // Stream new messages from WebSocket into the live logs list
  useEffect(() => {
    if (messages.length > 0) {
      const latestMsg = messages[0]
      const risk = Number(latestMsg.risk || 0)
      const level: LogEntry['level'] =
        risk >= 80 ? 'CRITICAL' : risk >= 60 ? 'ERROR' : risk >= 40 ? 'WARN' : 'INFO'
      const newEntry: LogEntry = {
        id: `log-ws-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: latestMsg.time
          ? formatISTTime(latestMsg.time)
          : formatISTTime(new Date()),
        level,
        agentId: latestMsg.agent || 'AGT-009',
        action: latestMsg.action || 'event_stream',
        result: risk >= 80 ? 'QUARANTINE' : risk >= 40 ? 'REVIEW' : 'NOMINAL',
        message: `${latestMsg.action || 'Event stream'} executed with risk score ${risk}/100 [status: ${latestMsg.status || 'OK'}]`,
        rawPayload: {
          agent: latestMsg.agent,
          action: latestMsg.action,
          risk: latestMsg.risk,
          status: latestMsg.status,
          framework: latestMsg.framework || 'LangChain',
          timestamp: new Date().toISOString(),
        },
      }

      setLogs((prev) => {
        if (prev[0] && prev[0].timestamp === newEntry.timestamp && prev[0].agentId === newEntry.agentId) {
          return prev
        }
        return [newEntry, ...prev].slice(0, 500)
      })
    }
  }, [messages])

  // Auto-scroll when followLogs is active
  useEffect(() => {
    if (followLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, followLogs])

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      search === '' ||
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      log.agentId.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase())
    const matchesLevel = levelFilter === 'all' || log.level.toLowerCase() === levelFilter.toLowerCase()
    const matchesAgent = agentFilter === 'all' || log.agentId === agentFilter
    return matchesSearch && matchesLevel && matchesAgent
  })

  const handleExport = () => {
    const lines = filteredLogs.map(
      (l) => `[${l.timestamp}] [${l.level.padEnd(8)}] [${l.agentId}] [${l.action}] - ${l.result} : ${l.message}`
    )
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `agentshield_logs_${Date.now()}.log`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleCopyPayload = (obj: any) => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2))
    setCopiedPayload(true)
    setTimeout(() => setCopiedPayload(false), 2000)
  }

  // Get distinct agents for filter dropdown
  const distinctAgents = Array.from(new Set(logs.map((l) => l.agentId)))

  const levelCounts = {
    all: logs.length,
    critical: logs.filter((l) => l.level === 'CRITICAL').length,
    error: logs.filter((l) => l.level === 'ERROR').length,
    warn: logs.filter((l) => l.level === 'WARN').length,
    info: logs.filter((l) => l.level === 'INFO').length,
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 panel-obsidian p-5 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center text-sky-400">
            <span className="material-symbols-outlined text-xl">terminal</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-white text-lg font-semibold tracking-tight">System Telemetry & Terminal Logs</h1>
              <div
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider ${
                  status === 'LIVE'
                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                    : 'bg-amber-950/60 text-amber-400 border border-amber-800/50'
                }`}
              >
                <div
                  className={`h-1.5 w-1.5 rounded-full ${
                    status === 'LIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                {status === 'LIVE' ? 'Live WebSocket Feed' : 'Offline Replay Buffer'}
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              High-throughput runtime action stream with sub-millisecond host telemetry capture.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Follow Logs Toggle */}
          <button
            onClick={() => setFollowLogs(!followLogs)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer border ${
              followLogs
                ? 'bg-sky-500/10 border-sky-500/40 text-sky-400 shadow-sm shadow-sky-500/20'
                : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">
              {followLogs ? 'sync' : 'sync_disabled'}
            </span>
            <span>Follow Stream ({followLogs ? 'AUTO' : 'OFF'})</span>
          </button>

          {/* Export Button */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 border border-white/10 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-mono font-medium text-slate-200 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">download</span>
            Export .LOG
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="panel-obsidian p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[260px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[16px]">
            search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs by action, agent ID, status, or message..."
            className="w-full bg-slate-950/60 border border-white/10 rounded-lg text-xs pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:border-sky-500 outline-none font-mono transition-colors"
          />
        </div>

        {/* Severity Level Pills */}
        <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-lg border border-white/5">
          {(['all', 'critical', 'error', 'warn', 'info'] as const).map((level) => {
            const count = levelCounts[level]
            const isActive = levelFilter === level
            return (
              <button
                key={level}
                onClick={() => setLevelFilter(level)}
                className={`px-3 py-1 font-mono text-xs uppercase rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? level === 'critical'
                      ? 'bg-rose-950 text-rose-300 font-bold border border-rose-800/60'
                      : level === 'error'
                      ? 'bg-rose-950/80 text-rose-400 font-bold border border-rose-800/40'
                      : level === 'warn'
                      ? 'bg-amber-950 text-amber-300 font-bold border border-amber-800/60'
                      : level === 'info'
                      ? 'bg-sky-950 text-sky-300 font-bold border border-sky-800/60'
                      : 'bg-sky-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>{level}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-black/40' : 'bg-slate-800'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Agent Filter */}
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="bg-slate-950/60 border border-white/10 rounded-lg text-xs px-3 py-2 text-slate-300 focus:border-sky-500 outline-none font-mono cursor-pointer transition-colors"
        >
          <option value="all">Agent: All Fleets</option>
          {distinctAgents.map((ag) => (
            <option key={ag} value={ag}>
              {ag}
            </option>
          ))}
        </select>
      </div>

      {/* Main Terminal Viewport & Detail Inspector Split */}
      <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-[520px]">
        {/* Terminal Grid Container */}
        <div className="flex-1 panel-obsidian rounded-xl overflow-hidden flex flex-col min-w-0">
          <div className="overflow-x-auto flex-1 flex flex-col">
            <div className="min-w-[860px] flex-1 flex flex-col font-mono text-xs">
              {/* Table Header */}
              <div className="grid grid-cols-[140px_90px_110px_170px_130px_1fr] gap-3 px-4 py-3 bg-slate-950/80 border-b border-white/5 text-slate-400 text-[11px] uppercase tracking-wider sticky top-0 z-10 shrink-0">
                <div>Timestamp (IST)</div>
                <div>Level</div>
                <div>Agent ID</div>
                <div>Action Type</div>
                <div>Result</div>
                <div>Log Telemetry Message</div>
              </div>

              {/* Scrollable Rows */}
              <div className="flex-1 overflow-y-auto leading-relaxed divide-y divide-white/5">
                {filteredLogs.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 font-mono">
                    <span className="material-symbols-outlined text-3xl mb-2 text-slate-600">search_off</span>
                    <div>No log entries match the specified filter criteria.</div>
                  </div>
                ) : (
                  filteredLogs.map((log, index) => {
                    const isSelected = selectedLog?.id === log.id || (selectedLog && selectedLog.timestamp === log.timestamp && selectedLog.agentId === log.agentId)
                    return (
                      <div
                        key={log.id || index}
                        onClick={() => setSelectedLog(log)}
                        className={`grid grid-cols-[140px_90px_110px_170px_130px_1fr] gap-3 px-4 py-2.5 hover:bg-slate-800/40 transition-colors cursor-pointer border-l-4 ${
                          isSelected
                            ? 'bg-sky-950/30 border-l-sky-400'
                            : log.level === 'CRITICAL'
                            ? 'bg-rose-950/20 border-l-rose-500'
                            : log.level === 'ERROR'
                            ? 'border-l-rose-500/70'
                            : log.level === 'WARN'
                            ? 'border-l-amber-500/70'
                            : 'border-l-transparent'
                        }`}
                      >
                        <div className="text-slate-400 text-[11px]">{log.timestamp}</div>
                        <div>
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              log.level === 'CRITICAL'
                                ? 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                                : log.level === 'ERROR'
                                ? 'bg-rose-950/50 text-rose-400 border border-rose-800/40'
                                : log.level === 'WARN'
                                ? 'bg-amber-950/50 text-amber-400 border border-amber-800/40'
                                : 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/40'
                            }`}
                          >
                            {log.level}
                          </span>
                        </div>
                        <div className="font-semibold text-sky-400">{log.agentId}</div>
                        <div className="text-slate-200 truncate">{log.action}</div>
                        <div className="text-slate-400 text-[11px] truncate">{log.result}</div>
                        <div className="text-slate-300 truncate font-sans text-xs">{log.message}</div>
                      </div>
                    )
                  })
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        </div>

        {/* Selected Log Inspector Drawer / Side Panel */}
        {selectedLog && (
          <div className="w-full xl:w-[420px] 2xl:w-[460px] panel-obsidian rounded-xl p-5 flex flex-col shrink-0 overflow-hidden font-mono text-xs gap-4 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sky-400 text-lg">data_object</span>
                <span className="text-white font-semibold uppercase tracking-wider text-xs">
                  Telemetry Payload Detail
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close Inspector"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-white/5">
                  <div className="text-[10px] text-slate-400 uppercase">Agent Node</div>
                  <div className="text-sky-400 font-bold mt-0.5">{selectedLog.agentId}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-white/5">
                  <div className="text-[10px] text-slate-400 uppercase">Timestamp</div>
                  <div className="text-slate-200 mt-0.5">{selectedLog.timestamp}</div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-white/5">
                <div className="text-[10px] text-slate-400 uppercase">Action Type & Result</div>
                <div className="text-white font-semibold mt-0.5">{selectedLog.action}</div>
                <div className="text-slate-400 text-[11px] mt-0.5">{selectedLog.result}</div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-white/5">
                <div className="text-[10px] text-slate-400 uppercase">Message Trace</div>
                <div className="text-slate-200 text-xs font-sans mt-1 leading-relaxed">
                  {selectedLog.message}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Raw Telemetry Parameters (JSON)
                  </span>
                  <button
                    onClick={() => handleCopyPayload(selectedLog.rawPayload || selectedLog)}
                    className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {copiedPayload ? 'check' : 'content_copy'}
                    </span>
                    {copiedPayload ? 'Copied' : 'Copy JSON'}
                  </button>
                </div>
                <pre className="p-3 bg-[#070b12] border border-white/10 rounded-lg text-slate-300 overflow-x-auto text-[11px] leading-relaxed shadow-inner">
                  {JSON.stringify(selectedLog.rawPayload || { action: selectedLog.action, message: selectedLog.message }, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
