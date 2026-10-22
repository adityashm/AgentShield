import React, { useState, useEffect, useRef } from 'react'
import { useWebSocket } from '../../ws/WebSocketContext'
import { formatISTTime } from '../../utils/time'

export interface LogEntry {
  timestamp: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'
  agentId: string
  action: string
  result: string
  message: string
}

const fallbackHistoricalLogs: LogEntry[] = [
  {
    timestamp: '14:42:01.402',
    level: 'ERROR',
    agentId: 'AGT-009',
    action: 'unauthorized_access',
    result: '403 FORBIDDEN',
    message: 'Access denied to /sys/config - Invalid token signature',
  },
  {
    timestamp: '14:41:55.120',
    level: 'WARN',
    agentId: 'AGT-042',
    action: 'network_jitter',
    result: 'DEGRADED',
    message: '15ms latency spike detected on telemetry interface',
  },
  {
    timestamp: '14:41:40.890',
    level: 'INFO',
    agentId: 'AGT-001',
    action: 'heartbeat_ok',
    result: '200 OK',
    message: 'Agent node nominal. Payload sync completed in 0.04s',
  },
  {
    timestamp: '14:41:38.204',
    level: 'INFO',
    agentId: 'AGT-009',
    action: 'auth_attempt',
    result: 'PENDING',
    message: 'Initiating cryptographic handshake with central security gateway',
  },
  {
    timestamp: '14:41:12.771',
    level: 'CRITICAL',
    agentId: 'AGT-014',
    action: 'process_termination',
    result: 'SIGKILL',
    message: 'Core service unexpected exit. Isolation guardrail triggered.',
  },
  {
    timestamp: '14:40:50.005',
    level: 'INFO',
    agentId: 'AGT-022',
    action: 'data_ingest',
    result: '200 OK',
    message: 'Processed 4,096 bytes from synthetic stream source A',
  },
  {
    timestamp: '14:40:45.312',
    level: 'WARN',
    agentId: 'AGT-001',
    action: 'resource_usage',
    result: '85% LOAD',
    message: 'Memory utilization approaching threshold. Triggering GC sweep.',
  },
  {
    timestamp: '14:40:15.990',
    level: 'INFO',
    agentId: 'AGT-009',
    action: 'rule_evaluation',
    result: 'PASS',
    message: 'Evaluated ruleset SEC_POL_04. No anomalies detected.',
  },
  {
    timestamp: '14:39:58.450',
    level: 'ERROR',
    agentId: 'AGT-014',
    action: 'db_connection',
    result: '503 TIMEOUT',
    message: 'Connection timeout to primary replica. Retrying in 500ms...',
  },
]

export default function LogsDirectory() {
  const { messages, status } = useWebSocket()
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [agentFilter, setAgentFilter] = useState('all')
  const [followLogs, setFollowLogs] = useState(true)
  const [logs, setLogs] = useState<LogEntry[]>(fallbackHistoricalLogs)
  const logsEndRef = useRef<HTMLDivElement | null>(null)

  // Stream new messages from WebSocket into the live logs list
  useEffect(() => {
    if (messages.length > 0) {
      const latestMsg = messages[0]
      const risk = Number(latestMsg.risk || 0)
      const level: LogEntry['level'] =
        risk >= 80 ? 'CRITICAL' : risk >= 60 ? 'ERROR' : risk >= 40 ? 'WARN' : 'INFO'
      const newEntry: LogEntry = {
        timestamp: latestMsg.time ? (latestMsg.time.includes('IST') ? latestMsg.time : `${latestMsg.time} IST`) : formatISTTime(new Date()),
        level,
        agentId: latestMsg.agent || 'AGT-009',
        action: latestMsg.action || 'event_stream',
        result: risk >= 80 ? 'QUARANTINE' : risk >= 40 ? 'REVIEW' : 'NOMINAL',
        message: `${latestMsg.action || 'Event stream'} executed with risk score ${risk}/100 [status: ${latestMsg.status || 'OK'}]`,
      }

      setLogs((prev) => {
        // Avoid duplicate log by checking latest
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

  // Get distinct agents for filter dropdown
  const distinctAgents = Array.from(new Set(logs.map((l) => l.agentId)))

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 flex flex-col gap-4 font-mono">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[var(--text-main)] text-[22px] font-bold">System Telemetry Logs</h1>
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-sm border border-[rgba(35,134,54,0.3)] bg-[rgba(35,134,54,0.1)] text-xs">
            <div
              className={`h-2 w-2 rounded-full ${
                status === 'LIVE' ? 'bg-[var(--status-success)] animate-pulse' : 'bg-[var(--status-warning)]'
              }`}
            />
            <span className="text-[var(--text-main)] font-bold uppercase text-[10px]">
              {status === 'LIVE' ? 'LIVE STREAMING' : 'OFFLINE BUFFER'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Follow Logs Toggle */}
          <button
            onClick={() => setFollowLogs(!followLogs)}
            className={`flex items-center gap-2 px-3 py-1.5 border rounded-sm text-xs cursor-pointer transition-colors ${
              followLogs
                ? 'border-[var(--primary)] bg-[rgba(0,212,255,0.1)] text-[var(--primary)]'
                : 'border-[var(--border-color)] bg-[var(--bg-raised)] text-[var(--text-muted)]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {followLogs ? 'visibility' : 'visibility_off'}
            </span>
            <span>Follow Stream ({followLogs ? 'ON' : 'OFF'})</span>
          </button>

          {/* Export Button */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border-color)] rounded-sm bg-[var(--bg-raised)] hover:bg-[var(--bg-hover)] text-xs uppercase text-[var(--text-main)] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Export Log
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[16px]">
            search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search terminal logs (e.g. AGT-009, 403, error)..."
            className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm text-xs pl-8 pr-3 py-1.5 text-[var(--text-main)] focus:border-[var(--primary)] outline-none"
          />
        </div>

        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm text-xs px-2.5 py-1.5 text-[var(--text-main)] focus:border-[var(--primary)] outline-none cursor-pointer"
        >
          <option value="all">Level: All</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warn">Warn</option>
          <option value="info">Info</option>
        </select>

        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm text-xs px-2.5 py-1.5 text-[var(--text-main)] focus:border-[var(--primary)] outline-none cursor-pointer"
        >
          <option value="all">Agent: All</option>
          {distinctAgents.map((ag) => (
            <option key={ag} value={ag}>
              {ag}
            </option>
          ))}
        </select>
      </div>

      {/* Terminal Grid Container */}
      <div className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm overflow-hidden flex flex-col min-h-[480px]">
        <div className="overflow-x-auto flex-1 flex flex-col">
          <div className="min-w-[800px] flex-1 flex flex-col">
            {/* Table Header */}
            <div className="grid grid-cols-[140px_85px_110px_160px_120px_1fr] gap-3 px-4 py-2.5 bg-[var(--bg-base)] border-b border-[var(--border-color)] text-[var(--text-muted)] text-[11px] uppercase tracking-wider sticky top-0 z-10 shrink-0">
              <div>Timestamp (IST)</div>
              <div>Level</div>
              <div>Agent ID</div>
              <div>Action Type</div>
              <div>Result</div>
              <div>Log Message</div>
            </div>

            {/* Scrollable Rows */}
            <div className="flex-1 overflow-y-auto text-xs leading-relaxed divide-y divide-[var(--border-color)]/30">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-muted)] font-mono">
              No log messages matching filter parameters.
            </div>
          ) : (
            filteredLogs.map((log, index) => {
              const levelColor =
                log.level === 'CRITICAL'
                  ? 'text-[var(--status-danger)] font-bold'
                  : log.level === 'ERROR'
                  ? 'text-[var(--status-danger)]'
                  : log.level === 'WARN'
                  ? 'text-[var(--status-warning)]'
                  : 'text-[var(--status-success)]'

              return (
                <div
                  key={index}
                  className={`grid grid-cols-[140px_85px_110px_160px_120px_1fr] gap-3 px-4 py-2 hover:bg-[var(--bg-hover)] transition-colors ${
                    log.level === 'CRITICAL'
                      ? 'bg-[rgba(248,81,73,0.06)] border-l-4 border-l-[var(--status-danger)]'
                      : log.level === 'ERROR'
                      ? 'border-l-2 border-l-[var(--status-danger)]'
                      : log.level === 'WARN'
                      ? 'border-l-2 border-l-[var(--status-warning)]'
                      : ''
                  }`}
                >
                  <div className="text-[var(--text-muted)] text-[11px]">{log.timestamp}</div>
                  <div className={levelColor}>{log.level}</div>
                  <div className="font-bold text-[var(--primary)]">{log.agentId}</div>
                  <div className="text-[var(--text-main)] truncate">{log.action}</div>
                  <div className="text-[var(--text-muted)] text-[11px] truncate">{log.result}</div>
                  <div className="text-[var(--text-main)] opacity-90">{log.message}</div>
                </div>
              )
            })
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  </div>
</div>
)
}