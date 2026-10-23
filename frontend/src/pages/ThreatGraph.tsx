import React, { useState, useEffect } from 'react'
import {
  getTopologyGraph,
  containAgent,
  restoreAgent,
  getBlastRadius,
  TopologyNode,
  TopologyEdge,
  TopologyStats,
  BlastRadiusResponse,
} from '../api'
import { useWebSocket } from '../ws/WebSocketContext'

const CLUSTER_COLORS: Record<string, string> = {
  orchestration: '#818cf8', // Indigo
  data: '#38bdf8',          // Cyan
  execution: '#f59e0b',     // Amber
  governance: '#10b981',    // Emerald
}

export default function ThreatGraph() {
  const { messages } = useWebSocket()
  const [nodes, setNodes] = useState<TopologyNode[]>([])
  const [edges, setEdges] = useState<TopologyEdge[]>([])
  const [stats, setStats] = useState<TopologyStats | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState<string>('AGT-COORD-01')
  const [blastRadius, setBlastRadius] = useState<BlastRadiusResponse | null>(null)
  const [actionLoading, setActionLoading] = useState<boolean>(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const loadGraph = async () => {
    try {
      const graph = await getTopologyGraph()
      setNodes(graph.nodes)
      setEdges(graph.edges)
      setStats(graph.stats)
      if (!selectedAgentId && graph.nodes.length > 0) {
        setSelectedAgentId(graph.nodes[0].id)
      }
    } catch (err) {
      console.error('Failed to load topology graph:', err)
    }
  }

  useEffect(() => {
    loadGraph()
  }, [])

  useEffect(() => {
    if (!selectedAgentId) return
    async function loadBR() {
      try {
        const br = await getBlastRadius(selectedAgentId)
        setBlastRadius(br)
      } catch (err) {
        console.error('Failed to load blast radius:', err)
      }
    }
    loadBR()
  }, [selectedAgentId, nodes])

  // Realtime updates from WebSocket
  useEffect(() => {
    if (!messages || messages.length === 0) return
    const lastMsg = messages[messages.length - 1]
    if (
      lastMsg.type === 'topology_agent_contained' ||
      lastMsg.type === 'topology_agent_restored' ||
      lastMsg.type === 'alert_created'
    ) {
      loadGraph()
    }
  }, [messages])

  const handleContain = async (agentId: string) => {
    setActionLoading(true)
    try {
      const res = await containAgent(agentId, 'Manual containment to arrest lateral threat movement')
      setActionMessage(`Agent ${agentId} isolated! ${res.severed_channels} communication channels severed.`)
      await loadGraph()
    } catch (err: any) {
      setActionMessage(`Containment error: ${err.message || 'Failed'}`)
    } finally {
      setActionLoading(false)
      setTimeout(() => setActionMessage(null), 4000)
    }
  }

  const handleRestore = async (agentId: string) => {
    setActionLoading(true)
    try {
      const res = await restoreAgent(agentId)
      setActionMessage(`Agent ${agentId} restored! ${res.restored_channels} communication channels reconnected.`)
      await loadGraph()
    } catch (err: any) {
      setActionMessage(`Restoration error: ${err.message || 'Failed'}`)
    } finally {
      setActionLoading(false)
      setTimeout(() => setActionMessage(null), 4000)
    }
  }

  const selectedNode = nodes.find((n) => n.id === selectedAgentId)

  // Layout node positions in an interactive coordinate space
  const getNodeCoordinates = (index: number, total: number) => {
    const radius = 170
    const centerX = 340
    const centerY = 240
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    }
  }

  const nodePositions: Record<string, { x: number; y: number }> = {}
  nodes.forEach((n, idx) => {
    nodePositions[n.id] = getNodeCoordinates(idx, nodes.length || 1)
  })

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-[var(--primary)]">account_tree</span>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
              Multi-Agent Topology & Lateral Containment
            </h1>
            <span className="text-xs px-2.5 py-1 rounded-full font-mono bg-[rgba(16,185,129,0.12)] text-[var(--status-success)] border border-[rgba(16,185,129,0.25)]">
              Active Mesh Defense
            </span>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Real-time directed communication topology preventing lateral privilege escalation across autonomous agent swarms with instantaneous channel severance.
          </p>
        </div>

        <button
          onClick={loadGraph}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-[#0c1322] hover:bg-[#1e293b] border border-[var(--border-color)] text-xs font-mono rounded-lg transition-colors text-[var(--text-main)]"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          Sync Topology
        </button>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div className="p-3 rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/30 text-xs font-mono text-[var(--primary)] flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">info</span>
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-[var(--text-muted)] hover:text-white">✕</button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[#0b101c]/80 backdrop-blur">
          <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
            <span>TOTAL AGENT NODES</span>
            <span className="material-symbols-outlined text-sm text-[var(--primary)]">smart_toy</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[var(--text-main)]">
            {stats?.total_nodes || nodes.length}
          </div>
          <div className="mt-1 text-xs text-[var(--status-success)] font-mono">
            ● {stats?.active_nodes || nodes.filter(n => n.status === 'active').length} Active in Mesh
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[#0b101c]/80 backdrop-blur">
          <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
            <span>COMMUNICATION CHANNELS</span>
            <span className="material-symbols-outlined text-sm text-blue-400">sync_alt</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[var(--text-main)]">
            {stats?.total_edges || edges.length} <span className="text-xs text-[var(--text-muted)]">edges</span>
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)] font-mono">
            {stats?.active_edges || edges.filter(e => e.status === 'active').length} operational routes
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[#0b101c]/80 backdrop-blur">
          <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
            <span>SEVERED CHANNELS</span>
            <span className="material-symbols-outlined text-sm text-[var(--status-danger)]">link_off</span>
          </div>
          <div className={`mt-2 text-2xl font-bold font-mono ${(stats?.severed_edges || 0) > 0 ? 'text-[var(--status-danger)]' : 'text-slate-400'}`}>
            {stats?.severed_edges || 0}
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)] font-mono">
            {(stats?.contained_nodes || 0) > 0 ? `${stats?.contained_nodes} agent(s) quarantined` : 'No active containment'}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[#0b101c]/80 backdrop-blur">
          <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
            <span>MESH RESILIENCE</span>
            <span className="material-symbols-outlined text-sm text-[var(--status-success)]">verified</span>
          </div>
          <div className="mt-2 text-lg font-bold font-mono text-[var(--status-success)] truncate">
            {stats?.mesh_resilience_grade || 'OPTIMAL_RESILIENT'}
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)] font-mono">
            Avg Risk Score: {stats?.average_risk_score || 0.0}
          </div>
        </div>
      </div>

      {/* Main Graph & Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Visual Graph Canvas */}
        <div className="lg:col-span-2 rounded-xl border border-[var(--border-color)] bg-[#070b14] p-4 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-mono border-b border-[var(--border-color)]/60 pb-3 z-10">
            <span className="text-[var(--text-muted)]">DIRECTED AGENT MESH TOPOLOGY</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span> Active Channel
              </span>
              <span className="flex items-center gap-1 text-[10px] text-[var(--status-danger)]">
                <span className="w-2 h-2 rounded-full bg-[var(--status-danger)] inline-block"></span> Severed Channel
              </span>
            </div>
          </div>

          {/* SVG Canvas */}
          <div className="w-full flex items-center justify-center py-4">
            <svg viewBox="0 0 680 480" className="w-full max-w-[680px] h-[440px] select-none">
              {/* Defs for arrow markers */}
              <defs>
                <marker
                  id="arrow-active"
                  viewBox="0 0 10 10"
                  refX="22"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
                </marker>
                <marker
                  id="arrow-severed"
                  viewBox="0 0 10 10"
                  refX="22"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
                </marker>
              </defs>

              {/* Render Directed Edges */}
              {edges.map((edge) => {
                const srcPos = nodePositions[edge.source]
                const tgtPos = nodePositions[edge.target]
                if (!srcPos || !tgtPos) return null

                const isSevered = edge.status === 'severed'
                const strokeColor = isSevered ? '#ef4444' : '#10b981'
                const strokeDash = isSevered ? '5,5' : 'none'
                const markerEnd = isSevered ? 'url(#arrow-severed)' : 'url(#arrow-active)'

                const midX = (srcPos.x + tgtPos.x) / 2
                const midY = (srcPos.y + tgtPos.y) / 2

                return (
                  <g key={edge.id}>
                    <line
                      x1={srcPos.x}
                      y1={srcPos.y}
                      x2={tgtPos.x}
                      y2={tgtPos.y}
                      stroke={strokeColor}
                      strokeWidth={isSevered ? 2 : 1.75}
                      strokeDasharray={strokeDash}
                      markerEnd={markerEnd}
                      opacity={isSevered ? 0.9 : 0.65}
                    />
                    {/* Edge Protocol Badge */}
                    <rect
                      x={midX - 18}
                      y={midY - 9}
                      width="36"
                      height="16"
                      rx="4"
                      fill="#0b101c"
                      stroke={strokeColor}
                      strokeWidth="0.8"
                    />
                    <text
                      x={midX}
                      y={midY + 3}
                      fill={strokeColor}
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {isSevered ? 'SEVER' : edge.protocol.toUpperCase()}
                    </text>
                  </g>
                )
              })}

              {/* Render Node Circles & Labels */}
              {nodes.map((node) => {
                const pos = nodePositions[node.id]
                if (!pos) return null

                const isSelected = selectedAgentId === node.id
                const isContained = node.status === 'quarantined' || node.status === 'halted'
                const clusterColor = CLUSTER_COLORS[node.cluster] || '#94a3b8'

                return (
                  <g
                    key={node.id}
                    onClick={() => setSelectedAgentId(node.id)}
                    className="cursor-pointer transition-transform duration-200 hover:scale-105"
                  >
                    {/* Pulse ring for contained or selected */}
                    {isSelected && (
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r="34"
                        fill="none"
                        stroke="var(--primary)"
                        strokeWidth="1.5"
                        strokeDasharray="4,3"
                        className="animate-spin-slow"
                      />
                    )}
                    {isContained && (
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r="32"
                        fill="rgba(239, 68, 68, 0.15)"
                        stroke="#ef4444"
                        strokeWidth="1.5"
                      />
                    )}

                    {/* Node Core */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r="24"
                      fill="#0b101c"
                      stroke={isContained ? '#ef4444' : isSelected ? 'var(--primary)' : clusterColor}
                      strokeWidth={isSelected ? 3 : 2}
                    />

                    {/* Node Icon */}
                    <text
                      x={pos.x}
                      y={pos.y + 5}
                      fill={isContained ? '#ef4444' : isSelected ? 'var(--primary)' : clusterColor}
                      fontSize="14"
                      fontFamily="Material Symbols Outlined"
                      textAnchor="middle"
                    >
                      {isContained ? 'block' : node.role === 'Orchestrator' ? 'hub' : 'smart_toy'}
                    </text>

                    {/* Node Label Below */}
                    <text
                      x={pos.x}
                      y={pos.y + 44}
                      fill="#f8fafc"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {node.id}
                    </text>
                    <text
                      x={pos.x}
                      y={pos.y + 57}
                      fill="#94a3b8"
                      fontSize="9"
                      fontFamily="sans-serif"
                      textAnchor="middle"
                    >
                      {node.role} ({node.risk_score} risk)
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>

          <div className="text-[10px] text-[var(--text-muted)] font-mono text-center border-t border-[var(--border-color)]/50 pt-2">
            💡 Click any agent node to inspect downstream reachability and enforce dynamic channel containment.
          </div>
        </div>

        {/* Selected Agent Inspector & Containment Controls */}
        <div className="space-y-4">
          {selectedNode ? (
            <div className="p-5 rounded-xl border border-[var(--border-color)] bg-[#0b101c] flex flex-col justify-between h-full">
              <div>
                {/* Agent Header */}
                <div className="flex items-start justify-between border-b border-[var(--border-color)] pb-3">
                  <div>
                    <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                      Selected Agent
                    </span>
                    <h3 className="text-lg font-bold font-mono text-white">{selectedNode.id}</h3>
                    <div className="text-xs text-[var(--text-muted)]">{selectedNode.name}</div>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2.5 py-1 rounded-full font-semibold uppercase ${
                      selectedNode.status === 'quarantined'
                        ? 'bg-[rgba(239,68,68,0.15)] text-[var(--status-danger)] border border-[rgba(239,68,68,0.3)]'
                        : 'bg-[rgba(16,185,129,0.15)] text-[var(--status-success)] border border-[rgba(16,185,129,0.3)]'
                    }`}
                  >
                    {selectedNode.status}
                  </span>
                </div>

                {/* Attributes List */}
                <div className="mt-4 space-y-2.5 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-[var(--text-muted)]">Framework:</span>
                    <span className="text-white font-semibold">{selectedNode.framework}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-[var(--text-muted)]">Role / Cluster:</span>
                    <span className="text-white capitalize">{selectedNode.role} ({selectedNode.cluster})</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-[var(--text-muted)]">Current Risk Score:</span>
                    <span className={`font-bold ${selectedNode.risk_score > 50 ? 'text-[var(--status-danger)]' : 'text-[var(--status-success)]'}`}>
                      {selectedNode.risk_score} / 100
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-[var(--text-muted)]">Active Tools:</span>
                    <span className="text-[var(--primary)]">{selectedNode.tools.join(', ')}</span>
                  </div>
                </div>

                {/* Blast Radius Section */}
                <div className="mt-5 p-3.5 rounded-lg bg-black/40 border border-white/5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[var(--text-muted)]">CASCADING BLAST RADIUS</span>
                    <span className="text-amber-400 font-bold">{blastRadius?.blast_radius_score || 0.0}%</span>
                  </div>
                  <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-400 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${blastRadius?.blast_radius_score || 0}%` }}
                    />
                  </div>
                  <div className="mt-3 text-[11px] text-[var(--text-muted)] font-mono">
                    Downstream Exposed Agents ({blastRadius?.reachable_agents_count || 0}):
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {blastRadius?.reachable_agents.length ? (
                      blastRadius.reachable_agents.map((ag) => (
                        <span key={ag} className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-slate-300">
                          {ag}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-[var(--text-muted)] italic">Leaf node (no downstream agents)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Dynamic Containment Actions */}
              <div className="mt-6 pt-4 border-t border-[var(--border-color)]">
                {selectedNode.status === 'quarantined' ? (
                  <button
                    onClick={() => handleRestore(selectedNode.id)}
                    disabled={actionLoading}
                    className="w-full py-2.5 px-4 bg-[var(--status-success)] hover:bg-emerald-600 disabled:opacity-50 text-white font-medium text-xs font-mono rounded-lg transition-colors flex items-center justify-center gap-2 shadow"
                  >
                    <span className="material-symbols-outlined text-base">lock_open</span>
                    {actionLoading ? 'Restoring Mesh...' : 'Restore Agent to Mesh'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleContain(selectedNode.id)}
                    disabled={actionLoading}
                    className="w-full py-2.5 px-4 bg-[var(--status-danger)] hover:bg-[#dc2626] disabled:opacity-50 text-white font-medium text-xs font-mono rounded-lg transition-colors flex items-center justify-center gap-2 shadow"
                  >
                    <span className="material-symbols-outlined text-base">link_off</span>
                    {actionLoading ? 'Severing Channels...' : 'Sever Channels & Quarantine'}
                  </button>
                )}
                <p className="text-[10px] text-[var(--text-muted)] text-center mt-2">
                  Cryptographically audited in immutable SHA-256 ledger.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl border border-[var(--border-color)] bg-[#0b101c] text-center text-xs text-[var(--text-muted)] font-mono">
              Select an agent from the graph to inspect containment controls.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
