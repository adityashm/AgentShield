import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getAgent, quarantineAgent, releaseAgent } from '../../api'

export default function AgentDetailDirectory() {
  const { id } = useParams()
  const currentAgentId = id || 'AGT-009'
  const [agentStatus, setAgentStatus] = useState<'active' | 'suspended'>('active')
  const [agentData, setAgentData] = useState<any | null>(null)

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
    try {
      await quarantineAgent(currentAgentId)
      setAgentStatus('suspended')
    } catch {
      setAgentStatus('suspended')
    }
  }

  const handleReleaseAgent = async (): Promise<void> => {
    try {
      await releaseAgent(currentAgentId)
      setAgentStatus('active')
    } catch {
      setAgentStatus('active')
    }
  }

  return (
    <div className="space-y-6">
      {/* VISUAL ISOLATION BANNER */}
      {agentStatus === 'suspended' && (
        <div className="p-4 bg-[var(--status-danger)]/15 border border-[var(--status-danger)] rounded-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[var(--status-danger)] text-2xl">block</span>
            <div>
              <h4 className="text-[var(--status-danger)] font-bold text-sm uppercase tracking-wider">
                AGENT ISOLATED &amp; SUSPENDED FROM NETWORK
              </h4>
              <p className="text-[var(--text-main)] text-xs font-mono mt-0.5">
                {currentAgentId} is currently <span className="font-bold underline">suspended</span>. Process execution halted and network traffic blocked.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-[var(--status-danger)] text-white text-xs font-mono font-bold rounded-sm uppercase">
            STATUS: SUSPENDED
          </span>
        </div>
      )}

      {/* HEADER SECTION */}
      <section className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-2xl sm:text-[38px] leading-none font-bold text-[var(--primary)] tracking-tighter">{currentAgentId}</h2>
            {agentStatus === 'suspended' ? (
              <span className="px-3 py-1 bg-[var(--status-danger)] text-white text-[10px] font-mono tracking-widest uppercase font-bold">
                SUSPENDED / ISOLATED
              </span>
            ) : (
              <span className="px-3 py-1 bg-[rgba(248,81,73,0.1)] border border-[var(--status-danger)] text-[var(--status-danger)] text-[10px] font-mono tracking-widest uppercase">
                HIGH RISK
              </span>
            )}
          </div>
          <p className="text-[13px] sm:text-[14px] text-[var(--text-muted)] mt-2 max-w-xl">
            Deep-packet inspection agent deployed on Network Segment 04. Current behavioral anomalies detected in file-transfer protocols.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-main)] font-mono text-[12px] uppercase tracking-wider hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">description</span> VIEW LOGS
          </button>
          <button className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-main)] font-mono text-[12px] uppercase tracking-wider hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">file_download</span> EXPORT REPORT
          </button>
          {agentStatus === 'suspended' ? (
            <button
              onClick={handleReleaseAgent}
              className="px-4 py-2 font-mono text-[12px] uppercase tracking-wider transition-all flex items-center gap-2 border border-[var(--status-success)] bg-[rgba(35,134,54,0.1)] text-[var(--status-success)] hover:bg-[var(--status-success)] hover:text-white cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              RELEASE AGENT
            </button>
          ) : (
            <button
              onClick={handleIsolateAgent}
              className="px-4 py-2 font-mono text-[12px] uppercase tracking-wider transition-all flex items-center gap-2 border border-[var(--status-danger)] bg-[rgba(248,81,73,0.1)] text-[var(--status-danger)] hover:bg-[var(--status-danger)] hover:text-white cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">block</span>
              ISOLATE AGENT
            </button>
          )}
        </div>
      </section>

      {/* TOP INFO CARDS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Risk Score */}
        <div className="bg-[var(--bg-raised)] border border-[var(--border-color)] p-6 flex items-center justify-between border-l-2 border-l-[var(--status-danger)] transition-all hover:border-[var(--primary)]">
          <div>
            <h3 className="text-[14px] text-[var(--text-muted)] mb-1">Current Risk Score</h3>
            <div className="flex items-baseline gap-1">
              <span className={`font-mono text-3xl font-bold ${(agentData?.current_risk_score || 0) >= 70 ? 'text-[var(--status-danger)]' : 'text-[var(--status-warning)]'}`}>
                {Math.round(agentData?.current_risk_score ?? agentData?.risk_score ?? 84)}
              </span>
              <span className="font-mono text-[var(--text-muted)] text-sm">/100</span>
            </div>
          </div>
          <div className="relative w-16 h-16">
            <svg className="w-full h-full transform -rotate-90">
              <circle className="text-[var(--border-color)]" cx="32" cy="32" fill="transparent" r="28" stroke="currentColor" strokeWidth="4"></circle>
              <circle className="text-[var(--status-danger)]" cx="32" cy="32" fill="transparent" r="28" stroke="currentColor" strokeDasharray="175.9" strokeDashoffset="28.1" strokeWidth="4"></circle>
            </svg>
          </div>
        </div>

        {/* Session Duration */}
        <div className="bg-[var(--bg-raised)] border border-[var(--border-color)] p-6 flex items-center gap-4 border-l-2 border-l-[var(--primary)] transition-all hover:border-[var(--primary)]">
          <div className="w-12 h-12 bg-[rgba(168,232,255,0.1)] flex items-center justify-center rounded">
            <span className="material-symbols-outlined text-[var(--primary)]">timer</span>
          </div>
          <div>
            <h3 className="text-[14px] text-[var(--text-muted)] mb-1">Session Duration</h3>
            <p className="font-mono text-3xl font-bold text-[var(--text-main)]">2h 34m</p>
          </div>
        </div>

        {/* Total Actions */}
        <div className="bg-[var(--bg-raised)] border border-[var(--border-color)] p-6 flex items-center gap-4 border-l-2 border-l-[#859398] transition-all hover:border-[var(--primary)]">
          <div className="w-12 h-12 bg-[#859398]/10 flex items-center justify-center rounded">
            <span className="material-symbols-outlined text-[#859398]">account_tree</span>
          </div>
          <div>
            <h3 className="text-[14px] text-[var(--text-muted)] mb-1">Total Actions</h3>
            <p className="font-mono text-3xl font-bold text-[var(--text-main)]">1,247</p>
          </div>
        </div>
      </section>

      {/* MIDDLE CONTENT */}
      <section className="grid grid-cols-1 lg:grid-cols-10 gap-4 mb-4 lg:h-[420px]">
        {/* Action Timeline (Left 60%) */}
        <div className="lg:col-span-6 bg-[var(--bg-raised)] border border-[var(--border-color)] flex flex-col transition-all hover:border-[var(--primary)]">
          <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-surface)]">
            <h3 className="text-[14px] text-[var(--text-main)] flex items-center gap-2 uppercase tracking-wide font-semibold">
              <span className="material-symbols-outlined text-[var(--primary)] text-[20px]">history</span> Action Timeline
            </h3>
            <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest">Live Updates</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex gap-4 group">
              <span className="font-mono text-[11px] text-[var(--text-muted)] pt-1">23:44:01</span>
              <div className="flex-1 pb-3 border-b border-[var(--border-color)] group-last:border-none">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-[rgba(248,81,73,0.2)] text-[var(--status-danger)] font-mono text-[10px] rounded">unauthorized_access</span>
                  <span className="text-[var(--text-main)] font-medium text-sm">/root/sys_config write attempt</span>
                </div>
                <p className="font-mono text-[11px] text-[var(--text-muted)]">Params: {'{'} source: "EXT-88", target: "LOCAL_FS", permission: "DENIED" {'}'}</p>
              </div>
            </div>
            <div className="flex gap-4 group">
              <span className="font-mono text-[11px] text-[var(--text-muted)] pt-1">23:42:55</span>
              <div className="flex-1 pb-3 border-b border-[var(--border-color)] group-last:border-none">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-[rgba(168,232,255,0.2)] text-[var(--primary)] font-mono text-[10px] rounded">api_call</span>
                  <span className="text-[var(--text-main)] font-medium text-sm">POST /v1/auth/token</span>
                </div>
                <p className="font-mono text-[11px] text-[var(--text-muted)]">Params: {'{'} client_id: "009-SEC", scope: "READ_ALL" {'}'}</p>
              </div>
            </div>
            <div className="flex gap-4 group">
              <span className="font-mono text-[11px] text-[var(--text-muted)] pt-1">23:40:12</span>
              <div className="flex-1 pb-3 border-b border-[var(--border-color)] group-last:border-none">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-[rgba(210,153,34,0.2)] text-[var(--status-warning)] font-mono text-[10px] rounded">execute_command</span>
                  <span className="text-[var(--text-main)] font-medium text-sm">rm -rf /tmp/staging/*</span>
                </div>
                <p className="font-mono text-[11px] text-[var(--text-muted)]">Params: {'{'} force: true, recursive: true {'}'}</p>
              </div>
            </div>
            <div className="flex gap-4 group">
              <span className="font-mono text-[11px] text-[var(--text-muted)] pt-1">23:38:44</span>
              <div className="flex-1 pb-3 border-b border-[var(--border-color)] group-last:border-none">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-[rgba(187,201,207,0.2)] text-[var(--text-muted)] font-mono text-[10px] rounded">read_file</span>
                  <span className="text-[var(--text-main)] font-medium text-sm">/etc/hosts</span>
                </div>
                <p className="font-mono text-[11px] text-[var(--text-muted)]">Params: {'{'} mode: "r", buffer: 1024 {'}'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Score Trend (Right 40%) */}
        <div className="lg:col-span-4 bg-[var(--bg-raised)] border border-[var(--border-color)] flex flex-col relative overflow-hidden transition-all hover:border-[var(--primary)]">
          <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
            <h3 className="text-[14px] text-[var(--text-main)] flex items-center gap-2 uppercase tracking-wide font-semibold">
              <span className="material-symbols-outlined text-[var(--primary)] text-[20px]">show_chart</span> Risk Score Trend
            </h3>
          </div>
          <div className="flex-1 p-4 relative flex flex-col justify-end">
            <div className="absolute w-full border-t border-dashed border-[rgba(248,81,73,0.6)] top-[30%] left-0 z-10 flex justify-end px-4">
              <span className="bg-[var(--bg-base)] text-[var(--status-danger)] text-[9px] px-1 -mt-2 font-mono">ALERT THRESHOLD (70)</span>
            </div>
            <div className="w-full h-[200px] flex items-end gap-1 px-2 mb-4 relative z-20">
              <div className="flex-1 bg-[rgba(168,232,255,0.2)] border-t-2 border-[var(--primary)] h-[40%]"></div>
              <div className="flex-1 bg-[rgba(168,232,255,0.2)] border-t-2 border-[var(--primary)] h-[45%]"></div>
              <div className="flex-1 bg-[rgba(168,232,255,0.2)] border-t-2 border-[var(--primary)] h-[42%]"></div>
              <div className="flex-1 bg-[rgba(168,232,255,0.2)] border-t-2 border-[var(--primary)] h-[50%]"></div>
              <div className="flex-1 bg-[rgba(168,232,255,0.2)] border-t-2 border-[var(--primary)] h-[60%]"></div>
              <div className="flex-1 bg-[rgba(168,232,255,0.2)] border-t-2 border-[var(--primary)] h-[75%]"></div>
              <div className="flex-1 bg-[rgba(248,81,73,0.4)] border-t-2 border-[var(--status-danger)] h-[85%]"></div>
              <div className="flex-1 bg-[rgba(248,81,73,0.4)] border-t-2 border-[var(--status-danger)] h-[82%]"></div>
              <div className="flex-1 bg-[rgba(248,81,73,0.4)] border-t-2 border-[var(--status-danger)] h-[90%]"></div>
              <div className="flex-1 bg-[rgba(248,81,73,0.4)] border-t-2 border-[var(--status-danger)] h-[84%]"></div>
            </div>
            <div className="flex justify-between font-mono text-[10px] text-[var(--text-muted)] border-t border-[var(--border-color)] pt-2 relative z-20">
              <span>30m AGO</span>
              <span>15m AGO</span>
              <span>NOW</span>
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM SECTION: ASSOCIATED ALERTS */}
      <section className="bg-[var(--bg-raised)] border border-[var(--border-color)] transition-all hover:border-[var(--primary)]">
        <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-surface)]">
          <h3 className="text-[14px] text-[var(--text-main)] flex items-center gap-2 uppercase tracking-wide font-semibold">
            <span className="material-symbols-outlined text-[var(--primary)] text-[20px]">warning</span> Associated Alerts
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono">
            <thead className="bg-[var(--bg-base)] text-[var(--text-muted)] text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 font-medium">Alert ID</th>
                <th className="px-6 py-3 font-medium">Trigger Type</th>
                <th className="px-6 py-3 font-medium">Severity</th>
                <th className="px-6 py-3 font-medium">Risk Score</th>
                <th className="px-6 py-3 font-medium">Time</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-[var(--border-color)]">
              <tr className="hover:bg-[var(--bg-hover)] transition-colors">
                <td className="px-6 py-4 text-[var(--primary)]">ALT-9921</td>
                <td className="px-6 py-4 text-[var(--text-main)]">Memory Buffer Overflow</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-0.5 border border-[var(--status-danger)] text-[var(--status-danger)] text-[10px] font-bold">CRITICAL</span>
                </td>
                <td className="px-6 py-4 text-[var(--status-danger)] font-bold">92</td>
                <td className="px-6 py-4 text-[var(--text-muted)]">23:44:10</td>
                <td className="px-6 py-4">
                  <span className="flex items-center gap-2 text-[var(--text-main)]">
                    <span className="w-2 h-2 bg-[var(--status-warning)] rounded-full"></span>
                    Investigating
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
