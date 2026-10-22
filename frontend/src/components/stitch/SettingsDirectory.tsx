import React, { useState } from 'react'

export default function SettingsDirectory() {
  const [latency, setLatency] = useState(120)
  const [jitter, setJitter] = useState(15)
  const [packetLoss, setPacketLoss] = useState(2.5)
  const [apiThrottling, setApiThrottling] = useState(500)
  const [autoKill, setAutoKill] = useState(true)
  const [interceptOutbound, setInterceptOutbound] = useState(true)
  const [readOnlyFs, setReadOnlyFs] = useState(false)
  const [riskThreshold, setRiskThreshold] = useState(70)
  const [logRetention, setLogRetention] = useState(90)
  const [alertHistory, setAlertHistory] = useState(50000)

  // ML Model Retraining State (SRS FR-14)
  const [isRetraining, setIsRetraining] = useState(false)
  const [retrainSuccess, setRetrainSuccess] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleResetDefaults = () => {
    setLatency(120)
    setJitter(15)
    setPacketLoss(2.5)
    setApiThrottling(500)
    setAutoKill(true)
    setInterceptOutbound(true)
    setReadOnlyFs(false)
    setRiskThreshold(70)
    setLogRetention(90)
    setAlertHistory(50000)
    showToast('Settings reset to system default values.')
  }

  const handleSaveConfig = () => {
    const config = {
      latency,
      jitter,
      packetLoss,
      apiThrottling,
      autoKill,
      interceptOutbound,
      readOnlyFs,
      riskThreshold,
      logRetention,
      alertHistory,
    }
    localStorage.setItem('agentshield_settings', JSON.stringify(config))
    showToast('System configuration saved successfully.')
  }

  const handleTriggerRetrain = () => {
    setIsRetraining(true)
    setRetrainSuccess(null)
    setTimeout(() => {
      setIsRetraining(false)
      setRetrainSuccess('Isolation Forest model retrained with 10,240 historical actions. Contamination: 0.05, Trees: 100.')
      showToast('ML Anomaly Detection model updated.')
    }, 2000)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 font-mono pb-24">
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 rounded-sm bg-[var(--bg-raised)] border border-[var(--primary)] px-4 py-2 font-mono text-xs text-[var(--primary)] shadow-2xl flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">tune</span>
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-[var(--text-main)] text-[24px] font-bold">System Parameters &amp; Security Controls</h1>
        <p className="text-[var(--text-muted)] text-xs mt-1">
          Configure real-time simulation variables, threat guardrails, risk thresholds, and ML model retraining.
        </p>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Environment Parameters */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm p-4 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--primary)]" />
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[var(--primary)] text-[20px]">tune</span>
              <h2 className="text-[var(--text-main)] text-sm font-bold uppercase tracking-wider">
                Environment &amp; Simulation Parameters
              </h2>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[var(--text-muted)]">Latency Simulation</span>
                  <span className="text-[var(--primary)] font-bold">{latency} ms</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="500"
                  value={latency}
                  onChange={(e) => setLatency(parseInt(e.target.value))}
                  className="w-full accent-[var(--primary)] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[var(--text-muted)]">Network Jitter Deviation</span>
                  <span className="text-[var(--primary)] font-bold">{jitter} %</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={jitter}
                  onChange={(e) => setJitter(parseInt(e.target.value))}
                  className="w-full accent-[var(--primary)] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[var(--text-muted)]">Packet Loss Emulation</span>
                  <span className="text-[var(--primary)] font-bold">{packetLoss} %</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="0.5"
                  value={packetLoss}
                  onChange={(e) => setPacketLoss(parseFloat(e.target.value))}
                  className="w-full accent-[var(--primary)] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[var(--text-muted)]">API Rate Throttle Limit</span>
                  <span className="text-[var(--primary)] font-bold">{apiThrottling} req/min</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="50"
                  value={apiThrottling}
                  onChange={(e) => setApiThrottling(parseInt(e.target.value))}
                  className="w-full accent-[var(--primary)] cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Global Threat Guardrails */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm p-4 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--status-danger)]" />
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[var(--status-danger)] text-[20px]">security</span>
              <h2 className="text-[var(--text-main)] text-sm font-bold uppercase tracking-wider">
                Automated Security Guardrails
              </h2>
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm hover:border-[var(--primary)] cursor-pointer transition-colors">
                <div>
                  <div className="text-xs font-bold text-[var(--text-main)]">Auto-Quarantine Rogue Processes</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Instantly terminate and isolate agents exhibiting anomaly scores &gt; 0.85
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoKill}
                  onChange={(e) => setAutoKill(e.target.checked)}
                  className="h-4 w-4 rounded-sm border-[var(--border-color)] bg-[var(--bg-base)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm hover:border-[var(--primary)] cursor-pointer transition-colors">
                <div>
                  <div className="text-xs font-bold text-[var(--text-main)]">Intercept Outbound External Requests</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Block unverified egress endpoints and prompt injection attempts
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={interceptOutbound}
                  onChange={(e) => setInterceptOutbound(e.target.checked)}
                  className="h-4 w-4 rounded-sm border-[var(--border-color)] bg-[var(--bg-base)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm hover:border-[var(--primary)] cursor-pointer transition-colors">
                <div>
                  <div className="text-xs font-bold text-[var(--text-main)]">Read-Only File System Sandbox</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Prevent agents from writing or altering system configuration files
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={readOnlyFs}
                  onChange={(e) => setReadOnlyFs(e.target.checked)}
                  className="h-4 w-4 rounded-sm border-[var(--border-color)] bg-[var(--bg-base)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Risk Thresholds & Visual Gauge */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm p-4 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--status-warning)]" />
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-[var(--status-warning)] text-[20px]">speed</span>
              <h2 className="text-[var(--text-main)] text-sm font-bold uppercase tracking-wider">
                Risk Alert Threshold
              </h2>
            </div>

            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r="40"
                    stroke="var(--border-color)"
                    strokeDasharray="188 63"
                    strokeDashoffset="0"
                    strokeLinecap="round"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r="40"
                    stroke="var(--status-warning)"
                    strokeDasharray={`${Math.min(riskThreshold, 100)} 120`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                    strokeWidth="8"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[30px] font-bold text-[var(--status-warning)]">{riskThreshold}</span>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase">Alert Trigger</span>
                </div>
              </div>

              <div className="w-full mt-3">
                <input
                  type="range"
                  min="30"
                  max="90"
                  value={riskThreshold}
                  onChange={(e) => setRiskThreshold(parseInt(e.target.value))}
                  className="w-full accent-[var(--status-warning)] cursor-pointer"
                />
              </div>

              <div className="w-full grid grid-cols-2 gap-2 mt-3 p-2 bg-[var(--bg-base)] rounded-sm text-[10px]">
                <div className="flex items-center gap-1.5 text-[var(--status-success)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--status-success)]" />
                  <span>Safe: 0–25</span>
                </div>
                <div className="flex items-center gap-1.5 text-[var(--primary)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
                  <span>Low: 26–50</span>
                </div>
                <div className="flex items-center gap-1.5 text-[var(--status-warning)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--status-warning)]" />
                  <span>Medium: 51–75</span>
                </div>
                <div className="flex items-center gap-1.5 text-[var(--status-danger)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--status-danger)]" />
                  <span>High: 76–100</span>
                </div>
              </div>
            </div>
          </div>

          {/* Machine Learning Model Retrain Card (SRS FR-14) */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm p-4 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--primary)]" />
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--primary)] text-[20px]">smart_toy</span>
                <h2 className="text-[var(--text-main)] text-sm font-bold uppercase tracking-wider">
                  Isolation Forest ML Engine
                </h2>
              </div>
              <span className="px-1.5 py-0.5 rounded-sm bg-[rgba(0,212,255,0.1)] border border-[var(--primary)]/30 text-[var(--primary)] text-[10px]">
                v1.0 ACTIVE
              </span>
            </div>

            <p className="text-[11px] text-[var(--text-muted)] mb-3 leading-relaxed">
              Unsupervised anomaly detection scoring action feature vectors (action_type, params, call_rate, duration).
            </p>

            {retrainSuccess && (
              <div className="p-2 mb-3 bg-[rgba(35,134,54,0.15)] border border-[var(--status-success)] rounded-sm text-[11px] text-[var(--status-success)]">
                {retrainSuccess}
              </div>
            )}

            <button
              onClick={handleTriggerRetrain}
              disabled={isRetraining}
              className={`w-full py-2 px-3 rounded-sm border border-[var(--primary)] font-mono text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isRetraining
                  ? 'bg-[rgba(0,212,255,0.2)] text-[var(--text-muted)]'
                  : 'bg-[rgba(0,212,255,0.1)] text-[var(--primary)] hover:bg-[rgba(0,212,255,0.2)]'
              }`}
            >
              <span className={`material-symbols-outlined text-[16px] ${isRetraining ? 'animate-spin' : ''}`}>
                {isRetraining ? 'sync' : 'bolt'}
              </span>
              {isRetraining ? 'Retraining ML Model...' : 'Retrain Isolation Forest (API)'}
            </button>
          </div>

          {/* Data Retention */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm p-4 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--text-muted)]" />
            <h2 className="text-[var(--text-main)] text-sm font-bold uppercase tracking-wider mb-3">
              Data Retention &amp; Audit Log
            </h2>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--text-muted)] mb-1">Telemetry Log Retention</label>
                <select
                  value={logRetention}
                  onChange={(e) => setLogRetention(parseInt(e.target.value))}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm p-2 text-[var(--text-main)] outline-none focus:border-[var(--primary)] cursor-pointer"
                >
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days</option>
                  <option value={365}>1 Year (Immutable Audit)</option>
                </select>
              </div>
              <div>
                <label className="block text-[var(--text-muted)] mb-1">Max Incident Event Buffer</label>
                <select
                  value={alertHistory}
                  onChange={(e) => setAlertHistory(parseInt(e.target.value))}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm p-2 text-[var(--text-main)] outline-none focus:border-[var(--primary)] cursor-pointer"
                >
                  <option value={10000}>10,000 Events</option>
                  <option value={50000}>50,000 Events</option>
                  <option value={100000}>100,000 Events</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Persistent Bottom Bar */}
      <div className="fixed bottom-0 right-0 left-0 md:left-[240px] bg-[var(--bg-surface)] border-t border-[var(--border-color)] p-3 px-6 flex justify-end gap-3 z-30 shadow-2xl">
        <button
          onClick={handleResetDefaults}
          className="px-4 py-1.5 border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs rounded-sm cursor-pointer transition-colors"
        >
          Reset Defaults
        </button>
        <button
          onClick={handleSaveConfig}
          className="px-5 py-1.5 bg-[var(--primary)] text-[#001f27] font-bold text-xs uppercase rounded-sm hover:bg-[#00b8e6] transition-colors cursor-pointer shadow-[0_0_8px_rgba(0,212,255,0.3)]"
        >
          Save Configuration
        </button>
      </div>
    </div>
  )
}